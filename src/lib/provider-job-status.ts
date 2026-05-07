import { getProviderFacingPostcode } from "@/lib/provider-access";

type ProviderFacingJobLike = {
  job_title: string;
  trade_type?: string | null;
  area?: string | null;
  postcode?: string | null;
  workers_required?: number | null;
  workers_confirmed?: number | null;
  matching_workers?: unknown[] | null;
  broadcast_status?: string | null;
  job_status?: string | null;
};

export function getProviderFacingJobLocation(job: ProviderFacingJobLike) {
  if (job.area?.trim()) return job.area.trim();
  const outward = getProviderFacingPostcode(job.postcode ?? "");
  return outward || "Location withheld";
}

export function getProviderFacingJobUpdate(job: ProviderFacingJobLike) {
  const required = Number(job.workers_required ?? 0);
  const confirmed = Number(job.workers_confirmed ?? 0);
  const matchesCount = Array.isArray(job.matching_workers) ? job.matching_workers.length : 0;
  const broadcastStatus = (job.broadcast_status ?? "").toLowerCase();
  const jobStatus = (job.job_status ?? "").toLowerCase();

  if (required > 0 && confirmed >= required) {
    return {
      title: "Booking confirmed",
      detail: `${job.job_title} now has the required workforce confirmed.`,
    };
  }

  if (matchesCount > 0) {
    return {
      title: matchesCount > 1 ? "Shortlist updated" : "Responses received",
      detail: `${matchesCount} candidate${matchesCount === 1 ? "" : "s"} ready for your review.`,
    };
  }

  if (
    broadcastStatus.includes("done") ||
    broadcastStatus.includes("sent") ||
    broadcastStatus.includes("completed") ||
    broadcastStatus.includes("awaiting") ||
    broadcastStatus.includes("broadcasting")
  ) {
    return {
      title: "Awaiting response",
      detail: "Dispatch has been sent and responses are being gathered for review.",
    };
  }

  if (broadcastStatus.includes("ready") || broadcastStatus.includes("queued") || broadcastStatus.includes("draft")) {
    return {
      title: "Ready for dispatch",
      detail: "The job is prepared for dispatch and awaiting the next hiring action.",
    };
  }

  if (jobStatus === "filled" || jobStatus === "completed") {
    return {
      title: "Booking confirmed",
      detail: `${job.job_title} has progressed beyond sourcing.`,
    };
  }

  return {
    title: "Dispatch sent",
    detail: "Sourcing is in progress and suitable responses will appear here once received.",
  };
}
