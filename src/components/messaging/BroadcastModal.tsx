"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { OnboardingTemplateAccordion } from "@/components/messaging/OnboardingTemplateAccordion";
import { readBroadcastContextPreference, writeBroadcastContextPreference } from "@/lib/broadcast-context";
import { buildDispatchMessage } from "@/lib/dispatch/buildDispatchMessage";
import {
  getPlatformBackedTrustLabel,
  getWorkerFacingPaymentReliabilityLabel,
  type PlatformBackedStatus,
  type ProviderPaymentReliabilityStatus,
} from "@/lib/provider-trust";

export interface BroadcastRecipient {
  id: string;
  name: string;
  phone?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  requestedByClient?: boolean;
}

export interface BroadcastJobOption {
  job_id: string;
  provider_id?: string | null;
  job_title: string;
  trade_type: string | null;
  area: string | null;
  postcode: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  workers_required: number;
  pay_rate: string | null;
  short_description: string;
  alert_type?: string | null;
  core_role?: string | null;
  duration?: string | null;
  end_date?: string | null;
  pay_rate_display?: string | null;
  provider_name?: string | null;
  duties?: string | null;
  dbs_requirement?: string | null;
  dbs_required?: boolean;
  ipaf_required?: boolean | null;
  own_tools_required?: boolean | null;
  ppe_required?: boolean | null;
  skills_required?: string[];
  shift_pattern?: string | null;
  tickets_required?: string[];
  optional_supporting_notes?: string | null;
  payment_type?: string | null;
  broadcast_status?: string | null;
  provider_payment_reliability_status?: ProviderPaymentReliabilityStatus;
  platform_backed_job?: boolean;
  platform_backed_status?: PlatformBackedStatus;
  worker_payment_protected?: boolean;
  dispatchAudience?: "requested_workforce" | string;
  dispatchAudienceLabel?: string;
  preselectedWorkerIds?: string[];
  requestedDispatchWorkerIds?: string[];
}

type BroadcastAudience = "workers" | "providers";
type BroadcastMode = "standard" | "onboarding";

interface BroadcastResponseChannelResult {
  channel: string;
  ok: boolean;
  message: string;
  sent?: number;
  failed?: number;
  failure_reasons?: Array<{ reason: string; count: number }>;
  recipient_results?: Array<{
    recipientId: string;
    name: string;
    email?: string | null;
    ok: boolean;
    reason?: string | null;
  }>;
}

function buildGenericMessage(audience: BroadcastAudience, recipientCount: number, alertStyle: string) {
  const noun = audience === "workers" ? "worker" : "provider";
  return `${alertStyle} for ${recipientCount} selected ${noun}${recipientCount === 1 ? "" : "s"}.`;
}

