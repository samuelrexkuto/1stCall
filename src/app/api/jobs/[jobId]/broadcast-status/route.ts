import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { releaseAcceptedWorkforceForJob } from "@/lib/accepted-workforce-release";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  BROADCAST_STATUS_LABELS,
  isBroadcastStatus,
  revalidateBroadcastStatusViews,
  normaliseBroadcastStatus,
  toBroadcastStatusError,
  updateJobBroadcastStatusRecord,
} from "@/lib/dispatch/broadcast-status";
import { z } from "zod";

const updateBroadcastStatusSchema = z.object({
  broadcast_status: z.string().trim().min(1),
});

function jsonError(message: string, status: number, extra?: Partial<ReturnType<typeof toBroadcastStatusError>>) {
  return NextResponse.json(
    {
      success: false,
      ok: false,
      error: {
        message,
        code: extra?.code ?? null,
        details: extra?.details ?? null,
        hint: extra?.hint ?? null,
      },
    },
    { status },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Admin access required.", 403);
  }

  const { jobId } = await params;
  if (!jobId) {
    return jsonError("Missing job id.", 400);
  }

  const json = await request.json();
  const parsed = updateBroadcastStatusSchema.safeParse(json);

  if (!parsed.success) {
    return jsonError("Invalid broadcast status.", 400, {
      details: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  const { broadcast_status } = parsed.data;

  try {
    const supabase = createAdminSupabaseClient();
    console.log("[broadcast-status] request", {
      jobId,
      requestedStatus: broadcast_status,
    });

    if (!isBroadcastStatus(broadcast_status)) {
      return jsonError("Invalid broadcast status.", 400, {
        details: `Allowed statuses are: broadcast ready, awaiting response, completed.`,
      });
    }

    const updateResult = await updateJobBroadcastStatusRecord(supabase, {
      jobId,
      status: broadcast_status,
      allowCompletedDowngrade: false,
    });
    const providerId = typeof updateResult.job.provider_id === "string" ? updateResult.job.provider_id : null;
    let providerName: string | null = null;
    if (providerId) {
      const providerResult = await supabase
        .from("job_providers")
        .select("name")
        .eq("id", providerId)
        .maybeSingle();
      if (!providerResult.error && providerResult.data?.name) {
        providerName = String(providerResult.data.name);
      }
    }
    const broadcastStatus = normaliseBroadcastStatus(updateResult.job.broadcast_status);
    let releaseResult: Awaited<ReturnType<typeof releaseAcceptedWorkforceForJob>> | null = null;
    if (broadcastStatus === "completed") {
      try {
        releaseResult = await releaseAcceptedWorkforceForJob(supabase, jobId);
      } catch (error) {
        console.error("[broadcast-status] accepted workforce release failed", {
          jobId,
          error,
        });
      }
    }

    // Revalidate affected pages to reflect status change
    try {
      revalidateBroadcastStatusViews();
    } catch (e) {
      console.error("Cache revalidation error:", e);
      // Don't fail if revalidation fails
    }

    console.log("[broadcast-status] success", {
      jobId,
      broadcastStatus,
    });

    return NextResponse.json({
      ok: true,
      message: `Broadcast status updated to ${BROADCAST_STATUS_LABELS[broadcastStatus]}.`,
      previousStatus: updateResult.previousStatus,
      newStatus: broadcastStatus,
      release: releaseResult,
      job: {
        id: String(updateResult.job.id),
        broadcast_status: broadcastStatus,
        provider_id: providerId,
        provider_name: providerName,
        title: typeof updateResult.job.title === "string" ? updateResult.job.title : null,
        required_role: typeof updateResult.job.required_role === "string" ? updateResult.job.required_role : null,
        updated_at: typeof updateResult.job.updated_at === "string" ? updateResult.job.updated_at : null,
      },
    });
  } catch (error) {
    const structuredError = toBroadcastStatusError(error, "Unable to update broadcast status.");
    console.error("[broadcast-status] failed", {
      jobId,
      requestedStatus: broadcast_status,
      code: structuredError.code,
      message: structuredError.message,
      details: structuredError.details,
      hint: structuredError.hint,
    });

    return jsonError(structuredError.message, 500, structuredError);
  }
}
