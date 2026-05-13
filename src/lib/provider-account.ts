import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  ProviderAccountTier,
  ProviderBillingStatus,
  ProviderPaygPackType,
  ProviderTrialAccessLevel,
} from "@/lib/auth/types";
import { normalizeAccountTier } from "@/lib/provider-access";
import {
  isDateExpired,
  isProviderTrialActive,
  type ProviderAccountRecord,
} from "@/lib/provider-account-shared";

export { isProviderTrialActive };
export type { ProviderAccountRecord };

function normalizePaygPackType(row: Record<string, unknown> | null): ProviderPaygPackType {
  const candidate = row?.payg_pack_type ?? row?.payg_pack;
  return candidate === "payg_3" || candidate === "payg_5" || candidate === "payg_10" ? candidate : null;
}

function normalizeBillingStatus(row: Record<string, unknown> | null): ProviderBillingStatus {
  return row?.billing_status === "trial" ||
    row?.billing_status === "active" ||
    row?.billing_status === "inactive" ||
    row?.billing_status === "past_due" ||
    row?.billing_status === "expired"
    ? row.billing_status
    : "trial";
}

function normalizeTrialStatus(row: Record<string, unknown> | null, isTrialMonth: boolean, trialEndDate: string | null) {
  const stored =
    row?.trial_status === "none" ||
    row?.trial_status === "active" ||
    row?.trial_status === "expired" ||
    row?.trial_status === "revoked"
      ? row.trial_status
      : null;

  if (stored === "revoked") return "revoked" as const;
  if ((isTrialMonth || stored === "active") && isDateExpired(trialEndDate)) {
    return "expired" as const;
  }

  if (stored) return stored;
  if (isTrialMonth) return "active" as const;
  return "none" as const;
}

function normalizeRow(row: Record<string, unknown> | null) {
  const isTrialMonth = typeof row?.is_trial_month === "boolean" ? row.is_trial_month : false;
  const trialAccess =
    typeof row?.trial_access === "boolean"
      ? row.trial_access
      : typeof row?.trial_granted_by_admin === "boolean"
        ? row.trial_granted_by_admin
        : isTrialMonth;
  const trialEndDate = typeof row?.trial_end_date === "string" ? row.trial_end_date : null;
  const trialStartDate = typeof row?.trial_start_date === "string" ? row.trial_start_date : null;
  const trialStatus = normalizeTrialStatus(row, isTrialMonth, trialEndDate);
  const trialExpired = trialStatus === "expired";
  const trialActive = isProviderTrialActive({
    trialAccess,
    isTrialMonth,
    trialGrantedByAdmin:
      typeof row?.trial_granted_by_admin === "boolean" ? row.trial_granted_by_admin : false,
    trialStatus,
    trialAccessLevel:
      row?.trial_access_level === "preview" || row?.trial_access_level === "full_access"
        ? (row.trial_access_level as ProviderTrialAccessLevel)
        : null,
    trialStartDate,
    trialEndDate,
  });
  const storedBillingStatus = normalizeBillingStatus(row);
  const billingStatus =
    trialActive && storedBillingStatus !== "active" ? "trial" : trialExpired ? "expired" : storedBillingStatus;
  const monthlyActive = trialExpired || trialStatus === "revoked"
    ? false
    : typeof row?.monthly_active === "boolean"
      ? row.monthly_active
      : false;

  return {
    accountTier: normalizeAccountTier(row?.access_tier ?? row?.account_tier) as ProviderAccountTier,
    accessTier: normalizeAccountTier(row?.access_tier ?? row?.account_tier),
    accessStatus: typeof row?.access_status === "string" ? row.access_status : null,
    billingStatus,
    paygPackType: normalizePaygPackType(row),
    paygDispatchAllowanceTotal:
      typeof row?.payg_dispatch_allowance_total === "number"
        ? row.payg_dispatch_allowance_total
        : typeof row?.payg_allowance_total === "number"
          ? row.payg_allowance_total
          : 0,
    paygDispatchAllowanceRemaining:
      typeof row?.payg_dispatch_allowance_remaining === "number"
        ? row.payg_dispatch_allowance_remaining
        : typeof row?.dispatch_allowance_remaining === "number"
          ? row.dispatch_allowance_remaining
        : typeof row?.payg_allowance_remaining === "number"
          ? row.payg_allowance_remaining
          : 0,
    usageToday: typeof row?.usage_today === "number" ? row.usage_today : 0,
    monthlyRenewalDate:
      typeof row?.monthly_renewal_date === "string" ? row.monthly_renewal_date : trialEndDate,
    monthlyActive,
    activeSubscription:
      typeof row?.active_subscription === "boolean" ? row.active_subscription : monthlyActive,
    trialAccess,
    isTrialMonth,
    trialGrantedByAdmin:
      typeof row?.trial_granted_by_admin === "boolean" ? row.trial_granted_by_admin : false,
    trialStartDate,
    trialEndDate,
    trialStatus,
    trialAccessLevel:
      row?.trial_access_level === "preview" || row?.trial_access_level === "full_access"
        ? (row.trial_access_level as ProviderTrialAccessLevel)
        : null,
    fullAccess: typeof row?.full_access === "boolean" ? row.full_access : false,
    adminFullAccess: typeof row?.admin_full_access === "boolean" ? row.admin_full_access : false,
    accessLevel: typeof row?.access_level === "string" ? row.access_level : null,
    dispatchAccessSource: typeof row?.dispatch_access_source === "string" ? row.dispatch_access_source : null,
    trialGrantedBy: typeof row?.trial_granted_by === "string" ? row.trial_granted_by : null,
    trialGrantedAt: typeof row?.trial_granted_at === "string" ? row.trial_granted_at : null,
    trialNotes: typeof row?.trial_notes === "string" ? row.trial_notes : null,
    internalBillingNote:
      typeof row?.internal_billing_note === "string" ? row.internal_billing_note : null,
    successFeeStatus: typeof row?.success_fee_status === "string" ? row.success_fee_status : null,
    stripeCustomerId: typeof row?.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    stripeSubscriptionId: typeof row?.stripe_subscription_id === "string" ? row.stripe_subscription_id : null,
    stripeSubscriptionStatus:
      typeof row?.stripe_subscription_status === "string" ? row.stripe_subscription_status : null,
  };
}

