export type ProviderAccountTier =
  | "free_preview"
  | "trial_full_access"
  | "payg"
  | "monthly_full_access"
  | "manual_full_access";
export type ProviderBillingStatus = "trial" | "active" | "inactive" | "past_due" | "expired";
export type ProviderPaygPackType = "payg_3" | "payg_5" | "payg_10" | null;
export type ProviderTrialStatus = "none" | "active" | "expired" | "revoked";
export type ProviderTrialAccessLevel = "preview" | "full_access" | null;
export type ProviderUsageAuditEventType =
  | "profile_opened"
  | "pack_opened"
  | "shortlist_saved"
  | "compare_action_used"
  | "dispatch_requested"
  | "dispatch_allowance_consumed"
  | "worker_accepted"
  | "worker_engaged"
  | "success_fee_triggered"
  | "ai_trial_used"
  | "manual_job_draft_used";

export interface ProviderAccessState {
  accessTier: string | null;
  accessStatus: string | null;
  accountTier: ProviderAccountTier;
  billingStatus: ProviderBillingStatus;
  paygPackType: ProviderPaygPackType;
  paygDispatchAllowanceTotal: number;
  paygDispatchAllowanceRemaining: number;
  usageToday: number;
  monthlyRenewalDate: string | null;
  monthlyActive: boolean;
  activeSubscription: boolean;
  trialAccess: boolean;
  isTrialMonth: boolean;
  trialGrantedByAdmin: boolean;
  trialStartDate: string | null;
  trialEndDate: string | null;
  trialStatus: ProviderTrialStatus;
  trialAccessLevel: ProviderTrialAccessLevel;
  fullAccess: boolean;
  adminFullAccess: boolean;
  accessLevel: string | null;
  successFeeStatus?: string | null;
  profileOpensThisMonth: number;
  savedShortlistCount: number;
  compareActionsThisMonth: number;
  aiTrialsUsed: number;
  manualDraftsUsed: number;
}

