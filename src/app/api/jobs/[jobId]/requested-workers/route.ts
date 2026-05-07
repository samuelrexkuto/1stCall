import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import {
  getRequestedWorkerIdsFromBody,
  isUuid,
} from "@/lib/provider-requested-workforce";
import {
  loadRequestedWorkforceForJob,
} from "@/lib/jobs/loadRequestedWorkforce";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SAFE_ERROR = "Unable to update requested workforce. Please try again.";

function logSupabaseError(context: string, details: Record<string, unknown>) {
  console.error(`[requested-workers] ${context}`, details);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    console.log("[requested-workers] route reached", { jobId });
    const currentUser = await getAppSessionUser();

    console.log("[requested-workers] account context", {
      accountId: currentUser?.id ?? null,
      role: currentUser?.role ?? null,
      providerId: currentUser?.providerId ?? null,
    });

    if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
      return NextResponse.json({ success: false, error: "Provider access required." }, { status: 403 });
    }

    const body = await request.json().catch((error) => {
      console.error("[requested-workers] invalid JSON body", error);
      return null;
    });
    const workerIds = getRequestedWorkerIdsFromBody(body);
    console.log("[requested-workers] parsed worker ids", {
      workerIds,
    });

    if (!jobId || !isUuid(jobId)) {
      return NextResponse.json({ success: false, error: "Missing or invalid job id." }, { status: 400 });
    }

    const invalidWorkerIds = workerIds.filter((workerId) => !isUuid(workerId));
    if (invalidWorkerIds.length > 0) {
      return NextResponse.json({ success: false, error: "Selected workforce contains an invalid record." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, provider_id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      logSupabaseError("failed to load job", {
        jobId,
        code: jobError.code,
        message: jobError.message,
        details: jobError.details,
        hint: jobError.hint,
      });
      return NextResponse.json({ success: false, error: "Unable to load this job." }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ success: false, error: "Job not found." }, { status: 404 });
    }

    if (String(job.provider_id ?? "") !== currentUser.providerId) {
      return NextResponse.json({ success: false, error: "You can only request workforce for your own jobs." }, { status: 403 });
    }

    const providerId = String(job.provider_id);

    if (workerIds.length > 0) {
      const workerResult = await supabase
        .from("workers")
        .select("id, full_name, primary_role, town, postcode")
        .in("id", workerIds);

      if (workerResult.error) {
        console.error("[requested-workers] worker lookup failed", workerResult.error);
        logSupabaseError("failed to validate selected workers", {
          jobId,
          providerId,
          workerIds,
          code: workerResult.error.code,
          message: workerResult.error.message,
          details: workerResult.error.details,
          hint: workerResult.error.hint,
        });
        return NextResponse.json({ success: false, error: SAFE_ERROR }, { status: 500 });
      }

      const foundWorkerIds = new Set((workerResult.data ?? []).map((worker) => String(worker.id)));
      if (workerIds.some((workerId) => !foundWorkerIds.has(workerId))) {
        return NextResponse.json({
          ok: false,
          success: false,
          error: "One or more selected workers could not be found.",
          foundWorkerIds: Array.from(foundWorkerIds),
          requestedWorkerIds: workerIds,
        }, { status: 400 });
      }
    }

    let upsertedRows: unknown[] = [];
    if (workerIds.length > 0) {
      const now = new Date().toISOString();
      const upsertPayload = workerIds.map((workerId, index) => ({
        job_id: jobId,
        worker_id: workerId,
        provider_id: providerId,
        assignment_status: "requested",
        requested_by_client: true,
        requested_by_client_at: now,
        requested_rank: index + 1,
        dispatch_status: "requested",
        payment_cycle: "weekly",
        payment_status: "not_ready",
        updated_at: now,
      }));

      console.log("[requested-workers] upsert payload", upsertPayload);

      let upsertResult = await supabase.from("job_worker_assignments").upsert(
        upsertPayload,
        { onConflict: "job_id,worker_id" },
      ).select("*");

      if (upsertResult.error?.code === "42703" && upsertResult.error.message.includes("dispatch_status")) {
        const fallbackPayload = upsertPayload.map(({ dispatch_status: _dispatchStatus, ...row }) => row);
        upsertResult = await supabase.from("job_worker_assignments").upsert(
          fallbackPayload,
          { onConflict: "job_id,worker_id" },
        ).select("*");
      }

      if (upsertResult.error) {
        console.error("[requested-workers] upsert failed", upsertResult.error);
        return NextResponse.json({
          ok: false,
          success: false,
          error: upsertResult.error.message,
          details: upsertResult.error.details,
          hint: upsertResult.error.hint,
          code: upsertResult.error.code,
          jobId,
        }, { status: 500 });
      }

      upsertedRows = upsertResult.data ?? [];
      console.log("[requested-workers] upsert success", {
        count: upsertedRows.length || null,
      });
    }

    const { data: verifyRows, error: verifyError } = await supabase
      .from("job_worker_assignments")
      .select("*")
      .eq("job_id", jobId)
      .eq("requested_by_client", true)
      .order("requested_rank", { ascending: true });

    console.log("[requested-workers] verification rows after save", {
      jobId,
      count: verifyRows?.length || 0,
      verifyRows,
      verifyError,
    });

    if (verifyError) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: verifyError.message,
        code: verifyError.code,
        details: verifyError.details,
        hint: verifyError.hint,
      }, { status: 500 });
    }

    if (!verifyRows || verifyRows.length === 0) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: "Requested workforce was not saved to the database.",
        jobId,
      }, { status: 500 });
    }

    const persistedWorkerIds = new Set(verifyRows.map((row) => String(row.worker_id)));
    const missingPersistedIds = workerIds.filter((workerId) => !persistedWorkerIds.has(workerId));
    if (missingPersistedIds.length > 0) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: "Requested workforce was not fully saved. Please try again.",
        missingPersistedIds,
        savedAssignmentRows: verifyRows,
      }, { status: 500 });
    }

    const requestedWorkers = await loadRequestedWorkforceForJob(supabase, jobId, {
      viewerRole: currentUser.role,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      jobId,
      requestedWorkerIds: workerIds,
      requested_worker_ids: workerIds,
      savedAssignmentRows: verifyRows,
      upsertedRows,
      requestedWorkers,
      requestedWorkforce: requestedWorkers,
      requested_workers: requestedWorkers,
      client_requested_workforce: requestedWorkers,
    });
  } catch (error) {
    console.error("[requested-workers] unexpected failure", {
      error,
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json({ success: false, error: SAFE_ERROR }, { status: 500 });
  }
}
