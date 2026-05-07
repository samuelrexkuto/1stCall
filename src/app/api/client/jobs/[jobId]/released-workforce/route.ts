import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import { RELEASED_WORKFORCE_SELECT, toWorkerAssignmentPayload, uuidSchema } from "@/lib/job-worker-release";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  console.log("[client-released-workforce] route reached", { jobId });

  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return NextResponse.json({ ok: false, message: "Provider access required." }, { status: 403 });
  }

  const parsedJobId = uuidSchema.safeParse(jobId);
  if (!parsedJobId.success) {
    return NextResponse.json({ ok: false, message: "Invalid job id." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const jobResult = await supabase
    .from("jobs")
    .select("id, provider_id, title, required_role, trade, selected_role, core_role, postcode, area, location_label, broadcast_status")
    .eq("id", jobId)
    .eq("provider_id", currentUser.providerId)
    .maybeSingle();

  if (jobResult.error) {
    console.error("[client-released-workforce] job load error", {
      jobId,
      currentUserRole: currentUser.role,
      providerId: currentUser.providerId,
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

  if (jobResult.data.broadcast_status !== "completed") {
    return NextResponse.json({ ok: true, job: jobResult.data, workers: [] });
  }

  const releaseResult = await supabase
    .from("job_worker_assignments")
    .select(RELEASED_WORKFORCE_SELECT, { count: "exact" })
    .eq("job_id", jobId)
    .eq("assignment_status", "released_to_client")
    .not("released_to_client_at", "is", null)
    .order("released_to_client_at", { ascending: true });

  if (releaseResult.error) {
    console.error("[client-released-workforce] released assignment error", {
      jobId,
      currentUserRole: currentUser.role,
      providerId: currentUser.providerId,
      code: releaseResult.error.code,
      message: releaseResult.error.message,
      details: releaseResult.error.details,
      hint: releaseResult.error.hint,
    });
    return NextResponse.json({ ok: false, message: "Unable to load released workforce." }, { status: 500 });
  }

  console.log("[client-released-workforce] counts", {
    jobId,
    currentUserRole: currentUser.role,
    providerId: currentUser.providerId,
    releasedAssignmentCount: releaseResult.count ?? releaseResult.data?.length ?? 0,
  });

  return NextResponse.json({
    ok: true,
    job: {
      id: String(jobResult.data.id),
      title: jobResult.data.title ?? null,
      role: jobResult.data.selected_role ?? jobResult.data.core_role ?? jobResult.data.trade ?? jobResult.data.required_role ?? null,
      postcode: jobResult.data.postcode ?? null,
      location: jobResult.data.location_label ?? jobResult.data.area ?? jobResult.data.postcode ?? null,
      broadcast_status: jobResult.data.broadcast_status,
    },
    workers: (releaseResult.data ?? []).map((row) => toWorkerAssignmentPayload(row as Record<string, unknown>)),
  });
}
