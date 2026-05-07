import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeAccountTier } from "@/lib/provider-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createJobProviderSchema } from "@/lib/validation/schemas";

function buildProviderUpdatePayload(data: ReturnType<typeof createJobProviderSchema.parse>) {
  const accountTier = normalizeAccountTier(data.account_tier);
  const dispatchAccessSource =
    accountTier === "trial_full_access"
      ? "trial"
      : accountTier === "monthly_full_access"
        ? "monthly"
        : accountTier === "manual_full_access"
          ? "manual_full_access"
          : accountTier === "payg"
            ? "payg"
            : "free_preview";
  return {
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    town: data.town || null,
    postcode: data.postcode || null,
    account_tier: accountTier,
    access_tier: accountTier,
    access_status: "active",
    billing_status: data.billing_status,
    payg_pack_type: data.payg_pack_type,
    payg_pack: data.payg_pack_type ?? "None",
    payg_dispatch_allowance_total: data.payg_dispatch_allowance_total,
    payg_dispatch_allowance_remaining: data.payg_dispatch_allowance_remaining,
    payg_allowance_total: data.payg_dispatch_allowance_total,
    payg_allowance_remaining: data.payg_dispatch_allowance_remaining,
    dispatch_allowance_remaining: data.payg_dispatch_allowance_remaining,
    dispatch_access_source: dispatchAccessSource,
    usage_today: data.usage_today,
    monthly_renewal_date: data.monthly_renewal_date || null,
    monthly_active: data.monthly_active,
    is_trial_month: data.is_trial_month,
    trial_granted_by_admin: data.trial_granted_by_admin,
    trial_start_date: data.trial_start_date || null,
    trial_end_date: data.trial_end_date || null,
    trial_status: data.trial_status,
    internal_billing_note: data.internal_billing_note || null,
    success_fee_status: data.success_fee_status || null,
    payment_reliability_status: data.payment_reliability_status,
    invoices_issued_count: data.invoices_issued_count,
    invoices_paid_on_time_count: data.invoices_paid_on_time_count,
    invoices_paid_late_count: data.invoices_paid_late_count,
    unpaid_invoices_count: data.unpaid_invoices_count,
    part_paid_invoices_count: data.part_paid_invoices_count,
    average_days_to_pay: data.average_days_to_pay ?? null,
    longest_payment_delay_days: data.longest_payment_delay_days,
    current_overdue_count: data.current_overdue_count,
    payment_disputes_count: data.payment_disputes_count,
    contractor_payout_delay_incidents_count: data.contractor_payout_delay_incidents_count,
    last_payment_received_date: data.last_payment_received_date || null,
    payment_reliability_note: data.payment_reliability_note || null,
    payment_reliability_last_reviewed_at: data.payment_reliability_last_reviewed_at || null,
  };
}

