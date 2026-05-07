import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppSessionUser, AppUserRole } from "@/lib/auth/types";
import { normalizeAccountTier } from "@/lib/provider-access";

export const APP_SESSION_COOKIE = "rd_app_session";

function encodeSession(user: AppSessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decodeSession(value: string): AppSessionUser | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.email === "string" &&
      (parsed.role === "job_provider" || parsed.role === "admin")
    ) {
      return {
        id: parsed.id,
        email: parsed.email,
        name: typeof parsed.name === "string" ? parsed.name : undefined,
        role: parsed.role,
        adminRole:
          parsed.adminRole === "owner" || parsed.adminRole === "admin" || parsed.adminRole === "support"
            ? parsed.adminRole
            : undefined,
        providerId: typeof parsed.providerId === "string" ? parsed.providerId : undefined,
        providerName: typeof parsed.providerName === "string" ? parsed.providerName : undefined,
        avatarUrl: typeof parsed.avatarUrl === "string" || parsed.avatarUrl === null ? parsed.avatarUrl : undefined,
        accessBadgeLabel: typeof parsed.accessBadgeLabel === "string" ? parsed.accessBadgeLabel : undefined,
        accountGroup:
          parsed.accountGroup === "project_management" || parsed.accountGroup === "admin"
            ? parsed.accountGroup
            : undefined,
        accountTier:
          typeof parsed.accountTier === "string" ? normalizeAccountTier(parsed.accountTier) : undefined,
        billingStatus:
          parsed.billingStatus === "trial" ||
          parsed.billingStatus === "active" ||
          parsed.billingStatus === "inactive" ||
          parsed.billingStatus === "past_due" ||
          parsed.billingStatus === "expired"
            ? parsed.billingStatus
            : undefined,
        paygPackType:
          parsed.paygPackType === "payg_3" || parsed.paygPackType === "payg_5" || parsed.paygPackType === "payg_10"
            ? parsed.paygPackType
            : undefined,
        paygDispatchAllowanceTotal:
          typeof parsed.paygDispatchAllowanceTotal === "number" ? parsed.paygDispatchAllowanceTotal : undefined,
        paygDispatchAllowanceRemaining:
          typeof parsed.paygDispatchAllowanceRemaining === "number" ? parsed.paygDispatchAllowanceRemaining : undefined,
        monthlyRenewalDate:
          typeof parsed.monthlyRenewalDate === "string" || parsed.monthlyRenewalDate === null
            ? parsed.monthlyRenewalDate
            : undefined,
        monthlyActive:
          typeof parsed.monthlyActive === "boolean" ? parsed.monthlyActive : undefined,
        trialAccess:
          typeof parsed.trialAccess === "boolean" ? parsed.trialAccess : undefined,
        isTrialMonth:
          typeof parsed.isTrialMonth === "boolean" ? parsed.isTrialMonth : undefined,
        trialGrantedByAdmin:
          typeof parsed.trialGrantedByAdmin === "boolean" ? parsed.trialGrantedByAdmin : undefined,
        trialStartDate:
          typeof parsed.trialStartDate === "string" || parsed.trialStartDate === null
            ? parsed.trialStartDate
            : undefined,
        trialEndDate:
          typeof parsed.trialEndDate === "string" || parsed.trialEndDate === null
            ? parsed.trialEndDate
            : undefined,
        trialStatus:
          parsed.trialStatus === "none" ||
          parsed.trialStatus === "active" ||
          parsed.trialStatus === "expired" ||
          parsed.trialStatus === "revoked"
            ? parsed.trialStatus
            : undefined,
        trialAccessLevel:
          parsed.trialAccessLevel === "preview" || parsed.trialAccessLevel === "full_access"
            ? parsed.trialAccessLevel
            : undefined,
        profileOpensThisMonth:
          typeof parsed.profileOpensThisMonth === "number" ? parsed.profileOpensThisMonth : undefined,
        compareActionsThisMonth:
          typeof parsed.compareActionsThisMonth === "number" ? parsed.compareActionsThisMonth : undefined,
        manualDraftsUsed:
          typeof parsed.manualDraftsUsed === "number" ? parsed.manualDraftsUsed : undefined,
      };
    }
  } catch {}

  return null;
}

export async function getAppSessionUser() {
  const store = await cookies();
  const raw = store.get(APP_SESSION_COOKIE)?.value;
  return raw ? decodeSession(raw) : null;
}

export async function requireAppRole(role: AppUserRole) {
  const user = await getAppSessionUser();
  if (!user || user.role !== role) {
    redirect(`/login/${role === "job_provider" ? "job-provider" : "admin"}`);
  }

  return user;
}

export function serializeAppSession(user: AppSessionUser) {
  return encodeSession(user);
}
