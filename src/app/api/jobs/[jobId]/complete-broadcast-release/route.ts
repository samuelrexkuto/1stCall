import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { RELEASED_WORKFORCE_SELECT, toWorkerAssignmentPayload, uuidSchema } from "@/lib/job-worker-release";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const NONE_SELECTED_MESSAGE =
  "No accepted workforce has been selected for release. Select accepted staff first, then complete the broadcast.";
const SUCCESS_MESSAGE =
  "Broadcast completed. Selected workforce details have been released to the client.";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  console.log("[complete-broadcast-release] route reached", { jobId });

  try {
    const admin = await requireAdmin();
    const parsedJobId = uuidSchema.safeParse(jobId);
    if (!parsedJobId.success) {
      return NextResponse.json({ ok: false, message: "Invalid job id." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const jobResult = await supabase
      .from("jobs")
      .select("id, provider_id, broadcast_status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobResult.error) {
      console.error("[complete-broadcast-release] job load error", {
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

    const counts = await supabase
      .from("job_worker_assignments")
      .select("id, assignment_status", { count: "exact" })
      .eq("job_id", jobId)
      .in("assignment_status", ["accepted", "selected_for_release", "released_to_client", "worker_accepted"]);

    const selected = await supabase
      .from("job_worker_assignments")
      .select("id, worker_id", { count: "exact" })
      .eq("job_id", jobId)
      .eq("assignment_status", "selected_for_release");

    if (counts.error || selected.error) {
      const error = counts.error ?? selected.error;
      console.error("[complete-broadcast-release] assignment count error", {
        jobId,
        providerId: jobResult.data.provider_id,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      return NextResponse.json({ ok: false, message: "Unable to inspect workforce assignments." }, { status: 500 });
    }

    console.log("[complete-broadcast-release] counts", {
      jobId,
      currentUserRole: admin.role,
      providerId: jobResult.data.provider_id,
      acceptedAssignmentCount: counts.count ?? counts.data?.length ?? 0,
      selectedAssignmentCount: selected.count ?? selected.data?.length ?? 0,
    });

    if ((selected.data ?? []).length === 0) {
      return NextResponse.json({ ok: false, message: NONE_SELECTED_MESSAGE }, { status: 400 });
    }

    const now = new Date().toISOString();
    const release = await supabase
      .from("job_worker_assignments")
      .update({
        assignment_status: "released_to_client",
        released_to_client: true,
        released_to_client_at: now,
        released_by_admin: admin.user_id,
        broadcast_completed: true,
        updated_at: now,
      })
      .eq("job_id", jobId)
      .eq("assignment_status", "selected_for_release")
      .select(RELEASED_WORKFORCE_SELECT);

    if (release.error) {
      console.error("[complete-broadcast-release] release update error", {
        jobId,
        adminId: admin.user_id,
        code: release.error.code,
        message: release.error.message,
        details: release.error.details,
        hint: release.error.hint,
      });
      return NextResponse.json({ ok: false, message: "Unable to release selected workforce details." }, { status: 500 });
    }

    const jobUpdate = await supabase
      .from("jobs")
      .update({ broadcast_status: "completed" })
      .eq("id", jobId);

    if (jobUpdate.error) {
      console.error("[complete-broadcast-release] job update error", {
        jobId,
        code: jobUpdate.error.code,
        message: jobUpdate.error.message,
        details: jobUpdate.error.details,
        hint: jobUpdate.error.hint,
      });
      return NextResponse.json({ ok: false, message: "Workforce released, but broadcast status could not be completed." }, { status: 500 });
    }

    console.log("[complete-broadcast-release] released", {
      jobId,
      releasedAssignmentCount: release.data?.length ?? 0,
    });

    revalidatePath("/alerts", "page");
    revalidatePath("/jobs", "page");

    return NextResponse.json({
      ok: true,
      message: SUCCESS_MESSAGE,
      released_count: release.data?.length ?? 0,
      workers: (release.data ?? []).map((row) => toWorkerAssignmentPayload(row as Record<string, unknown>)),
      released_worker_ids: (release.data ?? []).map((row) => String(row.worker_id)),
    });
  } catch (error) {
    console.error("[complete-broadcast-release] failed", { jobId, error });
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }
}