export function BroadcastModal({
  open,
  title,
  audience,
  recipients,
  jobs = [],
  jobsUnavailable,
  preferredRole,
  onboardingTemplateType,
  onboardingTitle,
  onClose,
  onSent,
}: {
  open: boolean;
  title: string;
  audience: BroadcastAudience;
  recipients: BroadcastRecipient[];
  jobs?: BroadcastJobOption[];
  jobsUnavailable?: boolean;
  preferredRole?: string;
  onboardingTemplateType: "worker_onboarding" | "recruiter_onboarding";
  onboardingTitle: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [channels, setChannels] = useState<string[]>(["whatsapp"]);
  const [alertStyle, setAlertStyle] = useState("General Broadcast");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [messageMode, setMessageMode] = useState<BroadcastMode>("standard");
  const [standardMessage, setStandardMessage] = useState("");
  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [standardTouched, setStandardTouched] = useState(false);
  const [onboardingTouched, setOnboardingTouched] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [results, setResults] = useState<BroadcastResponseChannelResult[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialJobId =
      jobs.find((job) => preferredRole && job.trade_type === preferredRole)?.job_id ??
      jobs[0]?.job_id ??
      "";
    const preferredContext = readBroadcastContextPreference();
    setSelectedJobId(initialJobId);
    setMessageMode(preferredContext);
    setAccordionOpen(preferredContext === "onboarding");
    setChannels(["whatsapp"]);
    setAlertStyle(preferredContext === "onboarding" ? "Onboarding Broadcast" : "General Broadcast");
    setStandardTouched(false);
    setOnboardingTouched(false);
    setErrorMessage("");
    setConfirmation("");
    setResults([]);
  }, [jobs, open, preferredRole]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTemplateLoading(true);
    setTemplateError("");

    const controller = new AbortController();

    fetch(`/api/message-templates?template_type=${onboardingTemplateType}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Unable to load onboarding template.");
        }

        if (!onboardingTouched) {
          setOnboardingMessage(payload.template.body ?? "");
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setTemplateError(error instanceof Error ? error.message : "Unable to load onboarding template.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTemplateLoading(false);
        }
      });

    return () => controller.abort();
  }, [onboardingTemplateType, onboardingTouched, open]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.job_id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const standardDraft = useMemo(() => {
    if (audience === "workers" && selectedJob) {
      return buildDispatchMessage(
        {
          title: selectedJob.job_title,
          provider_name: selectedJob.provider_name ?? null,
          required_role: selectedJob.trade_type,
          headcount_required: selectedJob.workers_required,
          location: [selectedJob.area, selectedJob.postcode].filter(Boolean).join(", "),
          starts_at: selectedJob.start_date || null,
          pay_rate: selectedJob.pay_rate_display ?? selectedJob.pay_rate ?? null,
          duties: selectedJob.duties ?? null,
          skills_required: selectedJob.skills_required ?? [],
          ppe_required: selectedJob.ppe_required ?? null,
          dbs_requirement: selectedJob.dbs_requirement ?? null,
          payment_reliability_label: getWorkerFacingPaymentReliabilityLabel(
            selectedJob.provider_payment_reliability_status,
          ),
          platform_trust_label: getPlatformBackedTrustLabel(selectedJob),
        },
        alertStyle,
      );
    }

    return buildGenericMessage(audience, recipients.length, alertStyle);
  }, [alertStyle, audience, recipients.length, selectedJob]);

  useEffect(() => {
    if (!standardTouched) {
      setStandardMessage(standardDraft);
    }
  }, [standardDraft, standardTouched]);

  const activeMessage = messageMode === "onboarding" ? onboardingMessage : standardMessage;
  const clientRequestedRecipients = recipients.filter((recipient) => recipient.requestedByClient);
  const isRequestedWorkforceDispatch =
    audience === "workers" &&
    (selectedJob?.dispatchAudience === "requested_workforce" ||
      selectedJob?.requestedDispatchWorkerIds?.length ||
      selectedJob?.preselectedWorkerIds?.length);

  function toggleChannel(channel: string) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((value) => value !== channel)
        : [...current, channel],
    );
  }

  async function handleSend() {
    setSending(true);
    setErrorMessage("");
    setConfirmation("");
    setResults([]);

    try {
      if (recipients.length === 0) {
        throw new Error(`Select at least one ${audience === "workers" ? "worker" : "provider"} before sending.`);
      }

      if (channels.length === 0) {
        throw new Error("Select at least one channel before sending.");
      }

      if (!activeMessage.trim()) {
        throw new Error("Add a message before sending.");
      }

      const response = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_type: audience,
          recipient_ids: recipients.map((recipient) => recipient.id),
          channels: channels.map((channel) => (channel === "ivr" ? "call" : channel)),
          message_context: messageMode,
          alert_style: alertStyle,
          message_preview: activeMessage.trim(),
          job_context:
            audience === "workers" && selectedJob
              ? {
                  job_id: selectedJob.job_id,
                  provider_id: selectedJob.provider_id ?? undefined,
                  provider_name: selectedJob.provider_name ?? undefined,
                  job_title: selectedJob.job_title,
                  alert_type: selectedJob.alert_type ?? alertStyle,
                  core_role: selectedJob.core_role ?? selectedJob.trade_type,
                  role: selectedJob.trade_type,
                  area: selectedJob.area,
                  postcode: selectedJob.postcode,
                  start_date: selectedJob.start_date,
                  start_time: selectedJob.start_time,
                  end_date: selectedJob.end_date ?? null,
                  pay_rate: selectedJob.pay_rate ?? null,
                  pay_rate_display: selectedJob.pay_rate_display ?? selectedJob.pay_rate ?? null,
                  short_description: selectedJob.short_description,
                  duties: selectedJob.duties ?? null,
                  skills_required: selectedJob.skills_required ?? [],
                  ppe_required: selectedJob.ppe_required ?? null,
                  dbs_requirement: selectedJob.dbs_requirement ?? null,
                  broadcast_status: selectedJob.broadcast_status ?? null,
                  dispatchAudience: selectedJob.dispatchAudience ?? null,
                  dispatchAudienceLabel: selectedJob.dispatchAudienceLabel ?? null,
                  requestedDispatchWorkerIds: selectedJob.requestedDispatchWorkerIds ?? selectedJob.preselectedWorkerIds ?? [],
                }
              : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Broadcast failed.");
      }

      const channelResults = Array.isArray(payload.results) ? payload.results : [];
      setResults(channelResults);

      const successCount = channelResults.filter((result: BroadcastResponseChannelResult) => result.ok).length;

      if (successCount === channelResults.length) {
        setConfirmation(payload.message ?? "Broadcast sent.");
      } else if (successCount > 0) {
        setConfirmation(payload.message ?? "Broadcast partially sent.");
        setErrorMessage("Some channels failed. Review the per-channel results below.");
      } else {
        setErrorMessage(payload.message ?? "Broadcast failed.");
      }

      if (payload.statusUpdateWarning) {
        setErrorMessage(`Delivery succeeded, but status update failed: ${payload.statusUpdateWarning}`);
      }

      if (response.ok) {
        onSent?.();
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Broadcast failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <section
          style={{
            padding: "0.9rem 1rem",
            borderRadius: 16,
            background: "var(--rd-surface-soft)",
            border: "1px solid var(--rd-border)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "0.4rem" }}>
            {isRequestedWorkforceDispatch ? "Dispatch client-requested workforce" : "Recipients"}
          </h3>
          <p style={{ marginTop: 0 }}>
            {isRequestedWorkforceDispatch
              ? "This dispatch will only be sent to the workforce requested by the client."
              : `${recipients.length} selected ${audience === "workers" ? "worker" : "provider"}${recipients.length === 1 ? "" : "s"}.`}
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {recipients.map((recipient) => (
              <li key={recipient.id}>
                {recipient.name} | WhatsApp: {recipient.whatsappNumber ?? recipient.phone ?? "-"} | Email:{" "}
                {recipient.email ?? "-"}
                {recipient.requestedByClient ? " | Client requested" : ""}
              </li>
            ))}
          </ul>
        </section>

        {clientRequestedRecipients.length > 0 ? (
          <section
            style={{
              padding: "0.9rem 1rem",
              borderRadius: 16,
              background: "var(--rd-surface-soft)",
              border: "1px solid var(--rd-border)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "0.4rem" }}>Client Requested Workforce</h3>
            <p style={{ marginTop: 0, color: "var(--rd-text-muted)" }}>
              These workers were selected by the client and are shown first in the broadcast recipient list.
            </p>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {clientRequestedRecipients.map((recipient) => (
                <li key={recipient.id}>{recipient.name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <fieldset style={{ border: "1px solid var(--rd-border)", borderRadius: 16, padding: "0.9rem 1rem" }}>
            <legend>Channels</legend>
            <label style={{ display: "block", marginBottom: "0.45rem" }}>
              <input type="checkbox" checked={channels.includes("whatsapp")} onChange={() => toggleChannel("whatsapp")} /> WhatsApp
            </label>
            <label style={{ display: "block", marginBottom: "0.45rem" }}>
              <input type="checkbox" checked={channels.includes("sms")} onChange={() => toggleChannel("sms")} /> Text
            </label>
            <label style={{ display: "block" }}>
              <input type="checkbox" checked={channels.includes("ivr")} onChange={() => toggleChannel("ivr")} /> Call
            </label>
          </fieldset>

          <label>
            Message type / context
            <select
              value={messageMode}
              onChange={(event) => {
                const nextMode = event.target.value as BroadcastMode;
                setMessageMode(nextMode);
                writeBroadcastContextPreference(nextMode);
                if (nextMode === "onboarding") {
                  setAccordionOpen(true);
                }
              }}
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
            >
              <option value="standard">Standard dispatch / custom message</option>
              <option value="onboarding">Onboarding context</option>
            </select>
          </label>

          <label>
            Alert style
            <select
              value={alertStyle}
              onChange={(event) => setAlertStyle(event.target.value)}
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
            >
              <option value="General Broadcast">General Broadcast</option>
              <option value="Job Alert">Job Alert</option>
              <option value="Urgent Callout">Urgent Callout</option>
              <option value="Shift Reminder">Shift Reminder</option>
              <option value="Availability Check">Availability Check</option>
              <option value="Onboarding Broadcast">Onboarding Broadcast</option>
            </select>
          </label>
        </section>

        {audience === "workers" ? (
          <section>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Dispatch Context</h3>
            <label>
              Attach job
              <select
                value={selectedJobId}
                onChange={(event) => {
                  setSelectedJobId(event.target.value);
                  setStandardTouched(false);
                }}
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              >
                <option value="">General message</option>
                {jobs.map((job) => (
                  <option key={job.job_id} value={job.job_id}>
                    {job.provider_name ? `${job.provider_name} — ` : ""}{job.job_title}{job.trade_type ? ` | ${job.trade_type}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {jobsUnavailable ? (
              <p style={{ marginBottom: 0, color: "#b45309" }}>
                Job data is currently unavailable. Standard custom broadcasts and onboarding still work.
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Message</h3>
          <p style={{ marginTop: 0, color: "var(--rd-text-muted)" }}>
            {messageMode === "onboarding"
              ? "Onboarding context is active. The editable onboarding message below will be sent."
              : "Edit the outgoing dispatch or broadcast message before sending."}
          </p>
          <textarea
            value={activeMessage}
            onChange={(event) => {
              if (messageMode === "onboarding") {
                setOnboardingTouched(true);
                setOnboardingMessage(event.target.value);
                return;
              }

              setStandardTouched(true);
              setStandardMessage(event.target.value);
            }}
            style={{
              width: "100%",
              minHeight: 220,
              resize: "vertical",
              padding: "1rem",
              border: "1px solid var(--rd-border)",
              borderRadius: 16,
              background: "var(--rd-bg-elevated)",
              color: "var(--rd-text)",
              fontFamily: "inherit",
              fontSize: "1rem",
              lineHeight: 1.5,
            }}
          />
        </section>

        <OnboardingTemplateAccordion
          title={onboardingTitle}
          open={accordionOpen}
          onToggle={() => setAccordionOpen((current) => !current)}
          loading={templateLoading}
          error={templateError}
          value={onboardingMessage}
          active={messageMode === "onboarding"}
          onChange={(value) => {
            setOnboardingTouched(true);
            setOnboardingMessage(value);
          }}
        />

        {errorMessage ? (
          <p style={{ margin: 0, padding: "0.75rem", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca" }}>
            {errorMessage}
          </p>
        ) : null}

        {confirmation ? (
          <p style={{ margin: 0, padding: "0.75rem", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            {confirmation}
          </p>
        ) : null}

        {results.length > 0 ? (
          <section style={{ padding: "0.9rem 1rem", borderRadius: 16, background: "var(--rd-surface-soft)", border: "1px solid var(--rd-border)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Delivery Results</h3>
            <ul style={{ marginBottom: 0, paddingLeft: "1.2rem" }}>
              {results.map((result) => (
                <li key={result.channel}>
                  {result.channel}: {result.ok ? "success" : "failed"} ({result.message}
                  {typeof result.sent === "number" ? ` | sent: ${result.sent}` : ""}
                  {typeof result.failed === "number" ? ` | failed: ${result.failed}` : ""}
                  {result.failure_reasons?.length
                    ? ` | reasons: ${result.failure_reasons.map((item) => `${item.reason} (${item.count})`).join(", ")}`
                    : ""}
                  )
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
