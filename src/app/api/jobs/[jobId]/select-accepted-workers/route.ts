import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { RELEASED_WORKFORCE_SELECT, toWorkerAssignmentPayload, uuidSchema } from "@/lib/job-worker-release";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  console.log("[select-accepted-workers] route reached", { jobId });

  try {
    const admin = await requireAdmin();
    const parsedJobId = uuidSchema.safeParse(jobId);
    if (!parsedJobId.success) {
      return NextResponse.json({ ok: false, message: "Invalid job id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    console.log("[select-accepted-workers] body", body);
    const rawWorkerIds =
      body?.workerIds ||
      body?.worker_ids ||
      body?.selectedWorkerIds ||
      body?.acceptedWorkerIds ||
      body?.accepted_worker_ids ||
      [];
    const workerIds = Array.isArray(rawWorkerIds)
      ? [...new Set(rawWorkerIds.filter(Boolean).map((workerId) => String(workerId)))]
      : [];

    if (workerIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No accepted workers selected.",
        receivedBody: body,
      }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const jobResult = await supabase.from("jobs").select("id").eq("id", jobId).maybeSingle();
    if (jobResult.error) {
      console.error("[select-accepted-workers] job load error", {
        jobId,
        code: jobResult.error.code,
        message: jobResult.error.message,
        details: jobResult.error.details,
        hint: jobResult.error.hint,
      });
      return NextResponse.json({ ok: false, message: "Unable to load job." }, { status: 500 });
    }
    if (!jobResult.data) {
      return NextResponse.json({ ok: false, message: "Job not found." }, { status: 404 });
    }

    const accepted = await supabase
      .from("job_worker_assignments")
      .select("*")
      .eq("job_id", jobId)
      .eq("requested_by_client", true)
      .eq("dispatch_status", "accepted")
      .in("worker_id", workerIds);

    if (accepted.error) {
      console.error("[select-accepted-workers] accepted row load error", {
        jobId,
        workerIds,
        code: accepted.error.code,
        message: accepted.error.message,
        details: accepted.error.details,
        hint: accepted.error.hint,
      });
      return NextResponse.json({
        ok: false,
        error: accepted.error.message,
        code: accepted.error.code,
        details: accepted.error.details,
        hint: accepted.error.hint,
      }, { status: 500 });
    }

    const acceptedWorkerIds = (accepted.data ?? []).map((row) => String(row.worker_id));
    if ((accepted.data?.length ?? 0) !== workerIds.length) {
      return NextResponse.json({
        ok: false,
        error: "Selected workforce must have accepted this dispatch before release.",
        selectedWorkerIds: workerIds,
        acceptedWorkerIds,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update = await supabase
      .from("job_worker_assignments")
      .update({
        confirmed_for_job: true,
        confirmed_at: now,
        assignment_status: "selected_for_release",
        selected_for_release_at: now,
        updated_at: now,
      })
      .eq("job_id", jobId)
      .eq("requested_by_client", true)
      .eq("dispatch_status", "accepted")
      .in("worker_id", workerIds)
      .select(RELEASED_WORKFORCE_SELECT);

    if (update.error) {
      console.error("[select-accepted-workers] update error", {
        jobId,
        workerIds,
        adminId: admin.user_id,
        code: update.error.code,
        message: update.error.message,
        details: update.error.details,
        hint: update.error.hint,
      });
      return NextResponse.json({
        ok: false,
        error: update.error.message,
        code: update.error.code,
        details: update.error.details,
        hint: update.error.hint,
      }, { status: 500 });
    }

    const confirmedCount = update.data?.length ?? 0;
    const jobUpdate = await supabase
      .from("jobs")
      .update({
        workers_confirmed: confirmedCount,
        headcount_confirmed: confirmedCount,
        confirmed_workforce_count: confirmedCount,
        confirmed_worker_ids: workerIds,
        updated_at: now,
      })
      .eq("id", jobId)
      .select("*")
      .single();

    if (jobUpdate.error) {
      return NextResponse.json({
        ok: false,
        error: jobUpdate.error.message,
        code: jobUpdate.error.code,
        details: jobUpdate.error.details,
        hint: jobUpdate.error.hint,
      }, { status: 500 });
    }

    console.log("[select-accepted-workers] counts", {
      jobId,
      currentUserRole: admin.role,
      selectedAssignmentCount: confirmedCount,
    });

    return NextResponse.json({
      ok: true,
      message: "Selected accepted workforce has been attached to this job.",
      job: jobUpdate.data,
      confirmedWorkerIds: workerIds,
      workersConfirmed: confirmedCount,
      confirmedWorkforceCount: confirmedCount,
      confirmedAssignments: update.data,
      selected_count: confirmedCount,
      workers: (update.data ?? []).map((row) => toWorkerAssignmentPayload(row as Record<string, unknown>)),
    });
  } catch (error) {
    console.error("[select-accepted-workers] failed", { jobId, error });
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }
}
