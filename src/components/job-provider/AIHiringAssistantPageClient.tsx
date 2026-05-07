"use client";

import { AIHiringAssistant } from "@/components/job-provider/AIHiringAssistant";
import type { JobProviderJobHistoryRow } from "@/lib/job-provider-ai";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export function AIHiringAssistantPageClient({
  workers,
  recentJobs,
}: {
  workers: WorkerOverviewRow[];
  recentJobs: JobProviderJobHistoryRow[];
}) {
  return (
    <AIHiringAssistant
      workers={workers}
      recentJobs={recentJobs}
      title=""
      description=""
      hideJobRequestInput
    />
  );
}
