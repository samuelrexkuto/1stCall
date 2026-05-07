import type { DispatchPayload } from "@/lib/dispatch/types";

export async function sendSmsDispatch(payload: DispatchPayload) {
  console.log("Mock SMS dispatch", payload);

  return {
    ok: true,
    channel: "sms" as const,
    dispatched_workers: payload.worker_ids.length,
  };
}
