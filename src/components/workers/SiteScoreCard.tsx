import { SiteScoreExplanationAccordion } from "@/components/workers/SiteScoreExplanationAccordion";
import type { WorkerOverviewRow, WorkerStatHubData } from "@/lib/workers/types";

function formatReleaseDate(value: string | null) {
  if (!value) return "TBC";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: WorkerStatHubData["status"]) {
  if (status === "established") return "Established Score";
  if (status === "provisional") return "Provisional Score";
  return "Insufficient Verified Data";
}

function getStatusStyle(status: WorkerStatHubData["status"]) {
  if (status === "established") {
    return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
  }
  if (status === "provisional") {
    return { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd" };
  }
  return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
}

export function SiteScoreCard({ worker }: { worker: WorkerOverviewRow }) {
  const stathub = worker.stathub;
  const meta = worker.statHubMeta;
  const visibleScore = stathub.overallScore ?? stathub.internalScoreSnapshot ?? 0;
  const statusBody =
    stathub.status === "insufficient"
      ? [
          "A credible public Site Score begins after 3 verified completed platform jobs with valid review data.",
          "Until then, score confidence is still building through direct review activity and portfolio-backed proof.",
        ]
      : stathub.status === "provisional"
        ? [
            "This score is based on early verified platform activity and becomes more reliable as more completed jobs, review evidence, and portfolio-backed proof are added.",
          ]
        : [
            "This Site Score is based on a stronger body of verified completed platform jobs and monthly validated review evidence.",
          ];

  return (
    <section
      style={{
        padding: "1rem",
        borderRadius: 16,
        background: "var(--rd-surface-soft)",
        border: "1px solid var(--rd-border)",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Site Score presented by StatHub</h3>
          <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
            Monthly score generated from jobs completed through the platform and validated before release.
          </p>
        </div>
        <span
          style={{
            ...getStatusStyle(stathub.status),
            borderRadius: 999,
            padding: "0.3rem 0.75rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            alignSelf: "start",
          }}
        >
          {getStatusLabel(stathub.status)}
        </span>
      </div>

      {stathub.status === "insufficient" ? (
        <div style={{ display: "grid", gap: "0.45rem", color: "var(--rd-text-muted)" }}>
          {statusBody.map((line) => (
            <p key={line} style={{ margin: 0 }}>
              {line}
            </p>
          ))}
          <p style={{ margin: 0 }}>
            <strong>Verified completed jobs on record:</strong> {meta.verifiedCompletedJobsCount}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Reviewed jobs contributing to score:</strong> {meta.reviewedJobsCount}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Portfolio-backed jobs:</strong> {meta.portfolioBackedJobsCount ?? 0}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Repeat-booked count:</strong> {meta.repeatBookedCount ?? 0}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Next score release:</strong> {formatReleaseDate(stathub.nextReleaseAt)}
          </p>
        </div>
      ) : (
        <>
          {statusBody.map((line) => (
            <p key={line} style={{ margin: 0, color: "var(--rd-text-muted)" }}>
              {line}
            </p>
          ))}
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            }}
          >
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Overall Employment Score</div>
              <strong style={{ fontSize: "1.25rem" }}>{visibleScore}/100</strong>
            </div>
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Reliability</div>
              <strong>{stathub.reliabilityScore}</strong>
            </div>
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Site Conduct</div>
              <strong>{stathub.siteConductScore}</strong>
            </div>
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Work Quality</div>
              <strong>{stathub.workQualityScore}</strong>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gap: "0.55rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Verified completed jobs</div>
              <strong>{meta.verifiedCompletedJobsCount}</strong>
            </div>
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Reviewed jobs contributing</div>
              <strong>{meta.reviewedJobsCount}</strong>
            </div>
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Portfolio-backed jobs</div>
              <strong>{meta.portfolioBackedJobsCount ?? 0}</strong>
            </div>
            <div>
              <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Repeat-booked by clients</div>
              <strong>{meta.repeatBookedCount ?? 0}</strong>
            </div>
          </div>
          <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
            <strong>Next score release:</strong> {formatReleaseDate(stathub.nextReleaseAt)}
          </p>
        </>
      )}

      <SiteScoreExplanationAccordion />
    </section>
  );
}
