import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { calculateWorkerPaymentSummary } from "@/lib/labour-payments";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function dateOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.slice(0, 10);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string; assignmentId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { jobId, assignmentId } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.payment_cycle === "weekly" || body.payment_cycle === "fortnightly") patch.payment_cycle = body.payment_cycle;
  if (
    [
      "not_ready",
      "preliminary_notice_sent",
      "approved_for_payment",
      "scheduled",
      "paid",
      "overdue",
      "held",
      "disputed",
      "cancelled",
    ].includes(body.payment_status)
  ) {
    patch.payment_status = body.payment_status;
    if (body.payment_status === "preliminary_notice_sent") patch.preliminary_notice_sent_at = new Date().toISOString();
  }
  if ("last_payment_date" in body) patch.last_payment_date = dateOrNull(body.last_payment_date);
  if ("next_payment_due_date" in body) patch.next_payment_due_date = dateOrNull(body.next_payment_due_date);
  if ("day_rate" in body) patch.day_rate = numberOrNull(body.day_rate);
  if ("payment_notes" in body) patch.payment_notes = typeof body.payment_notes === "string" ? body.payment_notes : null;

  try {
    const supabase = createAdminSupabaseClient();
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, starts_at, end_date, pay_rate")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) return NextResponse.json({ success: false, error: jobError.message }, { status: 500 });
    if (!job) return NextResponse.json({ success: false, error: "Job not found." }, { status: 404 });

    let { data: assignment, error } = await supabase
      .from("job_worker_assignments")
      .update(patch)
      .eq("id", assignmentId)
      .eq("job_id", jobId)
      .select("id, job_id, worker_id, assignment_status, requested_by_client, requested_rank, confirmed_start_date, confirmed_end_date, payment_cycle, payment_cycle_anchor_date, day_rate, worked_days_current_cycle, estimated_amount_due, payment_status, last_payment_date, next_payment_due_date, preliminary_notice_sent_at, payment_notes, created_at")
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    if (!assignment) return NextResponse.json({ success: false, error: "Labour payment assignment not found." }, { status: 404 });

    const summary = calculateWorkerPaymentSummary({
      assignment: assignment as Record<string, unknown>,
      job: job as Record<string, unknown>,
    });

    const recalculated = await supabase
      .from("job_worker_assignments")
      .update({
        worked_days_current_cycle: summary.workedDays,
        estimated_amount_due: summary.estimatedAmountDue,
        next_payment_due_date: summary.nextPaymentDueDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .select("id, job_id, worker_id, assignment_status, requested_by_client, requested_rank, payment_cycle, day_rate, worked_days_current_cycle, estimated_amount_due, payment_status, last_payment_date, next_payment_due_date, preliminary_notice_sent_at, payment_notes")
      .maybeSingle();

    if (!recalculated.error && recalculated.data) assignment = { ...assignment, ...recalculated.data };

    return NextResponse.json({
      success: true,
      labourPayment: {
        assignment_id: assignment.id,
        job_id: assignment.job_id,
        worker_id: assignment.worker_id,
        assignment_status: assignment.assignment_status,
        requested_by_client: Boolean(assignment.requested_by_client),
        requested_rank: assignment.requested_rank ?? null,
        payment_cycle: assignment.payment_cycle,
        payment_status: assignment.payment_status,
        last_payment_date: assignment.last_payment_date ?? null,
        next_payment_due_date: assignment.next_payment_due_date ?? summary.nextPaymentDueDate,
        day_rate: assignment.day_rate ?? summary.dayRate,
        worked_days_current_cycle: assignment.worked_days_current_cycle ?? summary.workedDays,
        estimated_amount_due: assignment.estimated_amount_due ?? summary.estimatedAmountDue,
        payment_receipt_status: assignment.payment_status === "paid" ? "received" : "pending",
        preliminary_payment_notice_status: assignment.preliminary_notice_sent_at ? "sent" : "not_sent",
        payment_notes: assignment.payment_notes ?? null,
        cycle_start: summary.cycleStart,
        cycle_end: summary.cycleEnd,
        is_estimated: summary.isEstimated,
        alert_due: summary.alertDue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update labour payment.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
