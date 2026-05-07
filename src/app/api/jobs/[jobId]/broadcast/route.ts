import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { query } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { jobId } = await params;
  const body = (await request.json()) as {
    workerIds?: string[];
    channel?: "call" | "sms" | "whatsapp";
  };

  const workerIds = Array.isArray(body.workerIds) ? body.workerIds : [];
  const channel = body.channel ?? "whatsapp";

  if (workerIds.length === 0) {
    return NextResponse.json({ error: "Select at least one worker." }, { status: 400 });
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
        select
          $1::uuid,
          unnest($2::uuid[]),
          timezone('utc', now()),
          $3,
          true,
          false,
          'no_response',
          null,
          false,
          false
        on conflict (job_id, worker_id)
        do update set
          sent_time = excluded.sent_time,
          channel = excluded.channel,
          delivered = true,
          read = false,
          response_type = 'no_response',
          response_time = null,
          selected = false,
          reserve = false
      `,
      [jobId, workerIds, channel],
    );

    await query(
      `
        update jobs
        set
          broadcast_status = 'awaiting response',
          broadcast_time = timezone('utc', now())
        where job_id = $1
      `,
      [jobId],
    );

    return NextResponse.json({
      ok: true,
      message: `Broadcast placeholder sent to ${workerIds.length} worker(s) via ${channel}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Broadcast failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
