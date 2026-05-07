import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchPayloadSchema } from "@/lib/dispatch/types";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  updateJobBroadcastStatus,
  BROADCAST_STATUSES,
} from "@/lib/dispatch/updateBroadcastStatus";

interface WorkerEmailRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean | null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailContent(payload: {
  alertStyle: string;
  messagePreview: string;
  jobContext: {
    job_title: string;
    role?: string | null;
    area?: string | null;
    postcode?: string | null;
    start_date?: string | null;
    start_time?: string | null;
    pay_rate?: number | null;
    pay_rate_display?: string | null;
    short_description?: string | null;
  };
}) {
  const { alertStyle, messagePreview, jobContext } = payload;
  const subject = `${alertStyle}: ${jobContext.job_title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 12px;">${escapeHtml(jobContext.job_title)}</h2>
      <p style="margin: 0 0 12px;"><strong>Alert:</strong> ${escapeHtml(alertStyle)}</p>
      <p style="margin: 0 0 8px;"><strong>Role:</strong> ${escapeHtml(jobContext.role ?? "-")}</p>
      <p style="margin: 0 0 8px;"><strong>Location:</strong> ${escapeHtml(jobContext.area ?? "-")} / ${escapeHtml(jobContext.postcode ?? "-")}</p>
      <p style="margin: 0 0 8px;"><strong>Start:</strong> ${escapeHtml(jobContext.start_date ?? "-")} ${escapeHtml(jobContext.start_time ?? "")}</p>
      <p style="margin: 0 0 8px;"><strong>Pay:</strong> ${escapeHtml(jobContext.pay_rate_display ?? (jobContext.pay_rate !== null && jobContext.pay_rate !== undefined ? String(jobContext.pay_rate) : "-"))}</p>
      <p style="margin: 0 0 16px;"><strong>Description:</strong> ${escapeHtml(jobContext.short_description ?? "-")}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
      <p style="white-space: pre-line; margin: 0;">${escapeHtml(messagePreview)}</p>
    </div>
  `;
  const text = [
    jobContext.job_title,
    `Alert: ${alertStyle}`,
    `Role: ${jobContext.role ?? "-"}`,
    `Location: ${jobContext.area ?? "-"} / ${jobContext.postcode ?? "-"}`,
    `Start: ${jobContext.start_date ?? "-"} ${jobContext.start_time ?? ""}`.trim(),
    `Pay: ${jobContext.pay_rate_display ?? (jobContext.pay_rate ?? "-")}`,
    `Description: ${jobContext.short_description ?? "-"}`,
    "",
    messagePreview,
  ].join("\n");

  return { subject, html, text };
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = dispatchPayloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid dispatch payload.",
        issues: parsed.error.issues,
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  if (!payload.channels.includes("email")) {
    return NextResponse.json(
      { error: "Email dispatch route requires the email channel in channels." },
      { status: 400 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is missing." },
      { status: 500 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    const uniqueWorkerIds = [...new Set(payload.worker_ids)];
    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, email, phone, whatsapp_opt_in")
      .in("id", uniqueWorkerIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workers = (data ?? []) as WorkerEmailRow[];

    if (workers.length === 0) {
      return NextResponse.json(
        { error: "No selected workers were found in the database." },
        { status: 404 },
      );
    }

    const workerById = new Map(workers.map((worker) => [worker.id, worker]));
    const emailContent = buildEmailContent({
      alertStyle: payload.alert_style,
      messagePreview: payload.message_preview,
      jobContext: payload.job_context,
    });

    const workerResults = await Promise.all(
      uniqueWorkerIds.map(async (workerId) => {
        const worker = workerById.get(workerId);

        if (!worker) {
          return {
            workerId,
            name: "Unknown worker",
            email: null,
            ok: false,
            reason: "Worker not found in database.",
          };
        }

        if (!worker.email) {
          return {
            workerId: worker.id,
            name: worker.full_name,
            email: null,
            ok: false,
            reason: "Worker does not have an email address.",
          };
        }

        try {
          const { error: sendError } = await sendEmail({
            to: worker.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });

          if (sendError) {
            return {
              workerId: worker.id,
              name: worker.full_name,
              email: worker.email,
              ok: false,
              reason: sendError.message,
            };
          }

          return {
            workerId: worker.id,
            name: worker.full_name,
            email: worker.email,
            ok: true,
            reason: null,
          };
        } catch (error) {
          return {
            workerId: worker.id,
            name: worker.full_name,
            email: worker.email,
            ok: false,
            reason: error instanceof Error ? error.message : "Email send failed.",
          };
        }
      }),
    );

    const sent = workerResults.filter((result) => result.ok).length;
    const failedRows = workerResults.filter((result) => !result.ok);
    const failureSummary = [...failedRows.reduce((acc, row) => {
      const key = row.reason ?? "Unknown error";
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()).entries()].map(([reason, count]) => ({ reason, count }));

    // Update job broadcast status if dispatch was successful
    if (payload.job_id && sent > 0) {
      try {
        const updateResult = await updateJobBroadcastStatus({
          jobId: payload.job_id,
          status: BROADCAST_STATUSES.AWAITING_RESPONSE,
          onlyWhenReady: true,
        });

        if (!updateResult.success) {
          console.error("Failed to update job broadcast status:", updateResult.error);
        }
      } catch (error) {
        console.error("Failed to update job broadcast status:", error);
        // Don't fail the dispatch if status update fails
        // The dispatch was successful, status update is secondary
      }
    }

    return NextResponse.json({
      ok: failedRows.length === 0,
      provider: "resend",
      sent,
      failed: failedRows.length,
      failure_reasons: failureSummary,
      worker_results: workerResults,
      message:
        failedRows.length === 0
          ? `Email dispatch sent to ${sent} worker(s).`
          : `Email dispatch sent to ${sent} worker(s) with ${failedRows.length} failure(s).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email dispatch failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