function parseTrialBoundary(value: string, endOfDay: boolean) {
  const hasTime = value.includes("T");
  const parsed = new Date(hasTime ? value : `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (hasTime && endOfDay) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  if (hasTime && !endOfDay) {
    parsed.setUTCHours(0, 0, 0, 0);
  }
  return parsed;
}

export interface ProviderAccessSeed {
  accessTier?: string | null;
  accessStatus?: string | null;
  accountTier?: ProviderAccountTier | null;
  billingStatus?: ProviderBillingStatus | null;
  paygPackType?: ProviderPaygPackType;
  paygDispatchAllowanceTotal?: number | null;
  paygDispatchAllowanceRemaining?: number | null;
  monthlyRenewalDate?: string | null;
  monthlyActive?: boolean | null;
  activeSubscription?: boolean | null;
  trialAccess?: boolean | null;
  isTrialMonth?: boolean | null;
  trialGrantedByAdmin?: boolean | null;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  trialStatus?: ProviderTrialStatus | null;
  trialAccessLevel?: ProviderTrialAccessLevel;
  fullAccess?: boolean | null;
  adminFullAccess?: boolean | null;
  accessLevel?: string | null;
  profileOpensThisMonth?: number | null;
  compareActionsThisMonth?: number | null;
  manualDraftsUsed?: number | null;
  successFeeStatus?: string | null;
}

export interface AccountEntitlements {
  effectiveAccessType: "free_preview" | "trial_full_access" | "payg" | "monthly_full_access" | "manual_full_access";
  hasFullAccess: boolean;
  hasActiveSubscription: boolean;
  hasActiveFullAccessTrial: boolean;
  hasManualFullAccess: boolean;
  hasUnlimitedDispatches: boolean;
  hasPaygDispatchAccess: boolean;
  canPostJobs: boolean;
  canViewWorkforceProfiles: boolean;
  canRequestDispatch: boolean;
  canUseDispatchWorkflow: boolean;
  isFreePreview: boolean;
  isPayg: boolean;
  dispatchRemaining: number;
  profilePreviewLimit: number;
  profilePreviewRemaining: number;
  effectivePlanLabel: string;
  effectiveAccessLabel: string;
  accountBadgeLabel: string;
  trialEndsAt: string | null;
  dispatchAccessLabel: string;
  dispatchLimitLabel: string;
  dispatchAccessSource: "trial" | "monthly" | "manual_full_access" | "payg" | "free_preview";
  warningMessage: string | null;
  denialReason: string | null;
}

export interface ProviderAccessGateResult {
  allowed: boolean;
  message?: string;
}

export const MONTHLY_MEMBERSHIP_PRICE = 249;
export const PAYG_PACKS: Record<Exclude<ProviderPaygPackType, null>, { price: number; dispatches: number; label: string }> = {
  payg_3: { price: 39, dispatches: 3, label: "£39 / 3 dispatch requests" },
  payg_5: { price: 59, dispatches: 5, label: "£59 / 5 dispatch requests" },
  payg_10: { price: 99, dispatches: 10, label: "£99 / 10 dispatch requests" },
};

const STORAGE_KEY_PREFIX = "rd-provider-access";
const AUDIT_KEY_PREFIX = "rd-provider-audit";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function todayKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function providerStorageKey(providerId: string) {
  return `${STORAGE_KEY_PREFIX}:${providerId}`;
}

function providerAuditKey(providerId: string) {
  return `${AUDIT_KEY_PREFIX}:${providerId}`;
}

export function normalizeAccountTier(value: unknown): ProviderAccountTier {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ");

  if (
    normalized === "trial_full_access" ||
    normalized === "trial" ||
    normalized === "30-day trial - full access" ||
    normalized === "30 day trial" ||
    normalized === "full-access trial"
  ) {
    return "trial_full_access";
  }

  if (
    normalized === "monthly_full_access" ||
    normalized === "monthly" ||
    normalized === "monthly - full access" ||
    normalized === "monthly account"
  ) {
    return "monthly_full_access";
  }

  if (
    normalized === "manual_full_access" ||
    normalized === "full access" ||
    normalized === "full_access" ||
    normalized === "admin override" ||
    normalized === "admin_full_access"
  ) {
    return "manual_full_access";
  }

  if (normalized === "payg" || normalized === "pay as you go") {
    return "payg";
  }

  return "free_preview";
}

function baseState(): ProviderAccessState {
  return {
    accountTier: "free_preview",
    accessTier: "free_preview",
    accessStatus: null,
    billingStatus: "trial",
    paygPackType: null,
    paygDispatchAllowanceTotal: 0,
    paygDispatchAllowanceRemaining: 0,
    usageToday: 0,
    monthlyRenewalDate: null,
    monthlyActive: false,
    activeSubscription: false,
    trialAccess: false,
    isTrialMonth: false,
    trialGrantedByAdmin: false,
    trialStartDate: null,
    trialEndDate: null,
    trialStatus: "none",
    trialAccessLevel: null,
    fullAccess: false,
    adminFullAccess: false,
    accessLevel: null,
    successFeeStatus: null,
    profileOpensThisMonth: 0,
    savedShortlistCount: 0,
    compareActionsThisMonth: 0,
    aiTrialsUsed: 0,
    manualDraftsUsed: 0,
  };
}

export function normalizeProviderAccessState(
  input?: Partial<ProviderAccessState> | null,
): ProviderAccessState {
  const state = { ...baseState(), ...(input ?? {}) };
  state.accountTier = normalizeAccountTier(state.accountTier);
  state.accessTier = normalizeAccountTier(state.accessTier ?? state.accountTier);
  if (state.trialStatus === "active" && state.trialEndDate && !isTrialActive(state)) {
    state.trialStatus = "expired";
  }
  if (state.accountTier === "monthly_full_access" && state.billingStatus === "active" && state.monthlyActive) {
    state.monthlyActive = input?.monthlyActive ?? true;
  }
  state.activeSubscription = state.activeSubscription || state.monthlyActive;
  return state;
}

export function isTrialActive(
  state: Pick<ProviderAccessState, "trialAccess" | "trialStatus" | "trialStartDate" | "trialEndDate">,
) {
  if (state.trialAccess !== true) return false;
  if (state.trialStatus !== "active" || !state.trialStartDate || !state.trialEndDate) return false;
  const start = parseTrialBoundary(state.trialStartDate, false);
  const parsed = parseTrialBoundary(state.trialEndDate, true);
  const now = Date.now();
  return Boolean(start && parsed && start.getTime() <= now && parsed.getTime() > now);
}

export function getAccountEntitlements(account: Partial<ProviderAccessState> | null | undefined): AccountEntitlements {
  const state = normalizeProviderAccessState(account);
  const accessTier = normalizeAccountTier(state.accessTier ?? state.accountTier);
  const hasActiveSubscription =
    accessTier === "monthly_full_access" ||
    state.activeSubscription === true ||
    state.monthlyActive === true ||
    (state.accountTier === "monthly_full_access" && state.billingStatus === "active");
  const activeTrial = isTrialActive(state);
  const trialLevel = String(state.trialAccessLevel || "full_access").toLowerCase();
  const hasActiveFullAccessTrial =
    activeTrial &&
    accessTier === "trial_full_access" &&
    ["full_access", "full", "platform", "unlimited"].includes(trialLevel);
  const hasManualFullAccess =
    accessTier === "manual_full_access" ||
    state.fullAccess === true ||
    state.adminFullAccess === true ||
    String(state.accessLevel ?? "").toLowerCase() === "full_access";
  const dispatchRemaining = Math.max(0, Number(state.paygDispatchAllowanceRemaining || 0));
  const hasPaygDispatchAccess =
    !hasActiveSubscription &&
    !hasActiveFullAccessTrial &&
    !hasManualFullAccess &&
    dispatchRemaining > 0;
  const hasFullAccess = hasActiveSubscription || hasActiveFullAccessTrial || hasManualFullAccess;
  const hasUnlimitedDispatches = hasFullAccess;
  const profilePreviewLimit = 10;
  const profilePreviewRemaining = hasFullAccess || hasPaygDispatchAccess
    ? Number.POSITIVE_INFINITY
    : Math.max(0, profilePreviewLimit - state.profileOpensThisMonth);
  const isPayg = !hasFullAccess && (accessTier === "payg" || dispatchRemaining > 0);
  const isFreePreview = !hasFullAccess && dispatchRemaining <= 0;
  const dispatchAccessSource = hasActiveFullAccessTrial
    ? "trial"
    : hasActiveSubscription
      ? "monthly"
      : hasManualFullAccess
        ? "manual_full_access"
        : isPayg
          ? "payg"
          : "free_preview";
  const effectiveAccessType = hasActiveFullAccessTrial
    ? "trial_full_access"
    : hasActiveSubscription
      ? "monthly_full_access"
      : hasManualFullAccess
        ? "manual_full_access"
        : isPayg
          ? "payg"
          : "free_preview";
  const effectivePlanLabel = effectiveAccessType === "trial_full_access"
      ? "Full-access trial"
      : effectiveAccessType === "monthly_full_access"
        ? "Monthly — Full Access"
        : effectiveAccessType === "manual_full_access"
          ? "Full Access Account"
          : effectiveAccessType === "payg"
            ? "PAYG Account"
            : "Free Preview Account";
  const accountBadgeLabel = effectiveAccessType === "trial_full_access"
    ? "30-Day Trial — Full Access"
    : effectiveAccessType === "monthly_full_access"
      ? "Monthly — Full Access"
      : effectiveAccessType === "manual_full_access"
        ? "Full Access"
        : effectiveAccessType === "payg"
          ? "PAYG"
          : "Free Preview";
  const dispatchAccessLabel = hasUnlimitedDispatches ? "Unlimited" : String(dispatchRemaining);

  return {
    effectiveAccessType,
    hasFullAccess,
    hasActiveSubscription,
    hasActiveFullAccessTrial,
    hasManualFullAccess,
    hasUnlimitedDispatches,
    hasPaygDispatchAccess,
    canPostJobs: hasFullAccess || isPayg,
    canViewWorkforceProfiles: true,
    canRequestDispatch: hasFullAccess || hasPaygDispatchAccess,
    canUseDispatchWorkflow: hasFullAccess || hasPaygDispatchAccess,
    isFreePreview,
    isPayg,
    dispatchRemaining,
    profilePreviewLimit,
    profilePreviewRemaining,
    effectivePlanLabel,
    effectiveAccessLabel: effectivePlanLabel,
    accountBadgeLabel,
    trialEndsAt: hasActiveFullAccessTrial ? state.trialEndDate : null,
    dispatchAccessLabel,
    dispatchLimitLabel: dispatchAccessLabel,
    dispatchAccessSource,
    warningMessage: isFreePreview
      ? "Free Preview does not include dispatch requests. Upgrade to PAYG or Monthly."
      : null,
    denialReason:
      isFreePreview && profilePreviewRemaining <= 0
        ? "Free Preview includes up to 10 profile opens per month. Upgrade to continue reviewing more profiles."
        : null,
  };
}

export function getEffectiveProviderTier(state: ProviderAccessState): ProviderAccountTier {
  const entitlements = getAccountEntitlements(state);
  if (entitlements.effectiveAccessType === "trial_full_access") return "trial_full_access";
  if (entitlements.effectiveAccessType === "monthly_full_access") return "monthly_full_access";
  if (entitlements.effectiveAccessType === "manual_full_access") return "manual_full_access";
  if (entitlements.hasPaygDispatchAccess || state.accountTier === "payg") return "payg";
  return "free_preview";
}

function getLegacyEffectiveProviderTier(state: ProviderAccessState): ProviderAccountTier {
  if (state.accountTier === "monthly_full_access") {
    return state.billingStatus === "active" && state.monthlyActive ? "monthly_full_access" : "free_preview";
  }

  if (isTrialActive(state)) {
    return "trial_full_access";
  }

  if (state.accountTier === "payg") {
    return state.billingStatus === "inactive" || state.billingStatus === "expired" ? "free_preview" : "payg";
  }

  return "free_preview";
}

export function buildProviderAccessSeed(input?: ProviderAccessSeed | null): Partial<ProviderAccessState> {
  return {
    accountTier: normalizeAccountTier(input?.accountTier),
    billingStatus: input?.billingStatus ?? "trial",
    paygPackType: input?.paygPackType ?? null,
    paygDispatchAllowanceTotal: input?.paygDispatchAllowanceTotal ?? 0,
    paygDispatchAllowanceRemaining: input?.paygDispatchAllowanceRemaining ?? 0,
    monthlyRenewalDate: input?.monthlyRenewalDate ?? null,
    monthlyActive: input?.monthlyActive ?? false,
    activeSubscription: input?.activeSubscription ?? false,
    trialAccess: input?.trialAccess ?? false,
    isTrialMonth: input?.isTrialMonth ?? false,
    trialGrantedByAdmin: input?.trialGrantedByAdmin ?? false,
    trialStartDate: input?.trialStartDate ?? null,
    trialEndDate: input?.trialEndDate ?? null,
    trialStatus: input?.trialStatus ?? "none",
    trialAccessLevel: input?.trialAccessLevel ?? null,
    fullAccess: input?.fullAccess ?? false,
    adminFullAccess: input?.adminFullAccess ?? false,
    accessLevel: input?.accessLevel ?? null,
    accessTier: normalizeAccountTier(input?.accessTier ?? input?.accountTier),
    accessStatus: input?.accessStatus ?? null,
    profileOpensThisMonth: input?.profileOpensThisMonth ?? 0,
    compareActionsThisMonth: input?.compareActionsThisMonth ?? 0,
    manualDraftsUsed: input?.manualDraftsUsed ?? 0,
    successFeeStatus: input?.successFeeStatus ?? null,
  };
}

export function readProviderAccessState(providerId: string, initial?: Partial<ProviderAccessState> | null): ProviderAccessState {
  const fallback = normalizeProviderAccessState(initial);
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(providerStorageKey(providerId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProviderAccessState> & {
      monthKey?: string;
      dayKey?: string;
    };
    const normalized = normalizeProviderAccessState({
      ...fallback,
      savedShortlistCount: parsed.savedShortlistCount,
      aiTrialsUsed: parsed.aiTrialsUsed,
    });
    if (parsed.monthKey !== monthKey()) {
      normalized.aiTrialsUsed = 0;
    }
    return normalized;
  } catch {
    return fallback;
  }
}

export function writeProviderAccessState(providerId: string, state: ProviderAccessState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    providerStorageKey(providerId),
    JSON.stringify({
      ...state,
      monthKey: monthKey(),
      dayKey: todayKey(),
    }),
  );
}

export function updateProviderAccessState(
  providerId: string,
  updater: (current: ProviderAccessState) => ProviderAccessState,
  initial?: Partial<ProviderAccessState> | null,
) {
  const next = updater(readProviderAccessState(providerId, initial));
  writeProviderAccessState(providerId, next);
  return next;
}

export function recordProviderAuditEvent(
  providerId: string,
  type: ProviderUsageAuditEventType,
  metadata?: Record<string, string | number | boolean | null>,
) {
  if (typeof window !== "undefined") {
    void fetch("/api/provider-audit-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, metadata }),
    }).catch(() => undefined);
  }

  if (!canUseStorage()) return;
  try {
    const key = providerAuditKey(providerId);
    const raw = window.localStorage.getItem(key);
    const current = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(current) ? current : [];
    next.unshift({
      type,
      metadata: metadata ?? {},
      createdAt: new Date().toISOString(),
    });
    window.localStorage.setItem(key, JSON.stringify(next.slice(0, 500)));
  } catch {
    // no-op
  }
}

export async function postProviderAuditEvent(
  type: ProviderUsageAuditEventType,
  metadata?: Record<string, string | number | boolean | null | string[]>,
) {
  const response = await fetch("/api/provider-audit-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, metadata }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Unable to record provider event.");
  }
  return payload;
}

export function getTierLabel(state: ProviderAccessState) {
  const entitlements = getAccountEntitlements(state);
  if (state.billingStatus === "expired") return "Trial Expired";
  return entitlements.effectivePlanLabel;
}

export function getDispatchRemainingLabel(state: ProviderAccessState) {
  if (getAccountEntitlements(state).hasUnlimitedDispatches) return "Unlimited";
  return String(state.paygDispatchAllowanceRemaining);
}

export function canOpenProviderProfile(state: ProviderAccessState): ProviderAccessGateResult {
  const entitlements = getAccountEntitlements(state);
  if (!entitlements.isFreePreview || entitlements.profilePreviewRemaining > 0) {
    return { allowed: true };
  }
  return { allowed: false, message: entitlements.denialReason ?? undefined };
}

export function canSaveToShortlist(state: ProviderAccessState): ProviderAccessGateResult {
  if (getEffectiveProviderTier(state) !== "free_preview") return { allowed: true };
  if (state.savedShortlistCount >= 3) {
    return { allowed: false, message: "Free Preview allows up to 3 saved shortlist profiles. Upgrade to expand your hiring bench." };
  }
  return { allowed: true };
}

export function canCompareProfiles(state: ProviderAccessState, count: number): ProviderAccessGateResult {
  const effectiveTier = getEffectiveProviderTier(state);
  if (effectiveTier === "monthly_full_access" || effectiveTier === "trial_full_access" || effectiveTier === "manual_full_access") return { allowed: true };
  if (effectiveTier === "payg" && count <= 4) return { allowed: true };
  if (effectiveTier === "free_preview" && count <= 2) return { allowed: true };
  return {
    allowed: false,
    message:
      state.accountTier === "free_preview"
        ? "Free Preview allows comparison of up to 2 profiles at a time."
        : "PAYG allows comparison of up to 4 profiles at a time. Upgrade to Monthly for unrestricted compare workflow.",
  };
}

export function canUseAiAssistant(state: ProviderAccessState): ProviderAccessGateResult {
  if (getEffectiveProviderTier(state) !== "free_preview") return { allowed: true };
  if (state.aiTrialsUsed >= 1) {
    return { allowed: false, message: "Free Preview includes 1 AI Hiring Assistant trial. Upgrade to continue using AI-guided hiring workflow." };
  }
  return { allowed: true };
}

export function canCreateManualDraft(state: ProviderAccessState): ProviderAccessGateResult {
  if (getEffectiveProviderTier(state) !== "free_preview") return { allowed: true };
  if (state.manualDraftsUsed >= 1) {
    return { allowed: false, message: "Free Preview includes 1 manual job draft. Upgrade to PAYG or Monthly for ongoing job workflow access." };
  }
  return { allowed: true };
}

export function canDownloadTenderPack(state: ProviderAccessState): ProviderAccessGateResult {
  if (getEffectiveProviderTier(state) === "free_preview") {
    return { allowed: false, message: "Tender Confidence Pack download is available on PAYG and Monthly plans." };
  }
  return { allowed: true };
}

export function canRequestDispatch(state: ProviderAccessState): ProviderAccessGateResult {
  const entitlements = getAccountEntitlements(state);
  if (entitlements.hasFullAccess || entitlements.hasPaygDispatchAccess) return { allowed: true };
  return {
    allowed: false,
    message:
      entitlements.isFreePreview
        ? "Free Preview does not include dispatch requests. Upgrade to PAYG or Monthly."
        : "No PAYG dispatch requests remain. Buy another pack or upgrade to Monthly.",
  };
}

export function consumeDispatchAllowance(providerId: string, initial?: Partial<ProviderAccessState> | null) {
  return updateProviderAccessState(
    providerId,
    (current) => {
      if (current.accountTier === "payg" && current.paygDispatchAllowanceRemaining > 0) {
        return {
          ...current,
          paygDispatchAllowanceRemaining: current.paygDispatchAllowanceRemaining - 1,
          usageToday: current.usageToday + 1,
        };
      }
      if (current.accountTier === "monthly_full_access" || current.accountTier === "trial_full_access" || current.accountTier === "manual_full_access") {
        return { ...current, usageToday: current.usageToday + 1 };
      }
      return current;
    },
    initial,
  );
}

export function applyUsageEvent(providerId: string, event: ProviderUsageAuditEventType, initial?: Partial<ProviderAccessState> | null) {
  return updateProviderAccessState(
    providerId,
    (current) => {
      switch (event) {
        case "profile_opened":
          return { ...current, profileOpensThisMonth: current.profileOpensThisMonth + 1 };
        case "shortlist_saved":
          return { ...current, savedShortlistCount: current.savedShortlistCount + 1 };
        case "compare_action_used":
          return { ...current, compareActionsThisMonth: current.compareActionsThisMonth + 1 };
        case "ai_trial_used":
          return { ...current, aiTrialsUsed: current.aiTrialsUsed + 1 };
        case "manual_job_draft_used":
          return { ...current, manualDraftsUsed: current.manualDraftsUsed + 1 };
        default:
          return current;
      }
    },
    initial,
  );
}

export function syncSavedShortlistCount(providerId: string, count: number, initial?: Partial<ProviderAccessState> | null) {
  return updateProviderAccessState(
    providerId,
    (current) => ({ ...current, savedShortlistCount: count }),
    initial,
  );
}

export function maskPhone(value: string | null | undefined) {
  if (!value) return "-";
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 3) return "********";
  return `${digits.slice(0, 2)}*** ***${digits.slice(-3)}`;
}

export function maskEmail(value: string | null | undefined) {
  if (!value) return "-";
  const [local, domain] = value.split("@");
  if (!local || !domain) return "-";
  const visible = local.length <= 2 ? local[0] ?? "*" : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function maskTradeIdentity(input: {
  fullName: string;
  workerType: "tradesman" | "contractor";
  contractorType?: "multi_discipline" | "specialist" | null;
  specialistArea?: string | null;
}) {
  if (input.workerType === "tradesman") {
    const firstName = input.fullName.trim().split(/\s+/)[0] ?? "Tradesman";
    return `Tradesman: ${firstName}`;
  }

  if (input.specialistArea?.trim()) {
    return `Contractor: ${input.specialistArea.trim()} Contractor`;
  }

  if (input.contractorType === "multi_discipline") {
    return "Contractor: Multi-Discipline Contractor";
  }

  if (input.contractorType === "specialist") {
    return "Contractor: Specialist Contractor";
  }

  const trimmed = input.fullName.trim();
  if (!trimmed) return "Contractor: Contractor";
  return `Contractor: ${trimmed.slice(0, 2)}***`;
}

export function getOutwardPostcode(postcode: string | null | undefined) {
  if (!postcode?.trim()) return null;
  const trimmed = postcode.trim().toUpperCase();
  const match = trimmed.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/);
  if (match?.[1]) return match[1];
  return trimmed.split(/\s+/)[0] ?? null;
}

export function toGeneralArea(locationDisplay: string | null | undefined, town: string | null | undefined, postcode: string | null | undefined) {
  const outward = getOutwardPostcode(postcode) ?? getOutwardPostcode(locationDisplay) ?? getOutwardPostcode(town);
  const townLabel = toLimitedTownLabel(town) ?? toLimitedTownLabel(locationDisplay);

  if (townLabel && outward && !townLabel.toUpperCase().includes(outward)) {
    return `${townLabel} ${outward}`;
  }
  if (townLabel) return townLabel;
  if (outward) {
    return `${outward} area`;
  }
  if (locationDisplay?.trim()) {
    const [first] = locationDisplay.split(/[,/]/);
    return first.trim();
  }
  return "Area withheld";
}

function toLimitedTownLabel(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const withoutPostcode = value
    .trim()
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "")
    .split(/[,/]/)[0]
    ?.trim();
  return withoutPostcode || null;
}

export function formatLimitedLocation(input: {
  locationDisplay?: string | null;
  town?: string | null;
  postcode?: string | null;
}) {
  const outward = getOutwardPostcode(input.postcode) ?? getOutwardPostcode(input.locationDisplay) ?? getOutwardPostcode(input.town);
  const townLabel = toLimitedTownLabel(input.town) ?? toLimitedTownLabel(input.locationDisplay);
  if (townLabel && outward && !townLabel.toUpperCase().includes(outward)) return `${townLabel} ${outward}`;
  if (townLabel) return townLabel;
  if (outward) return outward;
  return toGeneralArea(input.locationDisplay, input.town, input.postcode);
}

type ProviderFacingWorkerIdentity = {
  full_name?: string | null;
  workerType?: "tradesman" | "contractor" | null;
  worker_type?: "tradesman" | "contractor" | null;
  contractorType?: "multi_discipline" | "specialist" | null;
  contractor_type?: "multi_discipline" | "specialist" | null;
  specialistArea?: string | null;
  specialist_area?: string | null;
  location_display?: string | null;
  town?: string | null;
  postcode?: string | null;
};

export function getProviderFacingPostcode(postcode: string | null | undefined) {
  return getOutwardPostcode(postcode) ?? "";
}

export function getProviderFacingContractorIdentity(worker: ProviderFacingWorkerIdentity) {
  const contractorType = worker.contractorType ?? worker.contractor_type ?? null;
  const specialistArea = worker.specialistArea ?? worker.specialist_area ?? null;
  return maskTradeIdentity({
    fullName: worker.full_name?.trim() ?? "",
    workerType: "contractor",
    contractorType,
    specialistArea,
  }).replace(/^Contractor:\s*/, "");
}

export function getProviderFacingDisplayName(worker: ProviderFacingWorkerIdentity) {
  const workerType = worker.workerType ?? worker.worker_type ?? "tradesman";
  const contractorType = worker.contractorType ?? worker.contractor_type ?? null;
  const specialistArea = worker.specialistArea ?? worker.specialist_area ?? null;
  return maskTradeIdentity({
    fullName: worker.full_name?.trim() ?? "",
    workerType,
    contractorType,
    specialistArea,
  }).replace(/^(Tradesman|Contractor):\s*/, "");
}

export function getProviderFacingLocationLabel(worker: ProviderFacingWorkerIdentity) {
  return formatLimitedLocation({
    locationDisplay: worker.location_display ?? null,
    town: worker.town ?? null,
    postcode: worker.postcode ?? null,
  });
}

export function getProviderFacingLocationText(value: string | null | undefined) {
  if (!value?.trim()) return "Location withheld";

  const trimmed = value.trim();
  const maskedPostcode = trimmed.replace(
    /\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/gi,
    "$1",
  );
  const segments = maskedPostcode
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    return segments[segments.length - 1] ?? maskedPostcode;
  }

  return maskedPostcode;
}

export function getSiteScoreStatusLabel(status: "insufficient" | "provisional" | "established" | null | undefined) {
  if (status === "established") return "Established Score";
  if (status === "provisional") return "Provisional Score";
  return "Insufficient Verified Data";
}
