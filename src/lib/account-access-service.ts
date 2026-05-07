import type { AdminProfile } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getAccountEntitlements, normalizeAccountTier, type ProviderAccountTier, type ProviderBillingStatus, type ProviderTrialAccessLevel, type ProviderTrialStatus } from "@/lib/provider-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AccessEventType = "grant_trial" | "extend_trial" | "revoke_trial" | "set_access";
export type ManagedAccountTable = "project_management_accounts" | "job_providers";

const accessSelect =
  "id, provider_id, name, email, account_tier, access_tier, access_status, admin_full_access, trial_access, trial_status, trial_access_level, trial_start_date, trial_end_date, trial_granted_by, trial_granted_at, trial_notes, dispatch_allowance_remaining, dispatch_access_source";

const providerSelect =
  "id, name, email, account_tier, access_tier, access_status, admin_full_access, trial_access, is_trial_month, trial_granted_by_admin, trial_status, trial_access_level, trial_start_date, trial_end_date, trial_granted_by, trial_granted_at, trial_notes, dispatch_allowance_remaining, dispatch_access_source, billing_status, monthly_active, active_subscription, payg_dispatch_allowance_remaining, payg_pack_type, monthly_renewal_date, internal_billing_note";

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDuration(value: unknown) {
  const duration = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(duration)) return 30;
  return Math.min(365, Math.max(1, Math.trunc(duration)));
}

function accessSnapshot(row: Record<string, unknown> | null | undefined) {
  return {
    access_tier: row?.access_tier ?? null,
    account_tier: row?.account_tier ?? null,
    access_status: row?.access_status ?? null,
    admin_full_access: row?.admin_full_access ?? null,
    trial_access: row?.trial_access ?? null,
    trial_status: row?.trial_status ?? null,
    trial_access_level: row?.trial_access_level ?? null,
    trial_start_date: row?.trial_start_date ?? null,
    trial_end_date: row?.trial_end_date ?? null,
    dispatch_allowance_remaining: row?.dispatch_allowance_remaining ?? row?.payg_dispatch_allowance_remaining ?? null,
    dispatch_access_source: row?.dispatch_access_source ?? null,
  };
}

function isActiveTrial(row: Record<string, unknown>) {
  if (row.trial_access !== true && row.is_trial_month !== true && row.trial_granted_by_admin !== true) return false;
  if (row.trial_status !== "active") return false;
  if (row.trial_access_level && row.trial_access_level !== "full_access") return false;
  if (typeof row.trial_start_date !== "string" || typeof row.trial_end_date !== "string") return false;
  const start = new Date(`${row.trial_start_date}T00:00:00Z`);
  const end = new Date(`${row.trial_end_date}T23:59:59Z`);
  const now = Date.now();
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getTime() <= now && end.getTime() > now;
}

function fallbackTier(row: Record<string, unknown>): { tier: ProviderAccountTier; source: string } {
  const activeSubscription =
    normalizeAccountTier(row.access_tier ?? row.account_tier) === "monthly_full_access" ||
    row.active_subscription === true ||
    row.monthly_active === true;
  if (activeSubscription) return { tier: "monthly_full_access", source: "monthly" };
  if (row.admin_full_access === true) return { tier: "manual_full_access", source: "manual_full_access" };
  if (Number(row.dispatch_allowance_remaining ?? row.payg_dispatch_allowance_remaining ?? 0) > 0 || row.payg_pack_type) {
    return { tier: "payg", source: "payg" };
  }
  return { tier: "free_preview", source: "free_preview" };
}

