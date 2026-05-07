import { revalidatePath } from "next/cache";
import type { createAdminSupabaseClient } from "@/lib/supabase/admin";
export {
  BROADCAST_STATUS_LABELS,
  BROADCAST_STATUS_OPTIONS,
  BROADCAST_STATUSES,
  isBroadcastStatus,
  normaliseBroadcastStatus,
  type BroadcastStatus,
} from "@/lib/dispatch/broadcast-status-constants";
import {
  BROADCAST_STATUSES,
  normaliseBroadcastStatus,
  type BroadcastStatus,
} from "@/lib/dispatch/broadcast-status-constants";

const JOB_STATUS_SELECT = "id, broadcast_status, provider_id, title, required_role, updated_at";

export interface BroadcastStatusError {
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
}

export class BroadcastStatusUpdateError extends Error {
  code: string | null;
  details: string | null;
  hint: string | null;

  constructor(error: BroadcastStatusError) {
    super(error.message);
    this.name = "BroadcastStatusUpdateError";
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}

export function shouldMoveToAwaitingResponse(currentStatus: string | null | undefined) {
  return normaliseBroadcastStatus(currentStatus) === BROADCAST_STATUSES.READY;
}

export function toBroadcastStatusError(error: unknown, fallback = "Unable to update broadcast status."): BroadcastStatusError {
  if (!error || typeof error !== "object") {
    return {
      message: fallback,
      code: null,
      details: null,
      hint: null,
    };
  }

  const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  return {
    message: typeof value.message === "string" && value.message.trim() ? value.message : fallback,
    code: typeof value.code === "string" ? value.code : null,
    details: typeof value.details === "string" ? value.details : null,
    hint: typeof value.hint === "string" ? value.hint : null,
  };
}

function isSchemaMismatchError(error: { message?: string; code?: string | null } | null | undefined, columns?: string[]) {
  const message = (error?.message ?? "").toLowerCase();
  const code = (error?.code ?? "").toLowerCase();
  const schemaMismatch =
    code === "pgrst204" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the");

  if (!schemaMismatch) return false;
  if (!columns?.length) return true;
  return columns.some((column) => message.includes(column.toLowerCase()));
}

function throwBroadcastStatusError(error: unknown): never {
  throw new BroadcastStatusUpdateError(toBroadcastStatusError(error));
}

export async function updateJobBroadcastStatusRecord(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  input: {
    jobId: string;
    status: BroadcastStatus;
    allowCompletedDowngrade?: boolean;
    onlyWhenReady?: boolean;
  },
) {
  const currentJobResponse = await supabase
    .from("jobs")
    .select(JOB_STATUS_SELECT)
    .eq("id", input.jobId)
    .maybeSingle();

  if (currentJobResponse.error) {
    throwBroadcastStatusError(currentJobResponse.error);
  }

  if (!currentJobResponse.data) {
    throw new Error("Job not found.");
  }

  const currentStatus = normaliseBroadcastStatus(currentJobResponse.data.broadcast_status);
  if (
    currentStatus === BROADCAST_STATUSES.COMPLETED &&
    input.status !== BROADCAST_STATUSES.COMPLETED &&
    input.allowCompletedDowngrade !== true
  ) {
    return {
      job: currentJobResponse.data,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      changed: false,
    };
  }

  if (input.onlyWhenReady && !shouldMoveToAwaitingResponse(currentStatus)) {
    return {
      job: currentJobResponse.data,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      changed: false,
    };
  }

  const updatePayload = {
    broadcast_status: input.status,
    broadcast_time: new Date().toISOString(),
  };

  const updateResponse = await supabase
    .from("jobs")
    .update(updatePayload)
    .eq("id", input.jobId)
    .select(JOB_STATUS_SELECT)
    .maybeSingle();

  let updatedJob = updateResponse.data;

  if (updateResponse.error) {
    if (!isSchemaMismatchError(updateResponse.error, ["broadcast_time"])) {
      throwBroadcastStatusError(updateResponse.error);
    }

    const fallbackResponse = await supabase
      .from("jobs")
      .update({ broadcast_status: input.status })
      .eq("id", input.jobId)
      .select(JOB_STATUS_SELECT)
      .maybeSingle();

    if (fallbackResponse.error) {
      throwBroadcastStatusError(fallbackResponse.error);
    }

    updatedJob = fallbackResponse.data;
  }

  if (!updatedJob) {
    throw new Error("Broadcast status update did not return the updated job.");
  }

  return {
    job: updatedJob,
    previousStatus: currentStatus,
    newStatus: normaliseBroadcastStatus(updatedJob.broadcast_status),
    changed: currentStatus !== normaliseBroadcastStatus(updatedJob.broadcast_status),
  };
}

export function revalidateBroadcastStatusViews() {
  revalidatePath("/alerts", "page");
  revalidatePath("/jobs", "page");
  revalidatePath("/workers", "page");
  revalidatePath("/", "page");
  revalidatePath("/dashboard/job-provider", "page");
}
