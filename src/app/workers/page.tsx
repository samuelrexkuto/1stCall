import { WorkersPageClient } from "@/components/workers/WorkersPageClient";
import type { DispatchJobOption } from "@/components/workers/WorkerBroadcastModal";
import { getAppSessionUser } from "@/lib/auth/session";
import { loadJobsOverview } from "@/lib/jobs";
import { getAccountEntitlements, type ProviderAccessSeed } from "@/lib/provider-access";
import { loadProviderAccount } from "@/lib/provider-account";
import { loadWorkersOverview, mapJobsToDispatchOptions } from "@/lib/workers";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string;
    worker_type?: string;
    primary_role?: string;
    location?: string;
    available_today?: string;
  }>;
}) {
  const params = await searchParams;
  const currentUser = await getAppSessionUser();
  const viewerProviderId = currentUser?.role === "job_provider" ? currentUser.providerId : undefined;
  const initialFilters = {
    name: params.name?.trim() ?? "",
    worker_type: params.worker_type?.trim() ?? "",
    primary_role: params.primary_role?.trim() ?? "",
    location: params.location?.trim() ?? "",
    available_today: params.available_today?.trim() ?? "",
  };

  let initialData: {
    workers: WorkerOverviewRow[];
    jobs: DispatchJobOption[];
    jobsUnavailable: boolean;
    errorMessage: string;
    providerAccessSeed?: ProviderAccessSeed & { providerId: string; email: string | null; name: string };
  };

  try {
    const [workersData, jobsData] = await Promise.all([
      loadWorkersOverview(initialFilters),
      loadJobsOverview({
        title: "",
        role: "",
        area: "",
        postcode: "",
        provider: "",
        job_status: "",
        fill_status: "",
        payment_status: "",
        broadcast_status: "",
      }, { viewerProviderId }),
    ]);
    const providerAccount = viewerProviderId ? await loadProviderAccount(viewerProviderId) : null;
    const providerAccessSeed = providerAccount
      ? {
          providerId: providerAccount.id,
          email: providerAccount.email,
          name: providerAccount.name,
          accountTier: providerAccount.accountTier,
          accessTier: providerAccount.accessTier,
          accessStatus: providerAccount.accessStatus,
          billingStatus: providerAccount.billingStatus,
          paygPackType: providerAccount.paygPackType,
          paygDispatchAllowanceTotal: providerAccount.paygDispatchAllowanceTotal,
          paygDispatchAllowanceRemaining: providerAccount.paygDispatchAllowanceRemaining,
          monthlyRenewalDate: providerAccount.monthlyRenewalDate,
          monthlyActive: providerAccount.monthlyActive,
          activeSubscription: providerAccount.activeSubscription,
          trialAccess: providerAccount.trialAccess,
          isTrialMonth: providerAccount.isTrialMonth,
          trialGrantedByAdmin: providerAccount.trialGrantedByAdmin,
          trialStartDate: providerAccount.trialStartDate,
          trialEndDate: providerAccount.trialEndDate,
          trialStatus: providerAccount.trialStatus,
          trialAccessLevel: providerAccount.trialAccessLevel,
          profileOpensThisMonth: providerAccount.profileOpensThisMonth,
          compareActionsThisMonth: providerAccount.compareActionsThisMonth,
          manualDraftsUsed: providerAccount.manualDraftsUsed,
          successFeeStatus: providerAccount.successFeeStatus,
          fullAccess: providerAccount.fullAccess,
          adminFullAccess: providerAccount.adminFullAccess,
          accessLevel: providerAccount.accessLevel,
        }
      : undefined;

    if (process.env.NODE_ENV !== "production" && currentUser?.role === "job_provider") {
      const entitlements = getAccountEntitlements(providerAccessSeed);
      console.debug("[workforce-entitlements]", {
        sessionUserId: currentUser.id,
        resolvedAccountId: providerAccessSeed?.providerId ?? null,
        accountEmail: providerAccessSeed?.email ?? null,
        planTier: providerAccessSeed?.accountTier ?? null,
        billingStatus: providerAccessSeed?.billingStatus ?? null,
        dispatchAllowanceRemaining: providerAccessSeed?.paygDispatchAllowanceRemaining ?? null,
        trialAccess: providerAccessSeed?.trialAccess ?? null,
        trialStatus: providerAccessSeed?.trialStatus ?? null,
        trialAccessLevel: providerAccessSeed?.trialAccessLevel ?? null,
        trialStartDate: providerAccessSeed?.trialStartDate ?? null,
        trialEndDate: providerAccessSeed?.trialEndDate ?? null,
        activeSubscription: providerAccessSeed?.activeSubscription ?? null,
        monthlyActive: providerAccessSeed?.monthlyActive ?? null,
        effectiveAccessLabel: entitlements.effectiveAccessLabel,
        dispatchAccessLabel: entitlements.dispatchAccessLabel,
        canRequestDispatch: entitlements.canRequestDispatch,
        dispatchAccessSource: entitlements.dispatchAccessSource,
        hasUnlimitedDispatches: entitlements.hasUnlimitedDispatches,
      });
    }

    initialData = {
      workers: workersData.workers,
      jobs: mapJobsToDispatchOptions(jobsData.jobs),
      jobsUnavailable: false,
      errorMessage: "",
      providerAccessSeed,
    };
  } catch (error) {
    console.error("[WorkersPage] failed", error);
    if (process.env.NODE_ENV === "development") {
      throw error;
    }

    initialData = {
      workers: [],
      jobs: [],
      jobsUnavailable: true,
      errorMessage: error instanceof Error ? error.message : "Workers could not be loaded right now.",
    };
  }

  return (
    <WorkersPageClient
      initialFilters={initialFilters}
      initialData={initialData}
    />
  );
}
