"use client";

import { useMemo, useState } from "react";
import { Badge, Button, ScrollArea } from "@radix-ui/themes";
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

function CompareField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="mobile-compare-field">
      <div className="mobile-compare-field-label">{label}</div>
      <div className="mobile-compare-field-value">{value}</div>
    </div>
  );
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
        className="compare-contractors-desktop-content"
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
      <div className="compare-contractors-mobile-content job-detail-modal-content">
        <ScrollArea type="auto" scrollbars="horizontal" className="mobile-compare-carousel-scroll">
          <div className="mobile-compare-carousel-track">
            {workers.map((worker) => {
              const displayName = isLimitedProviderView
                ? getProviderFacingDisplayName(worker)
                : worker.full_name;
              const locationLabel = isLimitedProviderView
                ? getProviderFacingLocationLabel(worker)
                : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`;
              const workforceType = worker.workerType === "contractor" ? "Contractor" : "Tradesman";
              const isExpanded = expandedPackId === worker.worker_id;
              const scoreFields = worker.stathub.status !== "insufficient"
                ? [
                    ["Site Score overall", metricValue(worker.stathub.overallScore)],
                    ["Reliability", metricValue(worker.stathub.reliabilityScore)],
                    ["Site Conduct", metricValue(worker.stathub.siteConductScore)],
                    ["Work Quality", metricValue(worker.stathub.workQualityScore)],
                  ] as Array<[string, string | number]>
                : [];

              return (
                <section key={worker.worker_id} className="mobile-compare-card">
                  <div className="mobile-compare-card-header">
                    <h3 className="mobile-compare-card-title">{displayName}</h3>
                    <p className="mobile-compare-meta">
                      {workforceType} | {locationLabel}
                    </p>
                  </div>

                  <div className="mobile-compare-badges" aria-label="Comparison highlights">
                    {bestReliability.has(worker.worker_id) ? <Badge size="1" color="green" variant="soft">Best Reliability</Badge> : null}
                    {bestWorkQuality.has(worker.worker_id) ? <Badge size="1" color="blue" variant="soft">Best Work Quality</Badge> : null}
                    {mostPlatformJobHistory.has(worker.worker_id) ? <Badge size="1" color="orange" variant="soft">Most Platform Job History</Badge> : null}
                  </div>

                  <div className="mobile-compare-field-list">
                    <CompareField label="Workforce type" value={workforceType} />
                    {worker.contractorType ? (
                      <CompareField
                        label="Contractor type"
                        value={worker.contractorType === "multi_discipline" ? "Multi-Discipline" : "Specialist"}
                      />
                    ) : null}
                    {worker.workerType === "contractor" ? (
                      <CompareField label="Specialist Area" value={worker.specialistArea ?? "Not recorded"} />
                    ) : (
                      <CompareField label="Skill Tag" value={worker.skillTag ?? "Not recorded"} />
                    )}
                    <CompareField label="Avg Response Time" value={worker.avgResponseTimeLabel ?? "Not recorded"} />
                    <CompareField label="Languages Spoken" value={worker.languagesSpoken.length > 0 ? worker.languagesSpoken.join(", ") : "Not provided"} />
                    <CompareField label="Site Score status" value={getSiteScoreStatusLabel(worker.stathub.status)} />
                    {scoreFields.map(([label, value]) => (
                      <CompareField key={label} label={label} value={value} />
                    ))}
                    {worker.stathub.status === "insufficient" ? (
                      <p className="mobile-compare-note">
                        Score confidence is still building through verified completed jobs, review evidence, and portfolio-backed proof.
                      </p>
                    ) : null}
                    <CompareField label="Completed platform jobs" value={worker.stathub.verifiedBookingsCount} />
                    <CompareField label="Credentials" value={worker.credentialsSummary.length ? worker.credentialsSummary.join(", ") : "Not provided"} />
                    <CompareField label="Portfolio" value={worker.portfolio.length > 0 ? worker.portfolio.map((item) => item.title).join(", ") : "No portfolio highlights yet"} />
                  </div>

                  <div className="mobile-compare-actions">
                    <Button type="button" size="1" radius="full" variant="surface" onClick={() => onViewProfile(worker)}>
                      View profile
                    </Button>
                    <Button
                      type="button"
                      size="1"
                      radius="full"
                      variant="surface"
                      aria-label={isExpanded ? "Hide tender confidence pack" : "View tender confidence pack"}
                      onClick={() =>
                        setExpandedPackId((current) => (current === worker.worker_id ? null : worker.worker_id))
                      }
                    >
                      {isExpanded ? "Hide pack" : "Tender pack"}
                    </Button>
                  </div>

                  {isExpanded ? (
                    <div className="mobile-compare-pack">
                      <TenderConfidencePackPreview worker={worker} defaultOpen mode={mode} />
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </Modal>
  );
}
