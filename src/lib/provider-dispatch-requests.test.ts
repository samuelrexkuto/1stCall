import { describe, expect, it } from "vitest";
import {
  DISPATCH_REQUEST_ERROR_MESSAGE,
  buildLegacyProviderAuditEventInsert,
  buildProviderAuditEventInsert,
  getProviderAuditClientError,
  getSelectedDispatchWorkerIds,
  isProviderAuditSchemaError,
  shouldRetryProviderAuditLegacyInsert,
} from "@/lib/provider-dispatch-requests";

describe("provider dispatch request helpers", () => {
  it("keeps exactly the selected workforce IDs from request metadata", () => {
    expect(getSelectedDispatchWorkerIds({
      worker_ids: ["worker-1", "worker-2", "", 42, null],
    })).toEqual(["worker-1", "worker-2"]);
  });

  it("builds provider audit insert payload with provider, actor, event type, entity, and metadata", () => {
    const jobId = "8e1cb307-5293-4fa0-bfef-be194dcd6b1f";
    const payload = buildProviderAuditEventInsert({
      providerId: "290fd417-1305-4a89-97a5-638d30704607",
      actorUserId: "9cd1a279-e90a-45dd-9475-e4c76953d596",
      eventType: "dispatch_requested",
      metadata: {
        job_id: jobId,
        worker_ids: ["worker-1", "worker-2"],
        source: "workforce_overview",
      },
    });

    expect(payload.provider_id).toBe("290fd417-1305-4a89-97a5-638d30704607");
    expect(payload.actor_user_id).toBe("9cd1a279-e90a-45dd-9475-e4c76953d596");
    expect(payload.event_type).toBe("dispatch_requested");
    expect(payload.entity_type).toBe("job");
    expect(payload.entity_id).toBe(jobId);
    expect(payload.metadata).toMatchObject({
      worker_ids: ["worker-1", "worker-2"],
      source: "workforce_overview",
    });
  });

  it("detects raw PostgREST schema-cache errors for provider_audit_events", () => {
    expect(isProviderAuditSchemaError({
      code: "PGRST205",
      message: "Could not find the table 'public.provider_audit_events' in the schema cache",
    })).toBe(true);
  });

  it("builds a legacy audit insert payload for older provider_audit_events schemas", () => {
    expect(buildLegacyProviderAuditEventInsert({
      providerId: "290fd417-1305-4a89-97a5-638d30704607",
      eventType: "dispatch_requested",
      metadata: { worker_ids: ["worker-1", "worker-2"] },
    })).toEqual({
      provider_id: "290fd417-1305-4a89-97a5-638d30704607",
      event_type: "dispatch_requested",
      metadata: { worker_ids: ["worker-1", "worker-2"] },
    });
  });

  it("retries with legacy insert when PostgREST does not know new audit columns", () => {
    expect(shouldRetryProviderAuditLegacyInsert({
      code: "PGRST204",
      message: "Could not find the 'actor_user_id' column of 'provider_audit_events' in the schema cache",
    })).toBe(true);
  });

  it("returns a user-safe message for dispatch audit failures", () => {
    expect(getProviderAuditClientError("dispatch_requested", {
      message: "Could not find the table 'public.provider_audit_events' in the schema cache",
    })).toBe(DISPATCH_REQUEST_ERROR_MESSAGE);
  });
});
