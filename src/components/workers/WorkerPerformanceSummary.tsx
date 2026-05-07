import type { WorkerOverviewRow } from "@/lib/workers/types";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function WorkerPerformanceSummary({ worker }: { worker: WorkerOverviewRow }) {
  const items = [
    { label: "Verified completed jobs", value: worker.statHubMeta.verifiedCompletedJobsCount },
    { label: "Reviewed jobs contributing", value: worker.statHubMeta.reviewedJobsCount },
    { label: "Portfolio-backed jobs", value: worker.statHubMeta.portfolioBackedJobsCount ?? 0 },
    { label: "Repeat-booked by clients", value: worker.statHubMeta.repeatBookedCount ?? worker.performanceSummary.repeatClientsCount ?? 0 },
    { label: "No-show incidents", value: worker.performanceSummary.noShowIncidents ?? 0 },
    { label: "Same-day cancellations", value: worker.performanceSummary.sameDayCancellations ?? 0 },
    { label: "Last booking completed", value: formatDate(worker.performanceSummary.lastBookingCompletedAt) },
    {
      label: "Next score release",
      value: formatDate(worker.stathub.nextReleaseAt),
    },
  ];

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Performance Summary</h3>
        <p style={{ margin: "0.3rem 0 0", color: "var(--rd-text-muted)" }}>
          Verified platform activity, score credibility signals, and recent delivery indicators.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gap: "0.7rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              border: "1px solid var(--rd-border)",
              borderRadius: 14,
              padding: "0.85rem 0.95rem",
              background: "var(--rd-surface-soft)",
            }}
          >
            <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>{item.label}</div>
            <div style={{ marginTop: "0.25rem", fontWeight: 700, color: "var(--rd-text)" }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: "0.35rem", color: "var(--rd-text-muted)" }}>
        {worker.clientFeedbackHighlights.map((line) => (
          <p key={line} style={{ margin: 0 }}>
            {line}
          </p>
        ))}
        <p style={{ margin: 0 }}>
          Score credibility improves through repeated verified completed jobs, client review evidence, and portfolio-backed project proof.
        </p>
      </div>
      {worker.recent_completed_jobs.length > 0 ? (
        <section style={{ display: "grid", gap: "0.55rem" }}>
          <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Completed platform jobs on record</h4>
          <div style={{ display: "grid", gap: "0.55rem" }}>
            {worker.recent_completed_jobs.map((job) => (
              <div
                key={`${job.jobId}-${job.completedAt ?? job.bookingStatus}`}
                style={{
                  border: "1px solid var(--rd-border)",
                  borderRadius: 12,
                  padding: "0.75rem 0.85rem",
                  background: "var(--rd-surface-soft)",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--rd-text)" }}>{job.jobTitle}</div>
                <div style={{ marginTop: "0.2rem", color: "var(--rd-text-muted)" }}>
                  Secured by {job.providerName}
                  {job.requiredRole ? ` | ${job.requiredRole}` : ""}
                </div>
                <div style={{ marginTop: "0.2rem", color: "var(--rd-text-soft)", fontSize: "0.9rem" }}>
                  {job.completedAt ? `Completed ${formatDate(job.completedAt)}` : "Completed date pending"} | Status {job.bookingStatus}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
