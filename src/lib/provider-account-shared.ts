import type {
  ProviderAccountTier,
  ProviderBillingStatus,
  ProviderPaygPackType,
  ProviderTrialAccessLevel,
  ProviderTrialStatus,
} from "@/lib/auth/types";

export interface ProviderAccountRecord {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  profile_image_url: string | null;
  profile_image_path: string | null;
  phone: string | null;
  town: string | null;
  postcode: string | null;
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
  dispatchAccessSource: string | null;
  trialGrantedBy: string | null;
  trialGrantedAt: string | null;
  trialNotes: string | null;
  internalBillingNote: string | null;
  successFeeStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  profileOpensThisMonth: number;
  compareActionsThisMonth: number;
  manualDraftsUsed: number;
}

function parseTrialBoundary(value: string, endOfDay: boolean) {
  const hasTime = value.includes("T");
  const parsed = new Date(hasTime ? value : `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (hasTime && endOfDay) parsed.setUTCHours(23, 59, 59, 999);
  if (hasTime && !endOfDay) parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

export function isProviderTrialActive(account: {
  trialAccess?: boolean | null;
  isTrialMonth?: boolean | null;
  trialGrantedByAdmin?: boolean | null;
  trialStatus?: ProviderTrialStatus | null;
  trialAccessLevel?: ProviderTrialAccessLevel;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
}) {
  if (account.trialAccess !== true) return false;
  if (account.trialStatus !== "active") return false;
  if (account.trialAccessLevel && account.trialAccessLevel !== "full_access") return false;
  if (!account.trialStartDate || !account.trialEndDate) return false;
  const start = parseTrialBoundary(account.trialStartDate, false);
  const end = parseTrialBoundary(account.trialEndDate, true);
  const now = Date.now();
  return Boolean(start && end && start.getTime() <= now && end.getTime() > now);
}

export function isDateExpired(dateString: string | null | undefined) {
  if (!dateString) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const parsed = parseTrialBoundary(dateString, false);
  if (!parsed) return false;
  return todayUtc > parsed.getTime();
}
