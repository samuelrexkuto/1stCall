import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  ACCEPTED_ASSIGNMENT_STATUSES,
  RELEASED_WORKFORCE_SELECT,
  toWorkerAssignmentPayload,
  uuidSchema,
} from "@/lib/job-worker-release";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  console.log("[accepted-workers] route reached", { jobId });

  try {
    const admin = await requireAdmin();
    const parsedJobId = uuidSchema.safeParse(jobId);
    if (!parsedJobId.success) {
      return NextResponse.json({ ok: false, message: "Invalid job id." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data, error, count } = await supabase
      .from("job_worker_assignments")
      .select(RELEASED_WORKFORCE_SELECT, { count: "exact" })
      .eq("job_id", jobId)
      .or(
        `assignment_status.in.(${ACCEPTED_ASSIGNMENT_STATUSES.join(",")}),and(requested_by_client.eq.true,dispatch_status.eq.accepted)`,
      )
      .order("accepted_at", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("[accepted-workers] Supabase error", {
        jobId,
        adminId: admin.user_id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ ok: false, message: "Unable to load accepted workforce." }, { status: 500 });
    }

    console.log("[accepted-workers] counts", {
      jobId,
      currentUserRole: admin.role,
      acceptedAssignmentCount: count ?? data?.length ?? 0,
    });

    return NextResponse.json({
      ok: true,
      workers: (data ?? []).map((row) => toWorkerAssignmentPayload(row as Record<string, unknown>)),
    });
  } catch (error) {
    console.error("[accepted-workers] failed", { jobId, error });
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }
}
