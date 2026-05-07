import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import { getAccountEntitlements } from "@/lib/provider-access";
import { loadProviderAccount } from "@/lib/provider-account";
import {
  buildLegacyProviderAuditEventInsert,
  buildProviderAuditEventInsert,
  getProviderAuditClientError,
  getSelectedDispatchWorkerIds,
  isProviderAuditSchemaError,
  shouldRetryProviderAuditLegacyInsert,
} from "@/lib/provider-dispatch-requests";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const allowedEvents = new Set([
  "profile_opened",
  "pack_opened",
  "shortlist_saved",
  "compare_action_used",
  "dispatch_requested",
  "dispatch_allowance_consumed",
  "ai_trial_used",
  "manual_job_draft_used",
]);

export async function POST(request: Request) {
  console.log("[provider-audit-events] POST reached");

  try {
    const currentUser = await getAppSessionUser();
    console.log("[provider-audit-events] auth resolved", {
      userId: currentUser?.id ?? null,
      role: currentUser?.role ?? null,
      providerId: currentUser?.providerId ?? null,
    });
    if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch((error) => {
      console.error("[provider-audit-events] invalid JSON body", error);
      return null;
    });
    console.log("[provider-audit-events] request body", body);
    const type = typeof body?.type === "string" ? body.type : "";
    if (!allowedEvents.has(type)) {
      return NextResponse.json({ success: false, error: "Invalid audit event." }, { status: 400 });
    }

    const metadata =
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    const supabase = createAdminSupabaseClient();
    let eventMetadata = metadata;
    let paygAllowanceUpdate: {
      providerId: string;
      payload: {
        payg_dispatch_allowance_remaining: number;
        payg_allowance_remaining?: number;
        dispatch_allowance_remaining: number;
        usage_today: number;
      };
    } | null = null;

    if (type === "dispatch_requested") {
    const workerIds = getSelectedDispatchWorkerIds(metadata);
    if (workerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Select at least 1 workforce record before requesting dispatch." },
        { status: 400 },
      );
    }

    const account = await loadProviderAccount(currentUser.providerId);
    if (!account) {
      return NextResponse.json({ success: false, error: "Provider account not found." }, { status: 404 });
    }

    const entitlements = getAccountEntitlements({
      accessTier: account.accessTier,
      accessStatus: account.accessStatus,
      accountTier: account.accountTier,
      billingStatus: account.billingStatus,
      paygPackType: account.paygPackType,
      paygDispatchAllowanceTotal: account.paygDispatchAllowanceTotal,
      paygDispatchAllowanceRemaining: account.paygDispatchAllowanceRemaining,
      monthlyRenewalDate: account.monthlyRenewalDate,
      monthlyActive: account.monthlyActive,
      activeSubscription: account.activeSubscription,
      trialAccess: account.trialAccess,
      isTrialMonth: account.isTrialMonth,
      trialGrantedByAdmin: account.trialGrantedByAdmin,
      trialStartDate: account.trialStartDate,
      trialEndDate: account.trialEndDate,
      trialStatus: account.trialStatus,
      trialAccessLevel: account.trialAccessLevel,
      profileOpensThisMonth: account.profileOpensThisMonth,
      compareActionsThisMonth: account.compareActionsThisMonth,
      manualDraftsUsed: account.manualDraftsUsed,
      fullAccess: account.fullAccess,
      adminFullAccess: account.adminFullAccess,
      accessLevel: account.accessLevel,
    });

    const accessSource = entitlements.dispatchAccessSource;
    const allowanceBefore = account.paygDispatchAllowanceRemaining;
    let allowanceAfter = allowanceBefore;

    if (!entitlements.canRequestDispatch) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[dispatch-request-denied]", {
          accountId: account.id,
          selectedWorkforceIds: workerIds,
          canRequestDispatch: entitlements.canRequestDispatch,
          accessSource,
          allowanceBefore,
        });
      }
      return NextResponse.json(
        {
          success: false,
          error: "Free Preview does not include dispatch requests. Upgrade to PAYG or Monthly.",
        },
        { status: 403 },
      );
    }

    if (accessSource === "payg") {
      allowanceAfter = Math.max(0, allowanceBefore - 1);
      paygAllowanceUpdate = {
        providerId: account.id,
        payload: {
          payg_dispatch_allowance_remaining: allowanceAfter,
          payg_allowance_remaining: allowanceAfter,
          dispatch_allowance_remaining: allowanceAfter,
          usage_today: account.usageToday + 1,
        },
      };
    }

    eventMetadata = {
      ...metadata,
      access_source: accessSource,
      notification_type: "dispatch_request_created",
      notification_title: "New dispatch request",
      notification_message: `${account.name} requested dispatch for ${workerIds.length} workforce record(s).`,
      can_request_dispatch: entitlements.canRequestDispatch,
      dispatch_access_label: entitlements.dispatchAccessLabel,
      dispatch_allowance_before: allowanceBefore,
      dispatch_allowance_after: allowanceAfter,
      status: "requested",
    };

    if (process.env.NODE_ENV !== "production") {
      console.debug("[dispatch-request-created]", {
        accountId: account.id,
        selectedWorkforceIds: workerIds,
        canRequestDispatch: entitlements.canRequestDispatch,
        accessSource,
        allowanceBefore,
        allowanceAfter,
      });
    }

    const jobId = typeof metadata.job_id === "string" ? metadata.job_id : null;
    if (jobId && workerIds.length > 0) {
      const now = new Date().toISOString();
      const assignmentResult = await supabase.from("job_worker_assignments").upsert(
        workerIds.map((workerId, index) => ({
          job_id: jobId,
          worker_id: workerId,
          provider_id: currentUser.providerId,
          assignment_status: "requested",
          requested_by_client: true,
          requested_by_client_at: now,
          requested_rank: index + 1,
          dispatch_status: "requested",
          payment_cycle: "weekly",
          payment_status: "not_ready",
          updated_at: now,
        })),
        { onConflict: "job_id,worker_id" },
      );
      if (assignmentResult.error) {
        console.error("[provider-audit-events] failed to attach requested workforce", {
          providerId: currentUser.providerId,
          jobId,
          workerIds,
          code: assignmentResult.error.code,
          message: assignmentResult.error.message,
          details: assignmentResult.error.details,
          hint: assignmentResult.error.hint,
        });
        return NextResponse.json(
          { success: false, error: "Dispatch request could not be linked to the selected job." },
          { status: 500 },
        );
      }
    }
  }

    const auditInsert = buildProviderAuditEventInsert({
      providerId: currentUser.providerId,
      actorUserId: currentUser.id,
      eventType: type,
      metadata: eventMetadata,
    });
    console.log("[provider-audit-events] insert payload", auditInsert);
    let { error } = await supabase.from("provider_audit_events").insert(auditInsert);

    if (error && shouldRetryProviderAuditLegacyInsert(error)) {
      console.warn("[provider-audit-events] extended insert failed; retrying legacy payload", {
        providerId: currentUser.providerId,
        eventType: type,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      const legacyInsert = buildLegacyProviderAuditEventInsert({
        providerId: currentUser.providerId,
        eventType: type,
        metadata: eventMetadata,
      });
      console.log("[provider-audit-events] legacy insert payload", legacyInsert);
      ({ error } = await supabase.from("provider_audit_events").insert(legacyInsert));
    }

    if (error) {
      console.error("[provider-audit-events] provider_audit_events insert failed", {
        providerId: currentUser.providerId,
        actorUserId: currentUser.id,
        eventType: type,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        metadata: eventMetadata,
      });

      if (type === "dispatch_requested" && isProviderAuditSchemaError(error)) {
        return NextResponse.json(
          {
            success: true,
            auditRecorded: false,
            metadata: eventMetadata,
            warning: "Dispatch request was accepted, but audit logging needs the latest database migration.",
          },
          { status: 202 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: getProviderAuditClientError(type, error),
          code: "provider_audit_write_failed",
        },
        { status: 500 },
      );
    }

    if (paygAllowanceUpdate) {
    const update = await supabase
      .from("job_providers")
      .update(paygAllowanceUpdate.payload)
      .eq("id", paygAllowanceUpdate.providerId);
    if (update.error) {
      const fallback = await supabase
        .from("job_providers")
        .update({
          payg_dispatch_allowance_remaining: paygAllowanceUpdate.payload.payg_dispatch_allowance_remaining,
          dispatch_allowance_remaining: paygAllowanceUpdate.payload.dispatch_allowance_remaining,
          usage_today: paygAllowanceUpdate.payload.usage_today,
        })
        .eq("id", paygAllowanceUpdate.providerId);
      if (fallback.error) {
        console.error("[provider-audit-events] failed to update PAYG allowance after dispatch request", {
          providerId: paygAllowanceUpdate.providerId,
          code: fallback.error.code,
          message: fallback.error.message,
          details: fallback.error.details,
          hint: fallback.error.hint,
        });
        return NextResponse.json(
          {
            success: true,
            metadata: eventMetadata,
            warning: "Dispatch request was recorded, but the allowance display may take a moment to update.",
          },
        );
      }
    }
  }

    return NextResponse.json({ success: true, auditRecorded: true, metadata: eventMetadata });
  } catch (error) {
    console.error("[provider-audit-events] unexpected failure", {
      error,
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json(
      { success: false, error: "Provider activity could not be recorded right now." },
      { status: 500 },
    );
  }
}
