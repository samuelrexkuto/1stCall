import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deriveWhatsappNumber } from "@/lib/phone";
import { sendEmail } from "@/lib/email/sendEmail";
import { sendCallDispatch } from "@/lib/dispatch/call";
import { sendSmsDispatch } from "@/lib/dispatch/sms";
import { sendWhatsAppDispatch } from "@/lib/dispatch/providers/whatsapp";
import { upsertResponseLogDelivery } from "@/lib/dispatch/logs";
import {
  BROADCAST_STATUSES,
  revalidateBroadcastStatusViews,
  shouldMoveToAwaitingResponse,
  updateJobBroadcastStatusRecord,
} from "@/lib/dispatch/broadcast-status";

const broadcastPayloadSchema = z.object({
  recipient_type: z.enum(["workers", "providers"]),
  recipient_ids: z.array(z.string().uuid()).min(1),
  channels: z.array(z.enum(["whatsapp", "sms", "call", "email"])).min(1),
  message_context: z.enum(["standard", "onboarding"]),
  alert_style: z.string().trim().min(1),
  message_preview: z.string().trim().min(1),
  job_context: z
    .object({
      job_id: z.string().uuid().optional(),
      provider_id: z.string().uuid().optional().nullable(),
      provider_name: z.string().trim().optional().nullable(),
      job_title: z.string().trim().optional().nullable(),
      role: z.string().trim().optional().nullable(),
      area: z.string().trim().optional().nullable(),
      postcode: z.string().trim().optional().nullable(),
      start_date: z.string().trim().optional().nullable(),
      start_time: z.string().trim().optional().nullable(),
      pay_rate_display: z.string().trim().optional().nullable(),
      short_description: z.string().trim().optional().nullable(),
      broadcast_status: z.string().trim().optional().nullable(),
      dispatchAudience: z.string().trim().optional().nullable(),
      dispatchAudienceLabel: z.string().trim().optional().nullable(),
      requestedDispatchWorkerIds: z.array(z.string().uuid()).optional(),
    })
    .nullable()
    .optional(),
});

type BroadcastPayload = z.infer<typeof broadcastPayloadSchema>;

interface RecipientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_opt_in?: boolean | null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailContent(payload: BroadcastPayload) {
  const subjectBase =
    payload.message_context === "onboarding"
      ? payload.recipient_type === "workers"
        ? "Worker onboarding"
        : "Provider onboarding"
      : payload.job_context?.job_title
        ? `${payload.alert_style}: ${payload.job_context.job_title}`
        : payload.alert_style;

