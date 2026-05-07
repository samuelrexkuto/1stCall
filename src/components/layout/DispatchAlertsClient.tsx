"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { JobDetailModal, type JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import { WorkerProfileModal } from "@/components/workers/WorkerProfileModal";
import { JOB_CREATED_EVENT } from "@/lib/jobs/client-events";
import type { WorkerOverviewRow } from "@/lib/workers/types";

interface AlertGroup {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  entityType: "job" | "worker";
  entityId: string;
  severity: "info" | "warning" | "critical";
  items: Array<{
    type: string;
    label: string;
    detail: string;
    actionLabel?: string;
  }>;
}

interface DispatchAlertsPayload {
  summary: {
    unfilledJobs: number;
    dispatchRequests?: number;
    broadcastReady: number;
    awaitingResponse: number;
    invoiceRequired: number;
    unpaidIncome: number;
    workersMissingDocuments: number;
    startingSoonUnfilled: number;
    total: number;
  };
  alerts: AlertGroup[];
  message: string;
}

interface DispatchAlertsClientProps {
  initialPayload: DispatchAlertsPayload;
  jobs?: JobOverviewRow[];
  workers?: WorkerOverviewRow[];
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: "1px solid rgba(148, 163, 184, 0.25)",
        background: "var(--rd-bg-elevated)",
        color: "var(--rd-text-muted)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function DispatchAlertsClient({
  initialPayload,
  jobs = [],
  workers = [],
}: DispatchAlertsClientProps) {
  const [payload, setPayload] = useState(initialPayload);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedTypes, setDismissedTypes] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<JobOverviewRow | null>(null);
  const [activeWorker, setActiveWorker] = useState<WorkerOverviewRow | null>(null);
  const [activeJobSection, setActiveJobSection] = useState<"summary" | "skills" | "invoice" | "labour" | "dispatch">("summary");
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.job_id, job])), [jobs]);
  const workerById = useMemo(() => new Map(workers.map((worker) => [worker.worker_id, worker])), [workers]);

  useEffect(() => {
    async function refreshAlerts() {
      try {
        const response = await fetch("/api/dashboard/alerts", {
          cache: "no-store",
        });
        const nextPayload = await response.json();
        if (response.ok && nextPayload.success) {
          setPayload({
            summary: nextPayload.summary,
            alerts: Array.isArray(nextPayload.alerts) ? nextPayload.alerts : [],
            message: typeof nextPayload.message === "string" ? nextPayload.message : "",
          });
          setDismissedTypes([]);
        }
      } catch {}
    }

    function handleRefresh() {
      void refreshAlerts();
    }

    void refreshAlerts();
    window.addEventListener(JOB_CREATED_EVENT, handleRefresh);
    return () => window.removeEventListener(JOB_CREATED_EVENT, handleRefresh);
  }, []);

  const visibleAlerts = useMemo(
    () => payload.alerts.filter((alert) => !dismissedTypes.includes(alert.id)),
    [payload.alerts, dismissedTypes],
  );

  function getInitialSection(alert: AlertGroup): "summary" | "skills" | "invoice" | "labour" | "dispatch" {
    const types = alert.items.map((item) => item.type);
    if (types.some((type) => type === "client_invoice_unpaid" || type === "client_invoice_required")) return "invoice";
    if (types.includes("labour_payment_due")) return "labour";
    if (types.some((type) => type === "job_broadcast_ready" || type === "job_awaiting_response" || type === "job_unfilled" || type === "dispatch_request_pending")) return "dispatch";
    if (types.includes("job_missing_required_fields")) return "summary";
    return "summary";
  }

  function openAlert(alert: AlertGroup) {
    if (alert.entityType === "job") {
      const job = jobById.get(alert.entityId);
      if (job) {
        setActiveJobSection(getInitialSection(alert));
        setActiveJob(job);
      }
      return;
    }

    const worker = workerById.get(alert.entityId);
    if (worker) setActiveWorker(worker);
  }

  const summaryText = [
    payload.summary.dispatchRequests ? `${payload.summary.dispatchRequests} dispatch request` : null,
    payload.summary.broadcastReady ? `${payload.summary.broadcastReady} broadcast ready` : null,
    payload.summary.awaitingResponse ? `${payload.summary.awaitingResponse} awaiting response` : null,
    payload.summary.unfilledJobs ? `${payload.summary.unfilledJobs} unfilled` : null,
    payload.summary.invoiceRequired ? `${payload.summary.invoiceRequired} invoice` : null,
    payload.summary.unpaidIncome ? `${payload.summary.unpaidIncome} payment follow-up` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      style={{
        marginBottom: "1.25rem",
        padding: collapsed ? "0.85rem 1rem" : "1rem",
        border: "1px solid var(--rd-border)",
        borderRadius: 20,
        background: "var(--rd-bg-elevated)",
        color: "var(--rd-text)",
        boxShadow: "var(--rd-shadow)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Dispatch Alerts</h2>
          <p style={{ margin: "0.25rem 0 0", color: "var(--rd-text-muted)" }}>
            {visibleAlerts.length === 0
              ? "No active dispatch alerts"
              : summaryText || `${visibleAlerts.length} active alert group${visibleAlerts.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <IconButton
          label={collapsed ? "Expand alerts" : "Collapse alerts"}
          onClick={() => setCollapsed((current) => !current)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            {collapsed ? (
              <path
                d="M3 7H11M7 3V11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 7H11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            )}
          </svg>
        </IconButton>
      </div>

      {collapsed ? null : visibleAlerts.length === 0 ? (
        <p style={{ margin: "0.9rem 0 0", color: "var(--rd-text-muted)" }}>{payload.message || "No active dispatch alerts"}</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: "0.65rem",
              flexWrap: "wrap",
              marginTop: "0.9rem",
              color: "var(--rd-text-muted)",
              fontSize: "0.94rem",
            }}
          >
            {payload.summary.broadcastReady ? (
              <span>Broadcast ready: {payload.summary.broadcastReady}</span>
            ) : null}
            {payload.summary.awaitingResponse ? (
              <span>Awaiting response: {payload.summary.awaitingResponse}</span>
            ) : null}
            {payload.summary.dispatchRequests ? (
              <span>Dispatch requests: {payload.summary.dispatchRequests}</span>
            ) : null}
            <span>Unfilled: {payload.summary.unfilledJobs}</span>
            <span>Invoice required: {payload.summary.invoiceRequired}</span>
            <span>Payment follow-up: {payload.summary.unpaidIncome}</span>
            {payload.summary.workersMissingDocuments ? (
              <span>Missing worker documents: {payload.summary.workersMissingDocuments}</span>
            ) : null}
            {payload.summary.startingSoonUnfilled ? (
              <span>Starting soon: {payload.summary.startingSoonUnfilled}</span>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.9rem" }}>
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rd-themed-card"
                style={{ cursor: "pointer" }}
                onClick={() => openAlert(alert)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") openAlert(alert);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <strong>{alert.title}</strong>
                    {alert.subtitle ? (
                      <div style={{ marginTop: "0.25rem", color: "var(--rd-text-muted)", fontSize: "0.92rem" }}>
                        {alert.subtitle}
                      </div>
                    ) : null}
                    {alert.items.length > 0 ? (
                      <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
                        {alert.items.map((item) => (
                          <li key={`${alert.id}-${item.type}-${item.label}`} style={{ marginBottom: "0.3rem", color: "var(--rd-text-muted)" }}>
                            <strong style={{ color: "var(--rd-text)" }}>{item.label}</strong>
                            {item.detail ? `: ${item.detail}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <IconButton
                    label={`Dismiss ${alert.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDismissedTypes((current) =>
                        current.includes(alert.id) ? current : [...current, alert.id],
                      );
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <JobDetailModal
        open={Boolean(activeJob)}
        job={activeJob}
        onClose={() => setActiveJob(null)}
        mode="admin"
        initialSection={activeJobSection}
      />
      <WorkerProfileModal
        open={Boolean(activeWorker)}
        worker={activeWorker}
        onClose={() => setActiveWorker(null)}
        mode="admin"
        initialTab="Credentials / Compliance"
      />
    </section>
  );
}
