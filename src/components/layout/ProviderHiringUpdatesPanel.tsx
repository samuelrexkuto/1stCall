"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import { normaliseBroadcastStatus } from "@/lib/dispatch/broadcast-status-constants";
import { getProviderFacingJobLocation } from "@/lib/provider-job-status";

function getHiringUpdateTitle(job: JobOverviewRow) {
  const needed = Number(job.workers_required ?? 0);
  const confirmed = Number(job.workers_confirmed ?? 0);
  const remaining = Math.max(needed - confirmed, 0);
  const broadcastStatus = normaliseBroadcastStatus(job.broadcast_status);

  if (needed > 0 && confirmed >= needed) return "Fully staffed";
  if (confirmed > 0 && remaining > 0) return "Partially filled";
  if (broadcastStatus === "completed") return "Dispatch completed";
  if (broadcastStatus === "awaiting response") return "Awaiting worker response";
  if (broadcastStatus === "broadcast ready") return "Ready for dispatch";
  return "Needs job details";
}

function getHiringUpdateDescription(job: JobOverviewRow) {
  const title = getHiringUpdateTitle(job);
  if (title === "Fully staffed") return "All required workers have been confirmed for this job.";
  if (title === "Partially filled") {
    return "Some workers have been confirmed, but this job still needs more workers before it is fully covered.";
  }
  if (title === "Dispatch completed") {
    return "Dispatch has been sent and the job has been marked as completed by admin.";
  }
  if (title === "Awaiting worker response") {
    return "Dispatch has been sent successfully. Waiting for worker responses and confirmations.";
  }
  if (title === "Ready for dispatch") {
    return "This job has been created and is ready for admin dispatch. No workers have been confirmed yet.";
  }
  return "This job is missing required dispatch information before it can be broadcast.";
}

function getHiringUpdateNextAction(job: JobOverviewRow) {
  const title = getHiringUpdateTitle(job);
  if (title === "Fully staffed") return "Review booking details or monitor attendance.";
  if (title === "Partially filled") return "Continue dispatching to fill the remaining worker slots.";
  if (title === "Dispatch completed") return "Monitor worker attendance and job progress.";
  if (title === "Awaiting worker response") return "Monitor incoming worker responses and confirm bookings.";
  if (title === "Ready for dispatch") {
    return "Review the matched tradesmen/contractors or send the dispatch broadcast from Jobs Overview.";
  }
  return "Open Jobs Overview and complete the missing job details.";
}

function getStatusPillClass(job: JobOverviewRow) {
  const title = getHiringUpdateTitle(job);
  if (title === "Fully staffed") return "rd-status-pill rd-status-pill-success";
  if (title === "Dispatch completed") return "rd-status-pill rd-status-pill-success";
  if (title === "Awaiting worker response") return "rd-status-pill rd-status-pill-info";
  if (title === "Needs job details") return "rd-status-pill rd-status-pill-warning";
  return "rd-status-pill rd-status-pill-info";
}

function AlertDetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rd-detail-field">
      <div className="rd-detail-label">{label}</div>
      <div className="rd-detail-value">{value === null || value === undefined || value === "" ? "Not provided" : value}</div>
    </div>
  );
}

interface ReleasedWorkforceRow {
  assignment_id: string;
  worker_id: string;
  assignment_status: string;
  worker: {
    name: string;
    role: string | null;
    workforce_type: string;
    location: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
    site_score: number | null;
    compliance_summary: string[];
    portfolio_available?: boolean;
  };
}