  const text = [
    payload.job_context?.provider_name ? `Client: ${payload.job_context.provider_name}` : null,
    payload.job_context?.job_title ? `Job: ${payload.job_context.job_title}` : null,
    payload.job_context?.role ? `Role: ${payload.job_context.role}` : null,
    payload.job_context?.area || payload.job_context?.postcode
      ? `Location: ${payload.job_context?.area ?? "-"} / ${payload.job_context?.postcode ?? "-"}`
      : null,
    payload.job_context?.start_date
      ? `Start: ${payload.job_context.start_date} ${payload.job_context?.start_time ?? ""}`.trim()
      : null,
    payload.job_context?.pay_rate_display ? `Pay: ${payload.job_context.pay_rate_display}` : null,
    payload.job_context?.short_description ? `Description: ${payload.job_context.short_description}` : null,
    null,
    payload.message_preview,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <p style="margin: 0 0 16px;"><strong>${escapeHtml(subjectBase)}</strong></p>
      <p style="white-space: pre-line; margin: 0;">${escapeHtml(payload.message_preview)}</p>
    </div>
  `;

  return { subject: subjectBase, html, text };
}

async function loadRecipients(payload: BroadcastPayload) {
  const supabase = createAdminSupabaseClient();

  if (payload.recipient_type === "workers") {
    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, email, phone, whatsapp_opt_in")
      .in("id", payload.recipient_ids);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.full_name ?? ""),
      email: typeof row.email === "string" ? row.email : null,
      phone: typeof row.phone === "string" ? row.phone : null,
      whatsapp_opt_in: Boolean(row.whatsapp_opt_in),
    })) satisfies RecipientRow[];
  }

  const { data, error } = await supabase
    .from("job_providers")
    .select("id, name, email, phone")
    .in("id", payload.recipient_ids);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    email: typeof row.email === "string" ? row.email : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    whatsapp_opt_in: true,
  })) satisfies RecipientRow[];
}

async function sendEmailChannel(payload: BroadcastPayload, recipients: RecipientRow[]) {
  if (!process.env.RESEND_API_KEY) {
    return {
      channel: "email",
      ok: false,
      message: "RESEND_API_KEY is missing.",
      sent: 0,
      failed: recipients.length,
      failure_reasons: [{ reason: "RESEND_API_KEY is missing.", count: recipients.length }],
      recipient_results: recipients.map((recipient) => ({
        recipientId: recipient.id,
        name: recipient.name,
        email: recipient.email,
        ok: false,
        reason: "RESEND_API_KEY is missing.",
      })),
    };
  }

  const emailContent = buildEmailContent(payload);
  const recipientResults = await Promise.all(
    recipients.map(async (recipient) => {
      if (!recipient.email) {
        return {
          recipientId: recipient.id,
          name: recipient.name,
          email: null,
          ok: false,
          reason: "Recipient does not have an email address.",
        };
      }

      try {
        const { error } = await sendEmail({
          to: recipient.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        if (error) {
          return {
            recipientId: recipient.id,
            name: recipient.name,
            email: recipient.email,
            ok: false,
            reason: error.message,
          };
        }

        return {
          recipientId: recipient.id,
          name: recipient.name,
          email: recipient.email,
          ok: true,
          reason: null,
        };
      } catch (error) {
        return {
          recipientId: recipient.id,
          name: recipient.name,
          email: recipient.email,
          ok: false,
          reason: error instanceof Error ? error.message : "Email send failed.",
        };
      }
    }),
  );

  const sent = recipientResults.filter((result) => result.ok).length;
  const failedRows = recipientResults.filter((result) => !result.ok);
  const failureMap = failedRows.reduce((acc, row) => {
    const key = row.reason ?? "Unknown error";
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  return {
    channel: "email",
    ok: failedRows.length === 0,
    message:
      failedRows.length === 0
        ? `Email sent to ${sent} recipient(s).`
        : `Email sent to ${sent} recipient(s) with ${failedRows.length} failure(s).`,
    sent,
    failed: failedRows.length,
    failure_reasons: [...failureMap.entries()].map(([reason, count]) => ({ reason, count })),
    recipient_results: recipientResults,
  };
}

async function sendWhatsAppChannel(payload: BroadcastPayload, recipients: RecipientRow[]) {
  const eligibleRecipients = recipients
    .map((recipient) => ({
      recipient,
      phone: deriveWhatsappNumber(recipient.phone, recipient.whatsapp_opt_in ?? true),
    }))
    .filter((item) => item.phone);

  const skipped = recipients
    .filter((recipient) => !deriveWhatsappNumber(recipient.phone, recipient.whatsapp_opt_in ?? true))
    .map((recipient) => ({
      recipientId: recipient.id,
      name: recipient.name,
      email: recipient.email,
      ok: false,
      reason: "Recipient does not have a valid WhatsApp phone number.",
    }));

  if (eligibleRecipients.length === 0) {
    return {
      channel: "whatsapp",
      ok: false,
      message: "No WhatsApp-capable recipients were found.",
      sent: 0,
      failed: skipped.length,
      failure_reasons: [{ reason: "Recipient does not have a valid WhatsApp phone number.", count: skipped.length }],
      recipient_results: skipped,
    };
  }

  try {
    const providerResult = await sendWhatsAppDispatch({
      dispatchId: randomUUID(),
      jobId: payload.job_context?.job_title || randomUUID(),
      message: payload.message_preview,
      recipients: eligibleRecipients.map((item) => ({
        workerId: item.recipient.id,
        name: item.recipient.name,
        phone: item.phone as string,
      })),
    });

    const recipientResults = [
      ...providerResult.sent.map((recipient) => ({
        recipientId: recipient.workerId,
        name: recipient.name,
        email: recipients.find((candidate) => candidate.id === recipient.workerId)?.email ?? null,
        ok: true,
        reason: null,
      })),
      ...providerResult.failed.map((recipient) => ({
        recipientId: recipient.workerId,
        name: recipient.name,
        email: recipients.find((candidate) => candidate.id === recipient.workerId)?.email ?? null,
        ok: false,
        reason: recipient.reason,
      })),
      ...skipped,
    ];

    const failureMap = recipientResults
      .filter((result) => !result.ok)
      .reduce((acc, row) => {
        const key = row.reason ?? "Unknown error";
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
      }, new Map<string, number>());

    return {
      channel: "whatsapp",
      ok: providerResult.failed.length === 0 && skipped.length === 0,
      message:
        providerResult.failed.length === 0 && skipped.length === 0
          ? `WhatsApp sent to ${providerResult.sent.length} recipient(s).`
          : `WhatsApp sent to ${providerResult.sent.length} recipient(s) with ${providerResult.failed.length + skipped.length} failure(s).`,
      sent: providerResult.sent.length,
      failed: providerResult.failed.length + skipped.length,
      failure_reasons: [...failureMap.entries()].map(([reason, count]) => ({ reason, count })),
      recipient_results: recipientResults,
    };
  } catch (error) {
    return {
      channel: "whatsapp",
      ok: false,
      message: error instanceof Error ? error.message : "WhatsApp send failed.",
      sent: 0,
      failed: eligibleRecipients.length + skipped.length,
      failure_reasons: [
        {
          reason: error instanceof Error ? error.message : "WhatsApp send failed.",
          count: eligibleRecipients.length,
        },
      ],
      recipient_results: [
        ...eligibleRecipients.map((item) => ({
          recipientId: item.recipient.id,
          name: item.recipient.name,
          email: item.recipient.email,
          ok: false,
          reason: error instanceof Error ? error.message : "WhatsApp send failed.",
        })),
        ...skipped,
      ],
    };
  }
}

function buildMockChannelResult(channel: "sms" | "call", payload: BroadcastPayload) {
  const dispatchPayload = {
    worker_ids: payload.recipient_ids,
    channels: [channel],
    alert_style: payload.alert_style,
    message_preview: payload.message_preview,
    job_context: payload.job_context ?? { job_title: payload.alert_style },
  };

  return channel === "sms" ? sendSmsDispatch(dispatchPayload as never) : sendCallDispatch(dispatchPayload as never);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const json = await request.json();
  const parsed = broadcastPayloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid broadcast payload.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const payload = parsed.data;
    const recipients = await loadRecipients(payload);

    if (recipients.length === 0) {
      return NextResponse.json({ success: false, error: "No recipients were found." }, { status: 404 });
    }

    const results = [];

    for (const channel of payload.channels) {
      if (channel === "email") {
        results.push(await sendEmailChannel(payload, recipients));
        continue;
      }

      if (channel === "whatsapp") {
        results.push(await sendWhatsAppChannel(payload, recipients));
        continue;
      }

      const mockResult = await buildMockChannelResult(channel, payload);
      results.push({
        channel,
        ok: true,
        message:
          channel === "sms"
            ? `Mock SMS broadcast accepted for ${payload.recipient_ids.length} recipient(s).`
            : `Mock Call broadcast accepted for ${payload.recipient_ids.length} recipient(s).`,
        sent: payload.recipient_ids.length,
        failed: 0,
        failure_reasons: [],
        recipient_results: recipients.map((recipient) => ({
          recipientId: recipient.id,
          name: recipient.name,
          email: recipient.email,
          ok: true,
          reason: null,
        })),
        mock_result: mockResult,
      });
    }

    const okCount = results.filter((result) => result.ok).length;
    const supabase = createAdminSupabaseClient();
    let statusUpdateWarning: string | null = null;

    if (payload.recipient_type === "workers" && payload.job_context?.job_id) {
      try {
        const jobId = payload.job_context.job_id;
        const totalDeliveredWorkerIds = results.flatMap((result) =>
          (result.recipient_results ?? [])
            .filter((recipient) => recipient.ok)
            .map((recipient) => recipient.recipientId),
        );
        const deliveredWorkerIds = [...new Set(totalDeliveredWorkerIds)];

        if (deliveredWorkerIds.length > 0) {
          const updateResult = await updateJobBroadcastStatusRecord(supabase, {
            jobId,
            status: BROADCAST_STATUSES.AWAITING_RESPONSE,
            allowCompletedDowngrade: false,
            onlyWhenReady: true,
          });

          if (!shouldMoveToAwaitingResponse(updateResult.previousStatus)) {
            console.info("[broadcast] job broadcast status unchanged after delivery", {
              jobId,
              previousStatus: updateResult.previousStatus,
              newStatus: updateResult.newStatus,
            });
          } else {
            revalidateBroadcastStatusViews();
          }

          if (payload.job_context.dispatchAudience === "requested_workforce") {
            const requestedDispatchWorkerIds = payload.job_context.requestedDispatchWorkerIds?.length
              ? payload.job_context.requestedDispatchWorkerIds
              : deliveredWorkerIds;
            const requestedDeliveredIds = deliveredWorkerIds.filter((workerId) =>
              requestedDispatchWorkerIds.includes(workerId),
            );

            if (requestedDeliveredIds.length > 0) {
              const dispatchedAt = new Date().toISOString();
              const requestedStatusResult = await supabase
                .from("job_worker_assignments")
                .update({
                  dispatch_status: "dispatched",
                  dispatched_at: dispatchedAt,
                  updated_at: dispatchedAt,
                })
                .eq("job_id", jobId)
                .eq("requested_by_client", true)
                .in("worker_id", requestedDeliveredIds);

              if (requestedStatusResult.error) {
                console.error("[broadcast] requested workforce dispatch status update failed", {
                  jobId,
                  workerIds: requestedDeliveredIds,
                  error: requestedStatusResult.error,
                });
                statusUpdateWarning = requestedStatusResult.error.message;
              }
            }
          }

          for (const channelResult of results) {
            const channelName = channelResult.channel === "call" ? "ivr" : channelResult.channel;
            if (channelName !== "whatsapp" && channelName !== "sms" && channelName !== "ivr") {
              continue;
            }

            const deliveredIds = (channelResult.recipient_results ?? [])
              .filter((recipient) => recipient.ok)
              .map((recipient) => recipient.recipientId);
            const failedIds = (channelResult.recipient_results ?? [])
              .filter((recipient) => !recipient.ok)
              .map((recipient) => recipient.recipientId);

            try {
              await upsertResponseLogDelivery({
                jobId,
                channel: channelName,
                deliveredWorkerIds: deliveredIds,
                failedWorkerIds: failedIds,
              });
            } catch (error) {
              console.warn("[broadcast] response log delivery upsert failed", error);
            }
          }
        }
      } catch (error) {
        console.error("[broadcast] job broadcast status update failed", error);
        statusUpdateWarning = error instanceof Error ? error.message : "Failed to update job broadcast status.";
      }
    }

    return NextResponse.json({
      success: true,
      message:
        okCount === results.length
          ? "Broadcast sent."
          : okCount > 0
            ? "Broadcast partially sent."
            : "Broadcast failed.",
      results,
      statusUpdateWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Broadcast failed.",
      },
      { status: 500 },
    );
  }
}
