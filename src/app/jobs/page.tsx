import { JobsPageClient } from "@/components/jobs/JobsPageClient";
import type { JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import { getAppSessionUser } from "@/lib/auth/session";
import { loadJobsOverview } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    title?: string;
    role?: string;
    area?: string;
    postcode?: string;
    provider?: string;
    job_status?: string;
    fill_status?: string;
    payment_status?: string;
    broadcast_status?: string;
  }>;
}) {
  const params = await searchParams;
  const currentUser = await getAppSessionUser();
  const viewerProviderId = currentUser?.role === "job_provider" ? currentUser.providerId : undefined;
  const initialFilters = {
    status: params.status?.trim() ?? "",
    title: params.title?.trim() ?? "",
    role: params.role?.trim() ?? "",
    area: params.area?.trim() ?? "",
    postcode: params.postcode?.trim() ?? "",
    provider: params.provider?.trim() ?? "",
    job_status: params.job_status?.trim() ?? "",
    fill_status: params.fill_status?.trim() ?? params.status?.trim() ?? "",
    payment_status: params.payment_status?.trim() ?? "",
    broadcast_status: params.broadcast_status?.trim() ?? "",
  };

  let initialData: {
    jobs: JobOverviewRow[];
    providers: Array<{ provider_id: string; company_name: string }>;
    capabilities: { invoices: boolean };
    warningMessage: string;
    errorMessage: string;
  };

  try {
    const data = await loadJobsOverview({
      title: initialFilters.title,
      role: initialFilters.role,
      area: initialFilters.area,
      postcode: initialFilters.postcode,
      provider: initialFilters.provider,
      job_status: initialFilters.job_status,
      fill_status: initialFilters.fill_status,
      payment_status: initialFilters.payment_status,
      broadcast_status: initialFilters.broadcast_status,
    }, { viewerProviderId });

    initialData = {
      jobs: data.jobs,
      providers: data.providers.map((provider) => ({
        provider_id: String(provider.provider_id),
        company_name: String(provider.company_name),
      })),
      capabilities: data.capabilities,
      warningMessage: currentUser?.role === "job_provider" ? "" : data.warning,
      errorMessage: "",
    };
  } catch (error) {
    console.error("[JobsPage] failed", error);
    if (process.env.NODE_ENV === "development") {
      throw error;
    }

    initialData = {
      jobs: [],
      providers: [],
      capabilities: { invoices: false },
      warningMessage: "",
      errorMessage: error instanceof Error ? error.message : "Jobs could not be loaded right now.",
    };
  }

  return (
    <JobsPageClient
      initialFilters={initialFilters}
      initialData={initialData}
    />
  );
}
