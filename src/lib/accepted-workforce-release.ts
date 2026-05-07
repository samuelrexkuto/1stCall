import { revalidatePath } from "next/cache";

export const ACCEPTED_WORKFORCE_ALERT_TYPE = "accepted_workforce_released";

export function getReleasedAcceptedWorkers(job: {
  matching_workers?: Array<{
    accepted_by_worker?: boolean;
    released_to_client?: boolean;
  }>;
}) {
  return (job.matching_workers ?? []).filter(
    (worker) => worker.accepted_by_worker && worker.released_to_client,
  );
}

export async function releaseAcceptedWorkforceForJob(
  supabase: {
    from: (table: string) => any;
  },
  jobId: string,
) {
  const now = new Date().toISOString();
  const accepted = await supabase
    .from("job_worker_assignments")
    .select("id, worker_id")
    .eq("job_id", jobId)
    .eq("assignment_status", "selected_for_release");

  if (accepted.error) {
    throw accepted.error;
  }

  const rows = accepted.data ?? [];
  if (rows.length === 0) {
    return {
      releasedCount: 0,
      releasedWorkerIds: [] as string[],
    };
  }

  const ids = rows.map((row: { id: unknown }) => String(row.id));
  const releasedWorkerIds = rows.map((row: { worker_id: unknown }) => String(row.worker_id));
  const update = await supabase
    .from("job_worker_assignments")
    .update({
      broadcast_completed: true,
      released_to_client: true,
      released_to_client_at: now,
      assignment_status: "released_to_client",
      updated_at: now,
    })
    .in("id", ids);

  if (update.error) {
    throw update.error;
  }

  revalidatePath("/alerts", "page");
  revalidatePath("/jobs", "page");

  return {
    releasedCount: releasedWorkerIds.length,
    releasedWorkerIds,
  };
}
