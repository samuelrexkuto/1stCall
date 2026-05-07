"use client";

import { useMemo, useState } from "react";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { Modal } from "@/components/ui/Modal";
import { TenderConfidencePackPreview } from "@/components/workers/TenderConfidencePackPreview";
import {
  getProviderFacingDisplayName,
  getProviderFacingLocationLabel,
  getSiteScoreStatusLabel,
} from "@/lib/provider-access";
import type { WorkerOverviewRow } from "@/lib/workers/types";

function metricValue(value: number | null) {
  return value ?? 0;
}

function topWorkerIds(workers: WorkerOverviewRow[], selector: (worker: WorkerOverviewRow) => number) {
  const highest = Math.max(...workers.map(selector));
  return new Set(workers.filter((worker) => selector(worker) === highest).map((worker) => worker.worker_id));
}

export function CompareContractorsModal({
  open,
  workers,
  onClose,
  onViewProfile,
  mode = "admin",
}: {
  open: boolean;
  workers: WorkerOverviewRow[];
  onClose: () => void;
  onViewProfile: (worker: WorkerOverviewRow) => void;
  mode?: "admin" | "job_provider";
}) {
  const { user } = useAuthSession();
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const isLimitedProviderView = mode === "job_provider" && user?.role === "job_provider";
  const bestReliability = useMemo(
    () => topWorkerIds(workers, (worker) => worker.stathub.reliabilityScore ?? -1),
    [workers],
  );
  const bestWorkQuality = useMemo(
    () => topWorkerIds(workers, (worker) => worker.stathub.workQualityScore ?? -1),
    [workers],
  );
  const mostPlatformJobHistory = useMemo(
    () => topWorkerIds(workers, (worker) => worker.stathub.verifiedBookingsCount),
    [workers],
  );

  return (
    <Modal open={open} title="Compare Contractors / Tradesmen" onClose={onClose}>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: `repeat(${Math.max(1, workers.length)}, minmax(0, 1fr))`,
        }}
      >
        {workers.map((worker) => (
          (() => {
            const displayName = isLimitedProviderView
              ? getProviderFacingDisplayName(worker)
              : worker.full_name;
            const locationLabel = isLimitedProviderView
              ? getProviderFacingLocationLabel(worker)
              : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`;
            return (
          <section
            key={worker.worker_id}
            style={{
              border: "1px solid var(--rd-border)",
              borderRadius: 16,
              padding: "1rem",
              background: "var(--rd-surface-soft)",
              color: "var(--rd-text)",
              display: "grid",
              gap: "0.65rem",
              alignContent: "start",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{displayName}</h3>
              <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
                {worker.workerType === "contractor" ? "Contractor" : "Tradesman"} |{" "}
                {locationLabel}
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {bestReliability.has(worker.worker_id) ? <span style={{ fontSize: "0.8rem", color: "#166534" }}>Best Reliability</span> : null}
              {bestWorkQuality.has(worker.worker_id) ? <span style={{ fontSize: "0.8rem", color: "#1d4ed8" }}>Best Work Quality</span> : null}
              {mostPlatformJobHistory.has(worker.worker_id) ? <span style={{ fontSize: "0.8rem", color: "#92400e" }}>Most Platform Job History</span> : null}
            </div>

            <p style={{ margin: 0 }}><strong>Workforce type:</strong> {worker.workerType === "contractor" ? "Contractor" : "Tradesman"}</p>
            {worker.contractorType ? (
              <p style={{ margin: 0 }}>
                <strong>Contractor type:</strong> {worker.contractorType === "multi_discipline" ? "Multi-Discipline" : "Specialist"}
              </p>
            ) : null}
            {worker.workerType === "contractor" ? (
              <p style={{ margin: 0 }}><strong>Specialist Area:</strong> {worker.specialistArea ?? "Not recorded"}</p>
            ) : (
              <p style={{ margin: 0 }}><strong>Skill Tag:</strong> {worker.skillTag ?? "Not recorded"}</p>
            )}
            <p style={{ margin: 0 }}><strong>Avg Response Time:</strong> {worker.avgResponseTimeLabel ?? "Not recorded"}</p>
            <p style={{ margin: 0 }}><strong>Languages Spoken:</strong> {worker.languagesSpoken.length > 0 ? worker.languagesSpoken.join(", ") : "Not provided"}</p>
            <p style={{ margin: 0 }}>
              <strong>Site Score status:</strong>{" "}
              {getSiteScoreStatusLabel(worker.stathub.status)}
            </p>
            {worker.stathub.status !== "insufficient" ? (
              <>
                <p style={{ margin: 0 }}><strong>Site Score overall:</strong> {metricValue(worker.stathub.overallScore)}</p>
                <p style={{ margin: 0 }}><strong>Reliability:</strong> {metricValue(worker.stathub.reliabilityScore)}</p>
                <p style={{ margin: 0 }}><strong>Site Conduct:</strong> {metricValue(worker.stathub.siteConductScore)}</p>
                <p style={{ margin: 0 }}><strong>Work Quality:</strong> {metricValue(worker.stathub.workQualityScore)}</p>
              </>
            ) : (
              <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
                Score confidence is still building through verified completed jobs, review evidence, and portfolio-backed proof.
              </p>
            )}
            <p style={{ margin: 0 }}><strong>Completed platform jobs:</strong> {worker.stathub.verifiedBookingsCount}</p>
            <p style={{ margin: 0 }}><strong>Credentials:</strong> {worker.credentialsSummary.join(", ")}</p>
            <p style={{ margin: 0 }}><strong>Portfolio:</strong> {worker.portfolio.length > 0 ? worker.portfolio.map((item) => item.title).join(", ") : "No portfolio highlights yet"}</p>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              <button type="button" onClick={() => onViewProfile(worker)}>
                View Full Profile
              </button>
              <button
                type="button"
                onClick={() =>
                  setExpandedPackId((current) => (current === worker.worker_id ? null : worker.worker_id))
                }
              >
                {expandedPackId === worker.worker_id ? "Hide Tender Confidence Pack" : "View Tender Confidence Pack"}
              </button>
            </div>

            {expandedPackId === worker.worker_id ? (
              <TenderConfidencePackPreview worker={worker} defaultOpen mode={mode} />
            ) : null}
          </section>
            );
          })()
        ))}
      </div>
    </Modal>
  );
}
