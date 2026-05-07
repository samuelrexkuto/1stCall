import { AccountPageClient } from "@/components/account/AccountPageClient";
import { redirect } from "next/navigation";
import { getAppSessionUser } from "@/lib/auth/session";
import { loadProviderAccount } from "@/lib/provider-account";
import { getAccountEntitlements } from "@/lib/provider-access";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const currentUser = await getAppSessionUser();
  if (process.env.NODE_ENV !== "production") {
    console.debug("[account-route] mounted");
    console.debug("[account-guard] user=", currentUser?.role ?? "none");
  }

  if (!currentUser) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[account-redirect] reason=missing_session");
    }
    redirect("/login/job-provider?next=/account");
  }

  if (currentUser.role !== "job_provider") {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[account-redirect] reason=unauthorized_role");
    }
    redirect("/");
  }

  const provider = currentUser.providerId ? await loadProviderAccount(currentUser.providerId) : null;
  if (process.env.NODE_ENV !== "production" && provider) {
    const entitlements = getAccountEntitlements({
      accountTier: provider.accountTier,
      accessTier: provider.accessTier,
      accessStatus: provider.accessStatus,
      billingStatus: provider.billingStatus,
      paygPackType: provider.paygPackType,
      paygDispatchAllowanceTotal: provider.paygDispatchAllowanceTotal,
      paygDispatchAllowanceRemaining: provider.paygDispatchAllowanceRemaining,
      monthlyRenewalDate: provider.monthlyRenewalDate,
      monthlyActive: provider.monthlyActive,
      activeSubscription: provider.activeSubscription,
      trialAccess: provider.trialAccess,
      isTrialMonth: provider.isTrialMonth,
      trialGrantedByAdmin: provider.trialGrantedByAdmin,
      trialStartDate: provider.trialStartDate,
      trialEndDate: provider.trialEndDate,
      trialStatus: provider.trialStatus,
      trialAccessLevel: provider.trialAccessLevel,
      profileOpensThisMonth: provider.profileOpensThisMonth,
      fullAccess: provider.fullAccess,
      adminFullAccess: provider.adminFullAccess,
      accessLevel: provider.accessLevel,
    });
    console.debug("[account-entitlements]", {
      sessionUserId: currentUser.id,
      resolvedAccountId: provider.id,
      resolvedAccountEmail: provider.email,
      trialAccess: provider.trialAccess,
      trialStatus: provider.trialStatus,
      trialAccessLevel: provider.trialAccessLevel,
      trialStartDate: provider.trialStartDate,
      trialEndDate: provider.trialEndDate,
      hasActiveFullAccessTrial: entitlements.hasActiveFullAccessTrial,
      hasUnlimitedDispatches: entitlements.hasUnlimitedDispatches,
    });
  }

  const fallbackProvider = provider ?? {
    id: currentUser.providerId ?? "provider-unavailable",
    name: currentUser.providerName ?? currentUser.name ?? "Provider account",
    email: currentUser.email ?? null,
    avatarUrl: currentUser.avatarUrl ?? null,
    phone: null,
    town: null,
    postcode: null,
    accountTier: currentUser.accountTier ?? "free_preview",
    accessTier: null,
    accessStatus: null,
    billingStatus: currentUser.billingStatus ?? "trial",
    paygPackType: currentUser.paygPackType ?? null,
    paygDispatchAllowanceTotal: currentUser.paygDispatchAllowanceTotal ?? 0,
    paygDispatchAllowanceRemaining: currentUser.paygDispatchAllowanceRemaining ?? 0,
    usageToday: 0,
    monthlyRenewalDate: currentUser.monthlyRenewalDate ?? null,
    monthlyActive: currentUser.monthlyActive ?? false,
    activeSubscription: currentUser.monthlyActive ?? false,
    trialAccess: currentUser.trialAccess ?? false,
    isTrialMonth: false,
    trialGrantedByAdmin: false,
    trialStartDate: null,
    trialEndDate: null,
    trialStatus: "none",
    trialAccessLevel: null,
    fullAccess: false,
    adminFullAccess: false,
    accessLevel: null,
    dispatchAccessSource: null,
    profileOpensThisMonth: currentUser.profileOpensThisMonth ?? 0,
    compareActionsThisMonth: currentUser.compareActionsThisMonth ?? 0,
    manualDraftsUsed: currentUser.manualDraftsUsed ?? 0,
    trialGrantedBy: null,
    trialGrantedAt: null,
    trialNotes: null,
    internalBillingNote: null,
    successFeeStatus: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
  };

  return (
    <AccountPageClient
      initialAccount={fallbackProvider}
      initialNotice={provider ? "" : "Billing details unavailable right now. Showing the account details available from your current session."}
    />
  );
}