function rowForEntitlements(row: Record<string, unknown>) {
  const billingStatus: ProviderBillingStatus =
    row.billing_status === "active" ||
    row.billing_status === "inactive" ||
    row.billing_status === "past_due" ||
    row.billing_status === "expired" ||
    row.billing_status === "trial"
      ? row.billing_status
      : "trial";
  const trialStatus: ProviderTrialStatus =
    row.trial_status === "active" ||
    row.trial_status === "expired" ||
    row.trial_status === "revoked" ||
    row.trial_status === "none"
      ? row.trial_status
      : "none";
  const trialAccessLevel: ProviderTrialAccessLevel =
    row.trial_access_level === "full_access" || row.trial_access_level === "preview" ? row.trial_access_level : null;
  return {
    accessTier: typeof row.access_tier === "string" ? row.access_tier : null,
    accessStatus: typeof row.access_status === "string" ? row.access_status : null,
    accountTier: normalizeAccountTier(row.access_tier ?? row.account_tier),
    billingStatus,
    paygDispatchAllowanceRemaining: Number(row.dispatch_allowance_remaining ?? row.payg_dispatch_allowance_remaining ?? 0),
    monthlyActive: row.monthly_active === true,
    activeSubscription: row.active_subscription === true,
    trialAccess: row.trial_access === true,
    trialStatus,
    trialAccessLevel,
    trialStartDate: typeof row.trial_start_date === "string" ? row.trial_start_date : null,
    trialEndDate: typeof row.trial_end_date === "string" ? row.trial_end_date : null,
    adminFullAccess: row.admin_full_access === true,
  };
}

function stripCanonicalUnsupportedFields(payload: Record<string, unknown>) {
  const next = { ...payload };
  delete next.billing_status;
  delete next.monthly_active;
  delete next.active_subscription;
  delete next.payg_dispatch_allowance_remaining;
  delete next.payg_pack_type;
  delete next.is_trial_month;
  delete next.trial_granted_by_admin;
  delete next.monthly_renewal_date;
  delete next.internal_billing_note;
  return next;
}

export class ManagedAccountResolutionError extends Error {
  status: number;
  debug: Record<string, unknown>;

  constructor(message: string, status: number, debug: Record<string, unknown> = {}) {
    super(message);
    this.name = "ManagedAccountResolutionError";
    this.status = status;
    this.debug = debug;
  }
}

function normalizeLookupValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function maybeSingleBy(
  table: ManagedAccountTable,
  select: string,
  column: string,
  value: unknown,
) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;
  const supabase = createAdminSupabaseClient();
  const result = await supabase.from(table).select(select).eq(column, normalized).maybeSingle();
  if (result.error) return null;
  return (result.data as Record<string, unknown> | null) ?? null;
}

async function findProjectManagementAccount(seed: Record<string, unknown>) {
  return (
    (await maybeSingleBy("project_management_accounts", accessSelect, "id", seed.id)) ??
    (await maybeSingleBy("project_management_accounts", accessSelect, "provider_id", seed.id)) ??
    (await maybeSingleBy("project_management_accounts", accessSelect, "provider_id", seed.provider_id)) ??
    (await maybeSingleBy("project_management_accounts", accessSelect, "email", seed.email)) ??
    (await maybeSingleBy("project_management_accounts", accessSelect, "name", seed.name))
  );
}

async function findJobProvider(seed: Record<string, unknown>) {
  return (
    (await maybeSingleBy("job_providers", providerSelect, "id", seed.provider_id)) ??
    (await maybeSingleBy("job_providers", providerSelect, "id", seed.id)) ??
    (await maybeSingleBy("job_providers", providerSelect, "email", seed.email)) ??
    (await maybeSingleBy("job_providers", providerSelect, "name", seed.name))
  );
}

