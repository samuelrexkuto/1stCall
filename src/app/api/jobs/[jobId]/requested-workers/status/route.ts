import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = new Set([
  "requested",
  "dispatched",
  "accepted",
  "declined",
  "no_response",
]);

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const { jobId } = await params;
  const body = await request.json().catch(() => ({}));
  const workerId = body.workerId || body.worker_id;
  const dispatchStatus = body.dispatchStatus || body.dispatch_status;

  if (!isUuid(jobId) || !isUuid(workerId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid jobId or workerId." }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.has(dispatchStatus)) {
    return NextResponse.json({ ok: false, error: "Invalid dispatch status." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const supabase = createAdminSupabaseClient();
  const updatePayload: Record<string, any> = {
    dispatch_status: dispatchStatus,
    updated_at: now,
  };

  if (dispatchStatus === "accepted") {
    updatePayload.accepted_at = now;
    updatePayload.confirmed_for_job = true;
    updatePayload.confirmed_at = now;
  }

  if (dispatchStatus === "declined") {
    updatePayload.declined_at = now;
    updatePayload.confirmed_for_job = false;
  }

  if (dispatchStatus === "dispatched") {
    updatePayload.dispatched_at = now;
  }

  if (dispatchStatus === "no_response") {
    updatePayload.no_response_at = now;
  }

  const { data, error } = await supabase
    .from("job_worker_assignments")
    .update(updatePayload)
    .eq("job_id", jobId)
    .eq("worker_id", workerId)
    .eq("requested_by_client", true)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[requested-workers/status] update failed", {
      jobId,
      workerId,
      dispatchStatus,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Requested workforce assignment not found." },
      { status: 404 },
    );
  }

  const { data: acceptedRows, error: acceptedRowsError } = await supabase
    .from("job_worker_assignments")
    .select("worker_id")
    .eq("job_id", jobId)
    .eq("requested_by_client", true)
    .eq("dispatch_status", "accepted");

  if (acceptedRowsError) {
    return NextResponse.json({
      ok: false,
      error: acceptedRowsError.message,
      code: acceptedRowsError.code,
      details: acceptedRowsError.details,
      hint: acceptedRowsError.hint,
    }, { status: 500 });
  }

  const acceptedWorkerIds = (acceptedRows || [])
    .map((row) => row.worker_id)
    .filter(Boolean);

  const { error: jobUpdateError } = await supabase
    .from("jobs")
    .update({
      workers_confirmed: acceptedWorkerIds.length,
      headcount_confirmed: acceptedWorkerIds.length,
      confirmed_workforce_count: acceptedWorkerIds.length,
      confirmed_worker_ids: acceptedWorkerIds,
      updated_at: now,
    })
    .eq("id", jobId);

  if (jobUpdateError) {
    return NextResponse.json({
      ok: false,
      error: jobUpdateError.message,
      code: jobUpdateError.code,
      details: jobUpdateError.details,
      hint: jobUpdateError.hint,
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    assignment: data,
    workersConfirmed: acceptedWorkerIds.length,
    confirmedWorkforceCount: acceptedWorkerIds.length,
    confirmedWorkerIds: acceptedWorkerIds,
  });
}
