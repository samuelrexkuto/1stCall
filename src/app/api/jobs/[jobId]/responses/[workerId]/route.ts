import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string; workerId: string }> },
) {
  const { jobId, workerId } = await params;
  const body = (await request.json()) as {
    responseType?: "accepted" | "declined" | "no_response";
  };

  const responseType = body.responseType;

  if (!responseType) {
    return NextResponse.json({ error: "Response type is required." }, { status: 400 });
  }

  try {
    await query(
      `
        insert into response_log (
          job_id,
          worker_id,
          sent_time,
          channel,
          delivered,
          read,
          response_type,
          response_time,
          selected,
          reserve
        )
        values (
          $1::uuid,
          $2::uuid,
          timezone('utc', now()),
          'manual',
          true,
          true,
          $3,
          timezone('utc', now()),
          $3 = 'accepted',
          false
        )
        on conflict (job_id, worker_id)
        do update set
          response_type = excluded.response_type,
          response_time = excluded.response_time,
          read = true,
          selected = excluded.selected
      `,
      [jobId, workerId, responseType],
    );

    if (responseType === "accepted") {
      await query(
        `
          insert into bookings (
            job_id,
            worker_id,
            booking_status,
            confirmed_time
          )
          values ($1::uuid, $2::uuid, 'confirmed', timezone('utc', now()))
          on conflict (job_id, worker_id)
          do update set
            booking_status = 'confirmed',
            confirmed_time = timezone('utc', now())
        `,
        [jobId, workerId],
      );

      const supabase = createAdminSupabaseClient();
      const acceptedAt = new Date().toISOString();
      const assignmentResult = await supabase.from("job_worker_assignments").upsert(
        {
          job_id: jobId,
          worker_id: workerId,
          assignment_status: "accepted",
          accepted_at: acceptedAt,
          accepted_by_worker: true,
          accepted_by_worker_at: acceptedAt,
          payment_cycle: "weekly",
          payment_status: "not_ready",
          updated_at: acceptedAt,
        },
        { onConflict: "job_id,worker_id" },
      );

      if (assignmentResult.error) {
        console.warn("[worker-response] accepted assignment upsert failed", {
          jobId,
          workerId,
          code: assignmentResult.error.code,
          message: assignmentResult.error.message,
          details: assignmentResult.error.details,
          hint: assignmentResult.error.hint,
        });
      }
    } else {
      await query(
        `
          delete from bookings
          where job_id = $1::uuid
            and worker_id = $2::uuid
        `,
        [jobId, workerId],
      );

      const supabase = createAdminSupabaseClient();
      const assignmentResult = await supabase
        .from("job_worker_assignments")
        .update({
          accepted_by_worker: false,
          accepted_at: null,
          accepted_by_worker_at: null,
          assignment_status: responseType === "declined" ? "rejected" : "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("worker_id", workerId);

      if (assignmentResult.error) {
        console.warn("[worker-response] assignment response update failed", {
          jobId,
          workerId,
          responseType,
          code: assignmentResult.error.code,
          message: assignmentResult.error.message,
          details: assignmentResult.error.details,
          hint: assignmentResult.error.hint,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Worker response updated to ${responseType}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update response.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