export async function resolveManagedAccount(input: {
  id?: string;
  sourceTable?: ManagedAccountTable;
  targetAccountId?: string;
  targetTable?: ManagedAccountTable;
}) {
  const targetAccountId = input.id ?? input.targetAccountId;
  const sourceTable = input.sourceTable ?? input.targetTable;
  if (!targetAccountId) {
    throw new ManagedAccountResolutionError("Managed account not found.", 404, {
      requestedId: targetAccountId ?? null,
      sourceTable: sourceTable ?? null,
      searchedTables: [],
    });
  }

  let canonicalAccount: Record<string, unknown> | null = null;
  let mirrorAccount: Record<string, unknown> | null = null;
  const searchedTables: ManagedAccountTable[] = [];
  let matchedTable: ManagedAccountTable | null = null;

  if (!sourceTable || sourceTable === "project_management_accounts") {
    searchedTables.push("project_management_accounts");
    canonicalAccount = await maybeSingleBy(
      "project_management_accounts",
      accessSelect,
      "id",
      targetAccountId,
    );
    if (canonicalAccount) matchedTable = "project_management_accounts";
  }

  if (!canonicalAccount && (!sourceTable || sourceTable === "job_providers")) {
    searchedTables.push("job_providers");
    mirrorAccount = await maybeSingleBy("job_providers", providerSelect, "id", targetAccountId);
    if (mirrorAccount) matchedTable = "job_providers";
  }

  if (canonicalAccount && !mirrorAccount) {
    mirrorAccount = await findJobProvider(canonicalAccount);
  }

  if (mirrorAccount && !canonicalAccount) {
    canonicalAccount = await findProjectManagementAccount(mirrorAccount);
  }

  const debug = {
    requestedId: targetAccountId,
    sourceTable: sourceTable ?? null,
    searchedTables,
    matchedTable,
    canonicalAccountId: canonicalAccount?.id ?? null,
    mirrorAccountId: mirrorAccount?.id ?? null,
    matchedEmail: canonicalAccount?.email ?? mirrorAccount?.email ?? null,
  };

  if (!canonicalAccount && !mirrorAccount) {
    throw new ManagedAccountResolutionError("Managed account not found.", 404, debug);
  }

  if (mirrorAccount && !canonicalAccount) {
    throw new ManagedAccountResolutionError(
      "Managed account found, but no linked login account exists. Create or link the client login account before granting access.",
      409,
      debug,
    );
  }

  return {
    canonicalAccount,
    canonicalTable: canonicalAccount ? "project_management_accounts" as const : null,
    mirrorAccount,
    mirrorTable: mirrorAccount ? "job_providers" as const : null,
    debug,
  };
}

export async function updateAccountAccess(input: {
  targetAccountId: string;
  targetTable?: "project_management_accounts" | "job_providers";
  eventType: AccessEventType;
  accessPatch: Record<string, unknown>;
  notes?: string | null;
  admin?: AdminProfile;
}) {
  const admin = input.admin ?? await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { canonicalAccount, mirrorAccount } = await resolveManagedAccount({
    targetAccountId: input.targetAccountId,
    targetTable: input.targetTable,
  });
  const primary = canonicalAccount;
  if (!primary) throw new ManagedAccountResolutionError("Unable to grant trial because the target account could not be resolved.", 422);

  const now = new Date().toISOString();
  const previousAccess = accessSnapshot(primary);
  const accessPatch: Record<string, unknown> = {
    ...input.accessPatch,
    access_updated_by: admin.user_id,
    access_updated_at: now,
    ...(input.notes ? { access_notes: input.notes } : {}),
  };

  let updatedCanonical: Record<string, unknown> | null = null;
  if (canonicalAccount) {
    let canonicalUpdate = await supabase
      .from("project_management_accounts")
      .update(accessPatch)
      .eq("id", String(canonicalAccount.id))
      .select(accessSelect)
      .maybeSingle();
    if (canonicalUpdate.error && canonicalUpdate.error.message.toLowerCase().includes("column")) {
      canonicalUpdate = await supabase
        .from("project_management_accounts")
        .update(stripCanonicalUnsupportedFields(accessPatch))
        .eq("id", String(canonicalAccount.id))
        .select(accessSelect)
        .maybeSingle();
    }
    if (canonicalUpdate.error) throw canonicalUpdate.error;
    updatedCanonical = canonicalUpdate.data as Record<string, unknown>;
  }

  let updatedMirror: Record<string, unknown> | null = null;
  if (mirrorAccount) {
    const mirrorPatch = {
      ...accessPatch,
      ...(accessPatch.trial_access === true ? { is_trial_month: true, trial_granted_by_admin: true } : {}),
      ...(accessPatch.trial_access === false ? { is_trial_month: false, trial_granted_by_admin: false } : {}),
      ...(accessPatch.trial_end_date ? { monthly_renewal_date: accessPatch.trial_end_date } : {}),
      ...(input.notes ? { internal_billing_note: input.notes } : {}),
    };
    const mirrorUpdate = await supabase
      .from("job_providers")
      .update(mirrorPatch)
      .eq("id", String(mirrorAccount.id))
      .select(providerSelect)
      .maybeSingle();
    if (mirrorUpdate.error) throw mirrorUpdate.error;
    updatedMirror = mirrorUpdate.data as Record<string, unknown>;
  }

  const updatedPrimary = updatedCanonical ?? updatedMirror ?? { ...primary, ...accessPatch };
  const newAccess = accessSnapshot(updatedPrimary);
  const accountTable = "project_management_accounts";
  const accountId = String((updatedCanonical ?? primary).id);
  const accountEmail = typeof updatedPrimary.email === "string" ? updatedPrimary.email : null;
  const accountName = typeof updatedPrimary.name === "string" ? updatedPrimary.name : null;

  const accountAccessEvent = await supabase
    .from("account_access_events")
    .insert({
      account_table: accountTable,
      account_id: accountId,
      account_email: accountEmail,
      account_name: accountName,
      actor_user_id: admin.user_id,
      actor_email: admin.email,
      actor_role: admin.role,
      event_type: input.eventType,
      previous_access: previousAccess,
      new_access: newAccess,
      reason: input.eventType,
      notes: input.notes ?? null,
    })
    .select("id")
    .maybeSingle();

  const adminActionEvent = await supabase
    .from("admin_action_events")
    .insert({
      actor_user_id: admin.user_id,
      actor_email: admin.email,
      actor_role: admin.role,
      action_type: input.eventType,
      target_table: accountTable,
      target_id: accountId,
      target_email: accountEmail,
      target_name: accountName,
      metadata: {
        canonical_account_id: updatedCanonical?.id ?? null,
        mirror_account_id: updatedMirror?.id ?? null,
        previous_access: previousAccess,
        new_access: newAccess,
      },
    })
    .select("id")
    .maybeSingle();

  const entitlements = getAccountEntitlements(rowForEntitlements(updatedPrimary));

  if (process.env.NODE_ENV !== "production") {
    console.debug("[account-access-update]", {
      adminUserId: admin.user_id,
      adminEmail: admin.email,
      targetSourceTable: input.targetTable ?? "job_providers",
      canonicalAccountId: updatedCanonical?.id ?? canonicalAccount?.id ?? null,
      mirrorAccountId: updatedMirror?.id ?? mirrorAccount?.id ?? null,
      targetEmail: accountEmail,
      previousAccessTier: previousAccess.access_tier,
      previousAccountTier: previousAccess.account_tier,
      newAccessTier: newAccess.access_tier,
      newAccountTier: newAccess.account_tier,
      trialStatus: newAccess.trial_status,
      trialEndDate: newAccess.trial_end_date,
      accountAccessEventId: accountAccessEvent.data?.id ?? null,
      adminActionEventId: adminActionEvent.data?.id ?? null,
    });
  }

  return {
    canonicalAccount: updatedCanonical,
    mirrorAccount: updatedMirror,
    entitlements,
    accountAccessEventId: accountAccessEvent.data?.id ?? null,
    adminActionEventId: adminActionEvent.data?.id ?? null,
  };
}

