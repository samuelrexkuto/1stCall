import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAppSessionUser } from "@/lib/auth/session";
import {
  BROADCAST_STATUSES,
  type BroadcastStatus,
  revalidateBroadcastStatusViews,
  shouldMoveToAwaitingResponse,
  updateJobBroadcastStatusRecord,
  toBroadcastStatusError,
} from "@/lib/dispatch/broadcast-status";

export async function updateJobBroadcastStatus(input: {
  jobId: string;
  status: BroadcastStatus;
  providerId?: string;
  onlyWhenReady?: boolean;
}) {
  try {
    const currentUser = await getAppSessionUser();
    
    // Only admin can update broadcast status
    if (currentUser?.role !== "admin") {
      return {
        success: false,
        error: "Admin access required to update broadcast status.",
      };
    }

    const { jobId, status, providerId } = input;

    // Validate status
    if (!Object.values(BROADCAST_STATUSES).includes(status)) {
      return {
        success: false,
        error: `Invalid broadcast status: ${status}`,
      };
    }

    const supabase = createAdminSupabaseClient();

    const result = await updateJobBroadcastStatusRecord(supabase, {
      jobId,
      status,
      allowCompletedDowngrade: false,
      onlyWhenReady: input.onlyWhenReady,
    });

    if (providerId && result.job.provider_id !== providerId) {
      return {
        success: false,
        error: "Provider ID mismatch.",
      };
    }

    // Revalidate affected pages
    try {
      revalidateBroadcastStatusViews();
    } catch (e) {
      console.error("Cache revalidation error:", e);
      // Don't fail if revalidation fails
    }

    return {
      success: true,
      message: `Broadcast status updated to ${status}.`,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
    };
  } catch (error) {
    const structuredError = toBroadcastStatusError(error, "Unable to update broadcast status.");
    console.error("[updateJobBroadcastStatus] unexpected failure", {
      jobId: input.jobId,
      requestedStatus: input.status,
      code: structuredError.code,
      message: structuredError.message,
      details: structuredError.details,
      hint: structuredError.hint,
    });
    return {
      success: false,
      ok: false,
      error: structuredError.message,
      details: structuredError,
    };
  }
}

export { BROADCAST_STATUSES, shouldMoveToAwaitingResponse };
