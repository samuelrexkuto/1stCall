import type { WorkerOverviewRow } from "@/lib/workers/types";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function WorkerPerformanceSummary({
  worker,
  showExtendedFactors = false,
}: {
  worker: WorkerOverviewRow;
  showExtendedFactors?: boolean;
}) {
  const items = [
    { label: "Total jobs contributing to score", value: worker.statHubMeta.reviewedJobsCount ?? 0 },
    { label: "Platform jobs contributing to score", value: worker.statHubMeta.verifiedCompletedJobsCount ?? 0 },
    { label: "Off-platform jobs contributing to score", value: worker.statHubMeta.portfolioBackedJobsCount ?? 0 },
    { label: "Repeat-booked count", value: worker.statHubMeta.repeatBookedCount ?? worker.performanceSummary.repeatClientsCount ?? 0 },
    ...(showExtendedFactors
      ? [
          { label: "No-show incidents", value: worker.performanceSummary.noShowIncidents ?? 0 },
          { label: "Same-day cancellations", value: worker.performanceSummary.sameDayCancellations ?? 0 },
          { label: "Last booking completed", value: formatDate(worker.performanceSummary.lastBookingCompletedAt) },
          { label: "Next score release", value: formatDate(worker.stathub.nextReleaseAt) },
        ]
      : []),
  ];

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Performance Summary</h3>
        <p style={{ margin: "0.3rem 0 0", color: "var(--rd-text-muted)" }}>
          Simple score-contribution metrics for admin review.
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
    </section>
  );
}
