import { AIJobIntakeWorkspace } from "@/components/dashboard/AIJobIntakeWorkspace";
import { HomeMapSection } from "@/components/dashboard/HomeMapSection";
import { SavedWorkersPanel } from "@/components/workers/SavedWorkersPanel";
import { getAppSessionUser } from "@/lib/auth/session";
import { getDashboardMapData } from "@/lib/dashboard";
import { loadJobsOverview } from "@/lib/jobs";
import { loadProviderAccount } from "@/lib/provider-account";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadWorkersOverview, mapJobsToDispatchOptions } from "@/lib/workers";

function createHomePageSupabaseClient() {
  try {
    return createAdminSupabaseClient();
  } catch (error) {
    console.warn("[home] Supabase is unavailable; rendering homepage with empty provider data.", {
      error: error instanceof Error ? error.message : "Unknown Supabase configuration error.",
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
    });
    return null;
  }
}

export default async function HomePage() {
  const currentUser = await getAppSessionUser();
  const supabase = createHomePageSupabaseClient();
  const viewerProviderId = currentUser?.role === "job_provider" ? currentUser.providerId : undefined;
  const [jobsData, providersData, mapData, workersData, providerAccount] = await Promise.all([
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
    }, { viewerProviderId }).catch(() => null),
    (async () => {
      if (!supabase) {
        return [] as Array<{ id: string; name: string }>;
      }

      try {
        const baseQuery = supabase
          .from("job_providers")
          .select("id, name")
          .order("name", { ascending: true });
        const result = await (viewerProviderId
          ? baseQuery.eq("id", viewerProviderId)
          : baseQuery);
        return result.data ?? [];
      } catch {
        return [] as Array<{ id: string; name: string }>;
      }
    })(),
    getDashboardMapData({
      viewerProviderId,
      limitedProviderView: currentUser?.role === "job_provider",
      includeJobs: Boolean(currentUser),
    }).catch(() => null),
    loadWorkersOverview({
      name: "",
      worker_type: "",
      primary_role: "",
      location: "",
      available_today: "",
    }).catch(() => null),
    viewerProviderId ? loadProviderAccount(viewerProviderId).catch(() => null) : Promise.resolve(null),
  ]);
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

  return (
    <main className="home-dashboard-main">
      <SavedWorkersPanel
        jobs={jobsData ? mapJobsToDispatchOptions(jobsData.jobs) : []}
        jobsUnavailable={!jobsData}
        mode={currentUser?.role === "job_provider" ? "job_provider" : "admin"}
        variant="stories"
        latestWorkers={workersData?.workers ?? []}
        providerAccessSeed={providerAccessSeed}
      />
      <div className="wide-ai-workspace">
        <AIJobIntakeWorkspace
          providers={providersData.map((provider: { id: string; name: string }) => ({
            provider_id: String(provider.id),
            company_name: provider.name,
          }))}
          currentProviderId={viewerProviderId}
          currentProviderName={currentUser?.providerName}
          detailHref="/ai-hiring-assistant"
          detailLabel="Open Detailed AI Hiring Assistance"
        />
      </div>
      <HomeMapSection
        initialData={mapData}
        jobs={jobsData?.jobs ?? []}
        workers={workersData?.workers ?? []}
      />
    </main>
  );
}