export function buildTrialAccessPatch(input: {
  action: "grant" | "extend" | "revoke";
  durationDays?: unknown;
  admin: AdminProfile;
  account: Record<string, unknown>;
  notes?: string | null;
}) {
  const now = new Date();
  const durationDays = parseDuration(input.durationDays);

  if (input.action === "revoke") {
    const fallback = fallbackTier(input.account);
    return {
      trial_access: false,
      trial_status: "revoked",
      access_status: "revoked",
      access_tier: fallback.tier,
      account_tier: fallback.tier,
      dispatch_access_source: fallback.source,
      ...(fallback.tier === "free_preview" ? { billing_status: "inactive" } : {}),
    };
  }

  const existingEnd =
    typeof input.account.trial_end_date === "string"
      ? new Date(`${input.account.trial_end_date}T23:59:59Z`)
      : null;
  const extensionBase =
    input.action === "extend" && existingEnd && !Number.isNaN(existingEnd.getTime()) && existingEnd.getTime() > now.getTime()
      ? existingEnd
      : now;
  const startDate =
    input.action === "extend" && isActiveTrial(input.account) && typeof input.account.trial_start_date === "string"
      ? input.account.trial_start_date
      : toDateString(now);

  return {
    access_tier: "trial_full_access",
    account_tier: "trial_full_access",
    access_status: "active",
    trial_access: true,
    trial_status: "active",
    trial_access_level: "full_access",
    trial_start_date: startDate,
    trial_end_date: toDateString(addDays(extensionBase, durationDays)),
    trial_granted_by: input.admin.user_id,
    trial_granted_at: now.toISOString(),
    trial_notes: input.notes ?? null,
    billing_status: "trial",
    dispatch_access_source: "trial",
  };
}
