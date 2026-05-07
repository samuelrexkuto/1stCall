import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deriveWhatsappNumber } from "@/lib/phone";
import {
  insertDispatchLogs,
  updateDispatchLogs,
  upsertResponseLogDelivery,
} from "@/lib/dispatch/logs";
import {
  getActiveProviderName,
  sendWhatsAppDispatch,
  type WhatsAppDispatchResult,
  type WhatsAppRecipient,
} from "@/lib/dispatch/providers/whatsapp";
import { dispatchPayloadSchema } from "@/lib/dispatch/types";
import {
  updateJobBroadcastStatus,
  BROADCAST_STATUSES,
} from "@/lib/dispatch/updateBroadcastStatus";

interface WorkerDispatchRow {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_opt_in: boolean;
}

function buildFailureSummary(
  failures: Array<{ reason: string }>,
): Array<{ reason: string; count: number }> {
  const summary = new Map<string, number>();

  for (const failure of failures) {
    summary.set(failure.reason, (summary.get(failure.reason) ?? 0) + 1);
  }

  return [...summary.entries()].map(([reason, count]) => ({ reason, count }));
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = dispatchPayloadSchema.safeParse(json);

  if (!parsed.success) {
    console.error("Dispatch validation failed: whatsapp", {
      payload: json,
      issues: parsed.error.issues,
    });

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
  const dispatchId = randomUUID();
  const providerName = getActiveProviderName();
  const uniqueWorkerIds = [...new Set(payload.worker_ids)];

  if (!payload.channels.includes("whatsapp")) {
    return NextResponse.json(
      { error: "WhatsApp dispatch route requires the whatsapp channel in channels." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, phone, whatsapp_opt_in")
      .in("id", uniqueWorkerIds);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as WorkerDispatchRow[];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No selected workers were found in the database." },
        { status: 404 },
      );
    }

    const selectedWorkers = new Map<string, WorkerDispatchRow>(
      rows.map((row: WorkerDispatchRow) => [row.id, row]),
    );
    const eligibleRecipients: WhatsAppRecipient[] = [];
    const skippedRecipients: Array<{
      workerId: string;
      name: string;
      phone: string | null;
      reason: string;
      loggable: boolean;
    }> = [];

    for (const workerId of uniqueWorkerIds) {
      const worker = selectedWorkers.get(workerId);

      if (!worker) {
        skippedRecipients.push({
          workerId,
          name: "Unknown worker",
          phone: null,
          reason: "Worker not found in database.",
          loggable: false,
        });
        continue;
      }

      const normalizedPhone = deriveWhatsappNumber(worker.phone, worker.whatsapp_opt_in);

      if (!worker.whatsapp_opt_in) {
        skippedRecipients.push({
          workerId: worker.id,
          name: worker.full_name,
          phone: normalizedPhone,
          reason: "Worker has not opted into WhatsApp dispatch.",
          loggable: true,
        });
        continue;
      }

      if (!normalizedPhone) {
        skippedRecipients.push({
          workerId: worker.id,
          name: worker.full_name,
          phone: worker.phone,
          reason: "Worker does not have a valid WhatsApp phone number.",
          loggable: true,
        });
        continue;
      }

      eligibleRecipients.push({
        workerId: worker.id,
        name: worker.full_name,
        phone: normalizedPhone,
      });
    }

    try {
      await insertDispatchLogs(
        skippedRecipients.filter((recipient) => recipient.loggable).map((recipient) => ({
          dispatchId,
          jobId: payload.job_id,
          workerId: recipient.workerId,
          channel: "whatsapp",
          phone: recipient.phone,
          status: "failed",
          provider: providerName,
          errorMessage: recipient.reason,
        })),
      );
    } catch {}

    if (eligibleRecipients.length === 0) {
      return NextResponse.json(
        {
          error: "No WhatsApp-capable recipients were found for the selected workers.",
          dispatch_id: dispatchId,
          sent: 0,
          failed: skippedRecipients.length,
          failure_reasons: buildFailureSummary(skippedRecipients),
        },
        { status: 400 },
      );
    }

    try {
      await insertDispatchLogs(
        eligibleRecipients.map((recipient) => ({
          dispatchId,
          jobId: payload.job_id,
          workerId: recipient.workerId,
          channel: "whatsapp",
          phone: recipient.phone,
          status: "pending",
          provider: providerName,
        })),
      );
    } catch {}

    let providerResult: WhatsAppDispatchResult;

    try {
      providerResult = await sendWhatsAppDispatch({
        dispatchId,
        jobId: payload.job_id,
        recipients: eligibleRecipients,
        message: payload.message_preview,
      });
    } catch (error) {
      try {
        await updateDispatchLogs(
          dispatchId,
          "whatsapp",
          eligibleRecipients.map((recipient) => ({
            workerId: recipient.workerId,
            status: "failed" as const,
            errorMessage:
              error instanceof Error ? error.message : "WhatsApp provider process failed.",
          })),
        );
      } catch {}

      throw error;
    }

    try {
      await updateDispatchLogs(
        dispatchId,
        "whatsapp",
        providerResult.sent.map((recipient) => ({
          workerId: recipient.workerId,
          status: "sent" as const,
          errorMessage: null,
        })),
      );

      await updateDispatchLogs(
        dispatchId,
        "whatsapp",
        providerResult.failed.map((recipient) => ({
          workerId: recipient.workerId,
          status: "failed" as const,
          errorMessage: recipient.reason,
        })),
      );
    } catch {}

    const allFailures = [...skippedRecipients, ...providerResult.failed];

    try {
      await upsertResponseLogDelivery({
        jobId: payload.job_id,
        channel: "whatsapp",
        deliveredWorkerIds: providerResult.sent.map((recipient) => recipient.workerId),
        failedWorkerIds: allFailures
          .map((recipient) => recipient.workerId)
          .filter((workerId) => selectedWorkers.has(workerId)),
      });
    } catch {}

    // Update job broadcast status if dispatch was successful
    let statusUpdateResult = null;
    if (payload.job_id && providerResult.sent.length > 0) {
      try {
        const updateResult = await updateJobBroadcastStatus({
          jobId: payload.job_id,
          status: BROADCAST_STATUSES.AWAITING_RESPONSE,
          onlyWhenReady: true,
        });

        statusUpdateResult = updateResult;
      } catch (error) {
        console.error("Failed to update job broadcast status:", error);
        // Don't fail the dispatch if status update fails
        // The dispatch was successful, status update is secondary
      }
    }

    const failureReasons = buildFailureSummary(allFailures);

    return NextResponse.json({
      ok: providerResult.failed.length === 0 && skippedRecipients.length === 0,
      dispatch_id: dispatchId,
      provider: providerName,
      sent: providerResult.sent.length,
      failed: allFailures.length,
      failure_reasons: failureReasons,
      result: providerResult,
      message:
        allFailures.length === 0
          ? `WhatsApp dispatch sent to ${providerResult.sent.length} worker(s).`
          : `WhatsApp dispatch sent to ${providerResult.sent.length} worker(s) with ${allFailures.length} failure(s).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp dispatch failed.";

    return NextResponse.json(
      {
        error: message,
        dispatch_id: dispatchId,
      },
      { status: 500 },
    );
  }
}
