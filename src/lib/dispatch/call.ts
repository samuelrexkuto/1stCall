import type { DispatchPayload } from "@/lib/dispatch/types";

export async function sendCallDispatch(payload: DispatchPayload) {
  console.log("Mock Call dispatch", payload);

  return {
    ok: true,
    channel: "call" as const,
    dispatched_workers: payload.worker_ids.length,
  };
}