function getAvatarUrl(row: Record<string, unknown> | null) {
  for (const key of ["profile_image_url", "avatar_url", "profile_image", "image_url", "logo_url"]) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function getProfileImagePath(row: Record<string, unknown> | null) {
  const value = row?.profile_image_path ?? row?.avatar_path;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadProjectManagementAccessOverlay(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  providerId: string,
  providerEmail: string | null,
) {
  const selects = [
    "id, provider_id, name, email, account_tier, access_tier, access_status, access_updated_at, access_updated_by, access_notes, admin_full_access, trial_access, trial_status, trial_access_level, trial_start_date, trial_end_date, trial_granted_by, trial_granted_at, trial_notes, dispatch_allowance_remaining, dispatch_access_source",
    "id, provider_id, name, email",
  ] as const;

  for (const select of selects) {
    const byProviderId = await supabase
      .from("project_management_accounts")
      .select(select)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (!byProviderId.error && byProviderId.data) {
      return byProviderId.data as unknown as Record<string, unknown>;
    }

    if (providerEmail) {
      const byEmail = await supabase
        .from("project_management_accounts")
        .select(select)
        .eq("email", providerEmail)
        .maybeSingle();
      if (!byEmail.error && byEmail.data) {
        return byEmail.data as unknown as Record<string, unknown>;
      }
    }
  }

  return null;
}

function mergeProjectManagementAccess(
  providerRow: Record<string, unknown>,
  projectAccount: Record<string, unknown> | null,
) {
  if (!projectAccount) return providerRow;

  const merged = { ...providerRow };
  for (const key of [
    "name",
    "email",
    "account_tier",
    "access_tier",
    "access_status",
    "access_updated_at",
    "access_updated_by",
    "access_notes",
    "admin_full_access",
    "trial_access",
    "trial_status",
    "trial_access_level",
    "trial_start_date",
    "trial_end_date",
    "trial_granted_by",
    "trial_granted_at",
    "trial_notes",
    "dispatch_allowance_remaining",
    "dispatch_access_source",
  ]) {
    if (key in projectAccount && projectAccount[key] !== null && projectAccount[key] !== undefined) {
      merged[key] = projectAccount[key];
    }
  }

  return merged;
}

async function persistExpiredTrialIfNeeded(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  providerId: string,
  normalized: ReturnType<typeof normalizeRow>,
) {
  if (!(normalized.isTrialMonth && normalized.trialStatus === "expired")) {
    return;
  }

  const payload = {
    billing_status: "expired",
    monthly_active: false,
    trial_status: "expired",
    monthly_renewal_date: normalized.trialEndDate,
  };

  const primary = await supabase.from("job_providers").update(payload).eq("id", providerId);
  if (!primary.error) return;
  await supabase.from("job_providers").update(payload).eq("provider_id", providerId);
}

function normalizeProviderAccountRecord(
  providerId: string,
  row: Record<string, unknown> | null,
  usage: { profileOpensThisMonth: number; compareActionsThisMonth: number; manualDraftsUsed: number },
): ProviderAccountRecord {
  const normalized = normalizeRow(row);
  return {
    id: providerId,
    name: typeof row?.name === "string" ? row.name : "Unnamed provider",
    email: typeof row?.email === "string" ? row.email : null,
    avatarUrl: getAvatarUrl(row),
    profile_image_url: getAvatarUrl(row),
    profile_image_path: getProfileImagePath(row),
    phone: typeof row?.phone === "string" ? row.phone : null,
    town: typeof row?.town === "string" ? row.town : null,
    postcode: typeof row?.postcode === "string" ? row.postcode : null,
    ...usage,
    ...normalized,
  };
}

async function loadMonthlyUsageCounts(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  providerId: string,
) {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const result = await supabase
    .from("provider_audit_events")
    .select("event_type")
    .eq("provider_id", providerId)
    .gte("created_at", since);

  if (result.error || !Array.isArray(result.data)) {
    return { profileOpensThisMonth: 0, compareActionsThisMonth: 0, manualDraftsUsed: 0 };
  }

  return result.data.reduce(
    (acc, event) => {
      if (event.event_type === "profile_opened") acc.profileOpensThisMonth += 1;
      if (event.event_type === "compare_action_used") acc.compareActionsThisMonth += 1;
      if (event.event_type === "manual_job_draft_used") acc.manualDraftsUsed += 1;
      return acc;
    },
    { profileOpensThisMonth: 0, compareActionsThisMonth: 0, manualDraftsUsed: 0 },
  );
}

export async function loadProviderAccount(providerId: string): Promise<ProviderAccountRecord | null> {
  const supabase = createAdminSupabaseClient();
  const selects = [
    "id, name, email, avatar_url, avatar_path, profile_image_url, profile_image_path, phone, town, postcode, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, payg_pack, payg_allowance_total, payg_allowance_remaining, dispatch_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, active_subscription, access_tier, access_status, trial_access, is_trial_month, trial_granted_by_admin, trial_start_date, trial_end_date, trial_status, trial_access_level, trial_granted_by, trial_granted_at, trial_notes, internal_billing_note, success_fee_status, full_access, admin_full_access, access_level, dispatch_access_source",
    "id, name, email, avatar_url, profile_image_url, phone, town, postcode, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, payg_pack, payg_allowance_total, payg_allowance_remaining, dispatch_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, active_subscription, access_tier, access_status, trial_access, is_trial_month, trial_granted_by_admin, trial_start_date, trial_end_date, trial_status, trial_access_level, trial_granted_by, trial_granted_at, trial_notes, internal_billing_note, success_fee_status, full_access, admin_full_access, access_level, dispatch_access_source",
    "id, name, email, phone, town, postcode, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, is_trial_month, trial_granted_by_admin, trial_start_date, trial_end_date, trial_status, internal_billing_note, success_fee_status",
    "id, name, email, phone, town, postcode, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, success_fee_status",
    "id, name, email, phone, town, postcode",
  ] as const;
  const idColumns = ["id", "provider_id"] as const;

  for (const select of selects) {
    for (const idColumn of idColumns) {
      const result = await supabase
        .from("job_providers")
        .select(select)
        .eq(idColumn, providerId)
        .maybeSingle();

      if (!result.error && result.data) {
        const providerRow = result.data as unknown as Record<string, unknown>;
        const projectAccount = await loadProjectManagementAccessOverlay(
          supabase,
          providerId,
          typeof providerRow.email === "string" ? providerRow.email : null,
        );
        const mergedRow = mergeProjectManagementAccess(providerRow, projectAccount);
        await persistExpiredTrialIfNeeded(supabase, providerId, normalizeRow(mergedRow));
        const usage = await loadMonthlyUsageCounts(supabase, providerId);
        return normalizeProviderAccountRecord(providerId, mergedRow, usage);
      }
    }
  }

  return null;
}