function buildBaseProviderUpdatePayload(data: ReturnType<typeof createJobProviderSchema.parse>) {
  const accountTier = normalizeAccountTier(data.account_tier);
  return {
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    town: data.town || null,
    postcode: data.postcode || null,
    account_tier: accountTier,
    billing_status: data.billing_status,
    payg_pack_type: data.payg_pack_type,
    payg_dispatch_allowance_total: data.payg_dispatch_allowance_total,
    payg_dispatch_allowance_remaining: data.payg_dispatch_allowance_remaining,
    usage_today: data.usage_today,
    monthly_renewal_date: data.monthly_renewal_date || null,
    monthly_active: data.monthly_active,
    trial_status: data.trial_status,
    success_fee_status: data.success_fee_status || null,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { providerId } = await params;
  const json = await request.json();
  const parsed = createJobProviderSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid provider payload." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("job_providers")
      .update(buildProviderUpdatePayload(parsed.data))
      .eq("id", providerId)
      .select("id, name, email, phone, town, postcode, created_at, account_tier, billing_status, payg_pack_type, payg_pack, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, payg_allowance_total, payg_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, is_trial_month, trial_granted_by_admin, trial_start_date, trial_end_date, trial_status, internal_billing_note, success_fee_status, payment_reliability_status, invoices_issued_count, invoices_paid_on_time_count, invoices_paid_late_count, unpaid_invoices_count, part_paid_invoices_count, average_days_to_pay, longest_payment_delay_days, current_overdue_count, payment_disputes_count, contractor_payout_delay_incidents_count, last_payment_received_date, payment_reliability_note, payment_reliability_last_reviewed_at")
      .single();

    let updated: Record<string, unknown> | null = (data as Record<string, unknown> | null) ?? null;
    let updateError = error;

    if (updateError) {
      const fallback = await supabase
        .from("job_providers")
        .update(buildBaseProviderUpdatePayload(parsed.data))
        .eq("id", providerId)
        .select("id, name, email, phone, town, postcode, created_at, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, trial_status, success_fee_status")
        .single();

      updated = (fallback.data as Record<string, unknown> | null) ?? null;
      updateError = fallback.error;
    }

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Managed account not found." }, { status: 404 });
      }

      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ success: false, error: "Provider was not returned after update." }, { status: 500 });
    }

    await supabase.from("provider_audit_events").insert({
      provider_id: providerId,
      event_type: parsed.data.is_trial_month
        ? parsed.data.trial_status === "expired"
          ? "provider_trial_expired"
          : "provider_trial_granted"
        : parsed.data.account_tier === "monthly_full_access"
          ? "provider_tier_changed"
          : "provider_payment_reliability_changed",
      metadata: {
        account_tier: normalizeAccountTier(parsed.data.account_tier),
        billing_status: parsed.data.billing_status,
        trial_status: parsed.data.trial_status,
        payment_reliability_status: parsed.data.payment_reliability_status,
      },
    });

    return NextResponse.json({
      success: true,
      provider: {
        id: String(updated.id),
        provider_id: String(updated.id),
        name: updated.name,
        company_name: updated.name,
        email: updated.email,
        phone: updated.phone,
        town: updated.town,
        postcode: updated.postcode,
        created_at: updated.created_at,
        account_tier:
          updated && typeof updated === "object" && "account_tier" in updated && typeof updated.account_tier === "string"
            ? updated.account_tier
            : "free_preview",
        billing_status:
          updated && typeof updated === "object" && "billing_status" in updated && typeof updated.billing_status === "string"
            ? updated.billing_status
            : "trial",
        payg_pack_type:
          updated && typeof updated === "object" && "payg_pack_type" in updated && typeof updated.payg_pack_type === "string"
            ? updated.payg_pack_type
            : null,
        payg_dispatch_allowance_total:
          updated &&
          typeof updated === "object" &&
          "payg_dispatch_allowance_total" in updated &&
          typeof updated.payg_dispatch_allowance_total === "number"
            ? updated.payg_dispatch_allowance_total
            : 0,
        payg_dispatch_allowance_remaining:
          updated &&
          typeof updated === "object" &&
          "payg_dispatch_allowance_remaining" in updated &&
          typeof updated.payg_dispatch_allowance_remaining === "number"
            ? updated.payg_dispatch_allowance_remaining
            : 0,
        usage_today:
          updated && typeof updated === "object" && "usage_today" in updated && typeof updated.usage_today === "number"
            ? updated.usage_today
            : 0,
        monthly_renewal_date:
          updated && typeof updated === "object" && "monthly_renewal_date" in updated && typeof updated.monthly_renewal_date === "string"
            ? updated.monthly_renewal_date
            : null,
        monthly_active:
          updated && typeof updated === "object" && "monthly_active" in updated && typeof updated.monthly_active === "boolean"
            ? updated.monthly_active
            : false,
        is_trial_month:
          updated && typeof updated === "object" && "is_trial_month" in updated && typeof updated.is_trial_month === "boolean"
            ? updated.is_trial_month
            : false,
        trial_granted_by_admin:
          updated && typeof updated === "object" && "trial_granted_by_admin" in updated && typeof updated.trial_granted_by_admin === "boolean"
            ? updated.trial_granted_by_admin
            : false,
        trial_start_date:
          updated && typeof updated === "object" && "trial_start_date" in updated && typeof updated.trial_start_date === "string"
            ? updated.trial_start_date
            : null,
        trial_end_date:
          updated && typeof updated === "object" && "trial_end_date" in updated && typeof updated.trial_end_date === "string"
            ? updated.trial_end_date
            : null,
        trial_status:
          updated && typeof updated === "object" && "trial_status" in updated &&
          (updated.trial_status === "none" ||
            updated.trial_status === "active" ||
            updated.trial_status === "expired" ||
            updated.trial_status === "revoked")
            ? updated.trial_status
            : "none",
        internal_billing_note:
          updated && typeof updated === "object" && "internal_billing_note" in updated && typeof updated.internal_billing_note === "string"
            ? updated.internal_billing_note
            : null,
        success_fee_status:
          updated && typeof updated === "object" && "success_fee_status" in updated && typeof updated.success_fee_status === "string"
            ? updated.success_fee_status
            : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update provider";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { providerId } = await params;

  try {
    const supabase = createAdminSupabaseClient();
    const { error, count } = await supabase
      .from("job_providers")
      .delete({ count: "exact" })
      .eq("id", providerId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({ success: false, error: "Managed account not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete provider";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
