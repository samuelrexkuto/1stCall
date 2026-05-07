import type { ProviderOverviewRow } from "@/components/providers/ProviderOverviewTable";
import { normalizeAccountTier } from "@/lib/provider-access";
import { normalisePaymentReliabilityStatus } from "@/lib/provider-trust";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function isDateExpired(dateString: string | null | undefined) {
  if (!dateString) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const parsed = new Date(dateString.includes("T") ? dateString : `${dateString}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  parsed.setUTCHours(0, 0, 0, 0);
  return todayUtc > parsed.getTime();
}

export interface ProvidersOverviewPayload {
  providers: ProviderOverviewRow[];
}

export async function loadProvidersOverview(): Promise<ProvidersOverviewPayload> {
  console.log("[loadProvidersOverview] start");
  const supabase = createAdminSupabaseClient();
  const primary = await supabase
    .from("job_providers")
    .select(
      "id, name, email, phone, town, postcode, created_at, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, payg_pack, payg_allowance_total, payg_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, trial_access, is_trial_month, trial_granted_by_admin, trial_start_date, trial_end_date, trial_status, trial_access_level, internal_billing_note, success_fee_status, payment_reliability_status, invoices_issued_count, invoices_paid_on_time_count, invoices_paid_late_count, unpaid_invoices_count, part_paid_invoices_count, average_days_to_pay, longest_payment_delay_days, current_overdue_count, payment_disputes_count, contractor_payout_delay_incidents_count, last_payment_received_date, payment_reliability_note, payment_reliability_last_reviewed_at",
    )
    .order("created_at", { ascending: false });

  let data: Array<Record<string, unknown>> | null =
    (primary.data as Array<Record<string, unknown>> | null) ?? null;
  let error = primary.error;

  if (error) {
    const billingFallback = await supabase
      .from("job_providers")
      .select(
        "id, name, email, phone, town, postcode, created_at, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, success_fee_status",
      )
      .order("created_at", { ascending: false });
    data = (billingFallback.data as Array<Record<string, unknown>> | null) ?? null;
    error = billingFallback.error;
  }

  if (error) {
    const fallback = await supabase
      .from("job_providers")
      .select("id, name, email, phone, town, postcode, created_at")
      .order("created_at", { ascending: false });
    data = (fallback.data as Array<Record<string, unknown>> | null) ?? null;
    error = fallback.error;
  }

  if (error) {
    console.error("[loadProvidersOverview] failed", error);
    throw new Error(error.message);
  }

  const projectAccountsResult = await supabase
    .from("project_management_accounts")
    .select("id, provider_id, name, email, account_tier, access_tier, access_status, admin_full_access, trial_access, trial_status, trial_access_level, trial_start_date, trial_end_date, trial_granted_by, trial_granted_at, trial_notes, dispatch_allowance_remaining, dispatch_access_source");
  const projectAccounts = !projectAccountsResult.error && Array.isArray(projectAccountsResult.data)
    ? (projectAccountsResult.data as Array<Record<string, unknown>>)
    : [];
  const projectAccountByProviderId = new Map(projectAccounts.map((account) => [String(account.provider_id), account]));

  const accessEventsResult = await supabase
    .from("account_access_events")
    .select("account_id, event_type, actor_email, actor_role, notes, reason, created_at")
    .eq("account_table", "project_management_accounts")
    .order("created_at", { ascending: false })
    .limit(200);
  const accessEventsByAccountId = new Map<string, ProviderOverviewRow["latest_account_access_events"]>();
  if (!accessEventsResult.error && Array.isArray(accessEventsResult.data)) {
    for (const event of accessEventsResult.data as Array<Record<string, unknown>>) {
      const accountId = String(event.account_id ?? "");
      if (!accountId) continue;
      const current = accessEventsByAccountId.get(accountId) ?? [];
      if (current.length >= 5) continue;
      current.push({
        event_type: typeof event.event_type === "string" ? event.event_type : "access_event",
        actor_email: typeof event.actor_email === "string" ? event.actor_email : null,
        actor_role: typeof event.actor_role === "string" ? event.actor_role : null,
        notes: typeof event.notes === "string" ? event.notes : null,
        reason: typeof event.reason === "string" ? event.reason : null,
        created_at: typeof event.created_at === "string" ? event.created_at : new Date(0).toISOString(),
      });
      accessEventsByAccountId.set(accountId, current);
    }
  }

  const providers = (data ?? []).map((provider) => {
    const projectAccount = projectAccountByProviderId.get(String(provider.id));
    const accessRow = projectAccount ?? provider;
    const isTrialMonth =
      provider &&
      typeof provider === "object" &&
      "is_trial_month" in provider &&
      typeof provider.is_trial_month === "boolean"
        ? provider.is_trial_month
        : false;
    const trialAccess =
      provider &&
      typeof provider === "object" &&
      "trial_access" in accessRow &&
      typeof accessRow.trial_access === "boolean"
        ? accessRow.trial_access
        : isTrialMonth;
    const trialEndDate =
      provider &&
      typeof provider === "object" &&
      "trial_end_date" in accessRow &&
      typeof accessRow.trial_end_date === "string"
        ? accessRow.trial_end_date
        : null;
    const trialExpired = isTrialMonth && isDateExpired(trialEndDate);
    const trialStatus: NonNullable<ProviderOverviewRow["trial_status"]> =
      trialExpired
        ? "expired"
        : provider &&
            typeof provider === "object" &&
            "trial_status" in accessRow &&
            (accessRow.trial_status === "none" ||
              accessRow.trial_status === "active" ||
              accessRow.trial_status === "expired" ||
              accessRow.trial_status === "revoked")
          ? accessRow.trial_status
          : isTrialMonth
            ? "active"
            : "none";

    return {
      id: projectAccount && typeof projectAccount.id === "string" ? projectAccount.id : String(provider.id),
      sourceTable: projectAccount ? "project_management_accounts" as const : "job_providers" as const,
      provider_id: String(provider.id),
      name: typeof accessRow.name === "string" ? accessRow.name : typeof provider.name === "string" ? provider.name : "Unnamed provider",
      company_name: typeof accessRow.name === "string" ? accessRow.name : typeof provider.name === "string" ? provider.name : "Unnamed provider",
      email: typeof accessRow.email === "string" ? accessRow.email : typeof provider.email === "string" ? provider.email : null,
      phone: typeof provider.phone === "string" ? provider.phone : null,
      town: typeof provider.town === "string" ? provider.town : null,
      postcode: typeof provider.postcode === "string" ? provider.postcode : null,
      created_at: typeof provider.created_at === "string" ? provider.created_at : new Date(0).toISOString(),
      updated_at:
        provider &&
        typeof provider === "object" &&
        "updated_at" in provider &&
        typeof provider.updated_at === "string"
          ? provider.updated_at
          : null,
      account_tier: normalizeAccountTier(accessRow.access_tier ?? provider.account_tier),
      billing_status:
        provider && typeof provider === "object" && "billing_status" in provider && typeof provider.billing_status === "string"
          ? ((trialExpired ? "expired" : provider.billing_status) as ProviderOverviewRow["billing_status"])
          : "trial",
      usage_today:
        provider && typeof provider === "object" && "usage_today" in provider && typeof provider.usage_today === "number"
          ? provider.usage_today
          : 0,
      payg_pack_type:
        provider &&
        typeof provider === "object" &&
        (("payg_pack_type" in provider && typeof provider.payg_pack_type === "string") ||
          ("payg_pack" in provider && typeof provider.payg_pack === "string"))
          ? ((typeof provider.payg_pack_type === "string" ? provider.payg_pack_type : provider.payg_pack) as ProviderOverviewRow["payg_pack_type"])
          : null,
      payg_dispatch_allowance_total:
        provider &&
        typeof provider === "object" &&
        (("payg_dispatch_allowance_total" in provider && typeof provider.payg_dispatch_allowance_total === "number") ||
          ("payg_allowance_total" in provider && typeof provider.payg_allowance_total === "number"))
          ? (typeof provider.payg_dispatch_allowance_total === "number"
            ? provider.payg_dispatch_allowance_total
            : provider.payg_allowance_total as number)
          : 0,
      payg_dispatch_allowance_remaining:
        provider &&
        typeof provider === "object" &&
        (("payg_dispatch_allowance_remaining" in provider && typeof provider.payg_dispatch_allowance_remaining === "number") ||
          ("payg_allowance_remaining" in provider && typeof provider.payg_allowance_remaining === "number"))
          ? (typeof provider.payg_dispatch_allowance_remaining === "number"
            ? provider.payg_dispatch_allowance_remaining
            : provider.payg_allowance_remaining as number)
          : 0,
      monthly_renewal_date:
        provider &&
        typeof provider === "object" &&
        "monthly_renewal_date" in provider &&
        typeof provider.monthly_renewal_date === "string"
          ? provider.monthly_renewal_date
          : null,
      monthly_active:
        provider &&
        typeof provider === "object" &&
        "monthly_active" in provider &&
        typeof provider.monthly_active === "boolean"
          ? (trialExpired ? false : provider.monthly_active)
          : false,
      access_tier: typeof accessRow.access_tier === "string" ? accessRow.access_tier : null,
      access_status: typeof accessRow.access_status === "string" ? accessRow.access_status : null,
      admin_full_access: typeof accessRow.admin_full_access === "boolean" ? accessRow.admin_full_access : false,
      dispatch_access_source: typeof accessRow.dispatch_access_source === "string" ? accessRow.dispatch_access_source : null,
      trial_access: trialAccess,
      is_trial_month: isTrialMonth,
      trial_granted_by_admin:
        provider &&
        typeof provider === "object" &&
        "trial_granted_by_admin" in provider &&
        typeof provider.trial_granted_by_admin === "boolean"
          ? provider.trial_granted_by_admin
          : false,
      trial_start_date:
      provider &&
      typeof provider === "object" &&
        "trial_start_date" in accessRow &&
        typeof accessRow.trial_start_date === "string"
          ? accessRow.trial_start_date
          : null,
      trial_end_date: trialEndDate,
      trial_status: trialStatus,
      trial_access_level:
        provider &&
        typeof provider === "object" &&
        "trial_access_level" in accessRow &&
        (accessRow.trial_access_level === "preview" || accessRow.trial_access_level === "full_access")
          ? (accessRow.trial_access_level as ProviderOverviewRow["trial_access_level"])
          : null,
      trial_granted_by: typeof accessRow.trial_granted_by === "string" ? accessRow.trial_granted_by : null,
      trial_granted_at: typeof accessRow.trial_granted_at === "string" ? accessRow.trial_granted_at : null,
      trial_notes: typeof accessRow.trial_notes === "string" ? accessRow.trial_notes : null,
      internal_billing_note:
        provider &&
        typeof provider === "object" &&
        "internal_billing_note" in provider &&
        typeof provider.internal_billing_note === "string"
          ? provider.internal_billing_note
          : null,
      success_fee_status:
        provider &&
        typeof provider === "object" &&
        "success_fee_status" in provider &&
        typeof provider.success_fee_status === "string"
          ? provider.success_fee_status
          : null,
      stripe_customer_id:
        provider &&
        typeof provider === "object" &&
        "stripe_customer_id" in provider &&
        typeof provider.stripe_customer_id === "string"
          ? provider.stripe_customer_id
          : null,
      stripe_subscription_id:
        provider &&
        typeof provider === "object" &&
        "stripe_subscription_id" in provider &&
        typeof provider.stripe_subscription_id === "string"
          ? provider.stripe_subscription_id
          : null,
      stripe_subscription_status:
        provider &&
        typeof provider === "object" &&
        "stripe_subscription_status" in provider &&
        typeof provider.stripe_subscription_status === "string"
          ? provider.stripe_subscription_status
          : null,
      payment_reliability_status: normalisePaymentReliabilityStatus(
        provider && typeof provider === "object" ? provider.payment_reliability_status : null,
      ),
      invoices_issued_count:
        provider && typeof provider === "object" && typeof provider.invoices_issued_count === "number"
          ? provider.invoices_issued_count
          : 0,
      invoices_paid_on_time_count:
        provider && typeof provider === "object" && typeof provider.invoices_paid_on_time_count === "number"
          ? provider.invoices_paid_on_time_count
          : 0,
      invoices_paid_late_count:
        provider && typeof provider === "object" && typeof provider.invoices_paid_late_count === "number"
          ? provider.invoices_paid_late_count
          : 0,
      unpaid_invoices_count:
        provider && typeof provider === "object" && typeof provider.unpaid_invoices_count === "number"
          ? provider.unpaid_invoices_count
          : 0,
      part_paid_invoices_count:
        provider && typeof provider === "object" && typeof provider.part_paid_invoices_count === "number"
          ? provider.part_paid_invoices_count
          : 0,
      average_days_to_pay:
        provider && typeof provider === "object" && typeof provider.average_days_to_pay === "number"
          ? provider.average_days_to_pay
          : null,
      longest_payment_delay_days:
        provider && typeof provider === "object" && typeof provider.longest_payment_delay_days === "number"
          ? provider.longest_payment_delay_days
          : 0,
      current_overdue_count:
        provider && typeof provider === "object" && typeof provider.current_overdue_count === "number"
          ? provider.current_overdue_count
          : 0,
      payment_disputes_count:
        provider && typeof provider === "object" && typeof provider.payment_disputes_count === "number"
          ? provider.payment_disputes_count
          : 0,
      contractor_payout_delay_incidents_count:
        provider && typeof provider === "object" && typeof provider.contractor_payout_delay_incidents_count === "number"
          ? provider.contractor_payout_delay_incidents_count
          : 0,
      last_payment_received_date:
        provider && typeof provider === "object" && typeof provider.last_payment_received_date === "string"
          ? provider.last_payment_received_date
          : null,
      payment_reliability_note:
        provider && typeof provider === "object" && typeof provider.payment_reliability_note === "string"
          ? provider.payment_reliability_note
          : null,
      payment_reliability_last_reviewed_at:
        provider && typeof provider === "object" && typeof provider.payment_reliability_last_reviewed_at === "string"
          ? provider.payment_reliability_last_reviewed_at
          : null,
      latest_account_access_events:
        projectAccount && typeof projectAccount.id === "string"
          ? accessEventsByAccountId.get(projectAccount.id) ?? []
          : [],
    };
  });

  console.log("[loadProvidersOverview] success", { count: providers.length });

  return { providers };
}
