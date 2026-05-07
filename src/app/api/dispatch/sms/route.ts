import { NextResponse } from "next/server";
import { sendSmsDispatch } from "@/lib/dispatch/sms";
import { dispatchPayloadSchema } from "@/lib/dispatch/types";
import {
  updateJobBroadcastStatus,
  BROADCAST_STATUSES,
} from "@/lib/dispatch/updateBroadcastStatus";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = dispatchPayloadSchema.safeParse(json);

  if (!parsed.success) {
    console.error("Dispatch validation failed: sms", {
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

  const result = await sendSmsDispatch(parsed.data);

  // Update job broadcast status if dispatch was successful
  if (parsed.data.job_id) {
    try {
      const updateResult = await updateJobBroadcastStatus({
        jobId: parsed.data.job_id,
        status: BROADCAST_STATUSES.AWAITING_RESPONSE,
        onlyWhenReady: true,
      });

      if (!updateResult.success) {
        console.error("Failed to update job broadcast status:", updateResult.error);
      }
    } catch (error) {
      console.error("Failed to update job broadcast status:", error);
      // Don't fail the dispatch if status update fails
    }
  }

  return NextResponse.json({
    ok: true,
    provider: "mock",
    result,
    message: `Mock SMS dispatch accepted for ${parsed.data.worker_ids.length} worker(s).`,
  });
}
