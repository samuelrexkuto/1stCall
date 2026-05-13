import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentAdminUser } from "@/lib/admin-auth";
import { getAppSessionUser } from "@/lib/auth/session";
import { getAccountEntitlements } from "@/lib/provider-access";
import { loadProviderAccount } from "@/lib/provider-account";

export const metadata = {
  title: "Workforce Dispatch Local",
  description: "Local testing shell for workforce dispatch forms and API routes",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const currentUser = await getAppSessionUser();
  let initialUser = currentUser;

  if (currentUser?.role === "admin") {
    const admin = await getCurrentAdminUser();
    initialUser = admin
      ? {
          ...currentUser,
          id: admin.user_id,
          email: admin.email,
          name: admin.display_name ?? admin.email,
          adminRole: admin.role,
          accountGroup: "admin",
        }
      : null;
  }

  if (currentUser?.role === "job_provider" && currentUser.providerId) {
    const provider = await loadProviderAccount(currentUser.providerId);
    if (provider) {
      const entitlements = getAccountEntitlements({
        accessTier: provider.accessTier,
        accessStatus: provider.accessStatus,
        accountTier: provider.accountTier,
        billingStatus: provider.billingStatus,
        paygDispatchAllowanceRemaining: provider.paygDispatchAllowanceRemaining,
        monthlyActive: provider.monthlyActive,
        activeSubscription: provider.activeSubscription,
        trialAccess: provider.trialAccess,
        trialStatus: provider.trialStatus,
        trialAccessLevel: provider.trialAccessLevel,
        trialStartDate: provider.trialStartDate,
        trialEndDate: provider.trialEndDate,
        adminFullAccess: provider.adminFullAccess,
        fullAccess: provider.fullAccess,
        accessLevel: provider.accessLevel,
      });
      initialUser = {
        ...currentUser,
        providerName: provider.name,
        accessBadgeLabel: entitlements.accountBadgeLabel,
        accountTier: provider.accountTier,
        billingStatus: provider.billingStatus,
        paygPackType: provider.paygPackType,
        paygDispatchAllowanceTotal: provider.paygDispatchAllowanceTotal,
        paygDispatchAllowanceRemaining: provider.paygDispatchAllowanceRemaining,
        monthlyRenewalDate: provider.monthlyRenewalDate,
        monthlyActive: provider.monthlyActive,
        trialAccess: provider.trialAccess,
        isTrialMonth: provider.isTrialMonth,
        trialGrantedByAdmin: provider.trialGrantedByAdmin,
        trialStartDate: provider.trialStartDate,
        trialEndDate: provider.trialEndDate,
        trialStatus: provider.trialStatus,
        trialAccessLevel: provider.trialAccessLevel,
        profileOpensThisMonth: provider.profileOpensThisMonth,
        compareActionsThisMonth: provider.compareActionsThisMonth,
        manualDraftsUsed: provider.manualDraftsUsed,
      };
    }
  }

  return (
    <html lang="en" data-theme="dark">
      {/* Browser extensions such as Grammarly can inject body attributes before hydration. */}
      <body
        suppressHydrationWarning
        style={{
          margin: 0,
        }}
      >
        <Theme
          appearance="inherit"
          accentColor="violet"
          grayColor="slate"
          radius="large"
          scaling="95%"
        >
          <AuthSessionProvider initialUser={initialUser}>
            <AppShell>{children}</AppShell>
          </AuthSessionProvider>
        </Theme>
      </body>
    </html>
  );
}