export function ProviderHiringUpdatesPanel({
  jobs,
}: {
  jobs: JobOverviewRow[];
}) {
  const [releasedByJob, setReleasedByJob] = useState<Record<string, ReleasedWorkforceRow[]>>({});

  useEffect(() => {
    const completedJobs = jobs.filter((job) => normaliseBroadcastStatus(job.broadcast_status) === "completed");
    if (completedJobs.length === 0) {
      setReleasedByJob({});
      return;
    }

    let cancelled = false;
    async function loadReleasedWorkforce() {
      const entries = await Promise.all(
        completedJobs.map(async (job) => {
          try {
            const response = await fetch(`/api/client/jobs/${job.job_id}/released-workforce`, { cache: "no-store" });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.ok !== true || !Array.isArray(payload.workers)) return [job.job_id, []] as const;
            return [job.job_id, payload.workers as ReleasedWorkforceRow[]] as const;
          } catch {
            return [job.job_id, []] as const;
          }
        }),
      );
      if (!cancelled) {
        setReleasedByJob(Object.fromEntries(entries.filter(([, workers]) => workers.length > 0)));
      }
    }

    void loadReleasedWorkforce();
    return () => {
      cancelled = true;
    };
  }, [jobs]);

  return (
    <section
      style={{
        marginBottom: "1.25rem",
        padding: "1rem",
        border: "1px solid var(--rd-border)",
        borderRadius: 20,
        background: "var(--rd-bg-elevated)",
        color: "var(--rd-text)",
        boxShadow: "var(--rd-shadow)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Hiring Updates</h2>
          <p style={{ margin: "0.25rem 0 0", color: "var(--rd-text-muted)" }}>
            Provider-scoped progress updates for dispatch activity, shortlist review, and confirmed bookings.
          </p>
        </div>
        <Link href="/jobs">View Jobs Overview</Link>
      </div>

      {jobs.length === 0 ? (
        <p style={{ margin: "0.9rem 0 0", color: "var(--rd-text-muted)" }}>
          No hiring updates yet. Active requests will appear here once dispatch activity begins.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.9rem" }}>
          {jobs.slice(0, 6).map((job) => {
            const title = getHiringUpdateTitle(job);
            const description = getHiringUpdateDescription(job);
            const nextAction = getHiringUpdateNextAction(job);
            const location = getProviderFacingJobLocation(job);
            const matchingCount = Array.isArray(job.matching_workers) ? job.matching_workers.length : 0;
            const releasedWorkers = releasedByJob[job.job_id] ?? [];
            const remaining = Math.max(0, Number(job.workers_required ?? 0) - Number(job.workers_confirmed ?? 0));
            return (
              <article
                key={job.job_id}
                className="rd-themed-card"
              >
                <div style={{ display: "grid", gap: "0.65rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--rd-text)", fontSize: "1rem" }}>{title}</strong>
                    <span className={getStatusPillClass(job)}>
                      {job.broadcast_status || job.job_status}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: "var(--rd-text-muted)", lineHeight: 1.5 }}>
                    {description}
                  </p>
                  <div className="rd-alert-grid">
                    <AlertDetailField label="Job title" value={job.job_title} />
                    <AlertDetailField label="Required role" value={job.trade_type ?? "General workforce"} />
                    <AlertDetailField label="Location" value={location} />
                    <AlertDetailField label="Start date" value={job.start_date || "TBC"} />
                    <AlertDetailField label="Workers needed" value={job.workers_required} />
                    <AlertDetailField label="Workers confirmed" value={job.workers_confirmed} />
                    <AlertDetailField label="Workers remaining" value={remaining} />
                    <AlertDetailField label="Current matches" value={matchingCount} />
                    <AlertDetailField label="Payment status" value={job.payment_status || "TBC"} />
                    <AlertDetailField label="Broadcast status" value={job.broadcast_status || "TBC"} />
                  </div>
                  <div className="rd-themed-panel" style={{ padding: "0.75rem 0.85rem", gap: "0.25rem" }}>
                    <div className="rd-detail-label">Next action</div>
                    <div style={{ color: "var(--rd-text)", lineHeight: 1.45 }}>{nextAction}</div>
                  </div>
                  {releasedWorkers.length > 0 ? (
                    <details
                      className="rd-themed-panel"
                      style={{ padding: "0.85rem", gap: "0.65rem" }}
                      open
                    >
                      <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--rd-text)" }}>
                        Confirmed Workforce Details — {job.trade_type ?? job.selected_role ?? job.core_role ?? "Workforce"} — {job.postcode}
                        <span style={{ display: "block", marginTop: 4, color: "var(--rd-text-muted)", fontWeight: 500 }}>
                          Your confirmed workforce for {job.trade_type ?? job.selected_role ?? job.core_role ?? "this role"} at {location}.
                        </span>
                      </summary>
                      <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.85rem" }}>
                        <div className="rd-alert-grid">
                          <AlertDetailField label="Job title" value={job.job_title} />
                          <AlertDetailField label="Location" value={location} />
                          <AlertDetailField label="Start date" value={job.start_date || "TBC"} />
                          <AlertDetailField label="Released workforce" value={releasedWorkers.length} />
                        </div>
                        <div style={{ display: "grid", gap: "0.65rem" }}>
                          {releasedWorkers.map((worker) => {
                            const workerLocation = worker.worker.location ?? worker.worker.postcode ?? "Location TBC";
                            const compliance = worker.worker.compliance_summary.join(" · ");

                            return (
                              <article key={worker.worker_id} className="rd-themed-card" style={{ boxShadow: "none" }}>
                                <div style={{ display: "grid", gap: "0.45rem" }}>
                                  <strong>{worker.worker.name}</strong>
                                  <span style={{ color: "var(--rd-text-muted)" }}>
                                    {worker.worker.workforce_type} · {worker.worker.role ?? "General workforce"} · {workerLocation}
                                  </span>
                                  <span>Phone: {worker.worker.phone ?? "Not provided"}</span>
                                  <span>Email: {worker.worker.email ?? "Not provided"}</span>
                                  <span>Site score: {worker.worker.site_score ?? "Insufficient verified data"}</span>
                                  <span>Compliance: {compliance || "Compliance summary not available"}</span>
                                  {worker.worker.portfolio_available ? <span>Approved portfolio/documents available on request.</span> : null}
                                  <strong style={{ color: "var(--rd-text)" }}>
                                    Do not hire or re-book this worker outside the platform. Introduction fees and legal costs may apply.
                                  </strong>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                        <div className="rd-themed-panel" style={{ padding: "0.8rem", borderColor: "#f59e0b" }}>
                          <strong>Important workforce protection notice:</strong>
                          <p style={{ margin: "0.45rem 0 0", color: "var(--rd-text)", lineHeight: 1.55 }}>
                            These workers have been introduced to you through our platform for this job only. You must not contact, hire, pay, re-book, or move this worker onto another job outside the platform without written permission from us. Doing so may breach our terms and could result in introduction fees, recovery of losses, legal costs, suspension of your account, and possible legal action.
                          </p>
                        </div>
                      </div>
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
