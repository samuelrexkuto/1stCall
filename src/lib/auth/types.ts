export type AppUserRole = "job_provider" | "admin";
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

export interface AppSessionUser {
  id: string;
  email: string;
  name?: string;
  role: AppUserRole;
  adminRole?: "owner" | "admin" | "support";
  providerId?: string;
  providerName?: string;
  avatarUrl?: string | null;
  accessBadgeLabel?: string;
  accountGroup?: "project_management" | "admin";
  accountTier?: ProviderAccountTier;
  billingStatus?: ProviderBillingStatus;
  paygPackType?: ProviderPaygPackType;
  paygDispatchAllowanceTotal?: number;
  paygDispatchAllowanceRemaining?: number;
  monthlyRenewalDate?: string | null;
  monthlyActive?: boolean;
  trialAccess?: boolean;
  isTrialMonth?: boolean;
  trialGrantedByAdmin?: boolean;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  trialStatus?: ProviderTrialStatus;
  trialAccessLevel?: ProviderTrialAccessLevel;
  profileOpensThisMonth?: number;
  compareActionsThisMonth?: number;
  manualDraftsUsed?: number;
}
