"use client";

import { useState } from "react";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import {
  buildProviderAccessSeed,
  canDownloadTenderPack,
  getProviderFacingDisplayName,
  getProviderFacingLocationLabel,
  getSiteScoreStatusLabel,
  readProviderAccessState,
  recordProviderAuditEvent,
} from "@/lib/provider-access";
import type { WorkerOverviewRow } from "@/lib/workers/types";

function formatReleaseDate(value: string | null) {
  if (!value) return "TBC";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function TenderConfidencePackPreview({
  worker,
  defaultOpen = false,
  mode = "admin",
}: {
  worker: WorkerOverviewRow;
  defaultOpen?: boolean;
  mode?: "admin" | "job_provider";
}) {
  const { user } = useAuthSession();
  const [open, setOpen] = useState(defaultOpen);
  const providerId = user?.providerId ?? "job-provider-local";
  const isLimitedProviderView = mode === "job_provider" && user?.role === "job_provider";
  const accessSeed = buildProviderAccessSeed({
    accountTier: user?.accountTier,
    billingStatus: user?.billingStatus,
    paygPackType: user?.paygPackType,
    paygDispatchAllowanceTotal: user?.paygDispatchAllowanceTotal,
    paygDispatchAllowanceRemaining: user?.paygDispatchAllowanceRemaining,
    monthlyRenewalDate: user?.monthlyRenewalDate,
    monthlyActive: user?.monthlyActive,
        trialAccess: user?.trialAccess,
        isTrialMonth: user?.isTrialMonth,
        trialGrantedByAdmin: user?.trialGrantedByAdmin,
        trialStartDate: user?.trialStartDate,
        trialEndDate: user?.trialEndDate,
        trialStatus: user?.trialStatus,
        trialAccessLevel: user?.trialAccessLevel,
        profileOpensThisMonth: user?.profileOpensThisMonth,
        compareActionsThisMonth: user?.compareActionsThisMonth,
        manualDraftsUsed: user?.manualDraftsUsed,
  });
  const scoreStatus = getSiteScoreStatusLabel(worker.stathub.status);
  const scoreEvidenceCopy =
    worker.stathub.status === "insufficient"
      ? "A credible public Site Score begins after 3 verified completed platform jobs with valid review data. Until then, score confidence is still building through direct review activity and portfolio-backed proof."
      : worker.stathub.status === "provisional"
        ? "This score is based on early verified platform activity and becomes more reliable as more completed jobs, review evidence, and portfolio-backed proof are added."
        : "This Site Score is based on a stronger body of verified completed platform jobs and monthly validated review evidence.";
  const credentialsSummary = [
    `Insurance verified: ${worker.credentialsCompliance.insuranceVerified ? "Yes" : "No"}`,
    `Enhanced DBS: ${worker.credentialsCompliance.enhancedDbs ? "Yes" : "No"}`,
    `Right to work verified: ${worker.credentialsCompliance.rightToWorkVerified ? "Yes" : "No"}`,
    `CSCS verified: ${worker.credentialsCompliance.cscsVerified ? "Yes" : "No"}`,
  ].join(" | ");
  const profileTitle = isLimitedProviderView
    ? `${worker.workerType === "contractor" ? "Contractor" : "Tradesman"}: ${getProviderFacingDisplayName(worker)}`
    : `${worker.workerType === "contractor" ? "Contractor" : "Tradesman"}: ${worker.full_name}`;
  const locationArea = isLimitedProviderView
    ? getProviderFacingLocationLabel(worker)
    : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`;

  function handleDownload() {
    if (typeof window === "undefined") return;
    if (isLimitedProviderView) {
      const accessState = readProviderAccessState(providerId, accessSeed);
      const gate = canDownloadTenderPack(accessState);
      if (!gate.allowed) {
        window.alert(gate.message ?? "Tender Confidence Pack download is unavailable on this plan.");
        return;
      }
      recordProviderAuditEvent(providerId, "pack_opened", { workerId: worker.worker_id, action: "download" });
    }

    const content = [
      `Tender Confidence Pack`,
      profileTitle,
      `Trade / Category: ${worker.primary_role ?? worker.skillTag ?? "-"}`,
      `Workforce Type: ${worker.workerType === "contractor" ? "Contractor" : "Tradesman"}`,
      `Contractor Type: ${
        worker.contractorType
          ? worker.contractorType === "multi_discipline"
            ? "Multi-Discipline"
            : "Specialist"
          : "Not applicable"
      }`,
      `Specialist Area: ${worker.specialistArea ?? "Not applicable"}`,
      `Location Area: ${locationArea}`,
      `Avg Response Time: ${worker.avgResponseTimeLabel ?? "Not recorded"}`,
      `Site Score Status: ${scoreStatus}`,
      `Verified Completed Jobs: ${worker.statHubMeta.verifiedCompletedJobsCount}`,
      `Reviewed Jobs Contributing: ${worker.statHubMeta.reviewedJobsCount}`,
      `Portfolio-backed Jobs: ${worker.statHubMeta.portfolioBackedJobsCount ?? 0}`,
      `Repeat-booked Count: ${worker.statHubMeta.repeatBookedCount ?? 0}`,
      `Languages Spoken: ${worker.languagesSpoken.length > 0 ? worker.languagesSpoken.join(", ") : "Not provided"}`,
      `Credentials / Compliance: ${credentialsSummary}`,
      `Client Feedback Highlights: ${worker.clientFeedbackHighlights.join(" | ")}`,
      `Next Score Release: ${formatReleaseDate(worker.stathub.nextReleaseAt)}`,
      ``,
      scoreEvidenceCopy,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profileTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-tender-confidence-pack.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Tender Confidence Pack</h3>
          <p style={{ margin: "0.3rem 0 0", color: "var(--rd-text-muted)" }}>
            Contractor evidence pack powered by StatHub for shortlist and procurement review.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setOpen((current) => !current)}>
            {open ? "Hide Tender Confidence Pack" : "View Tender Confidence Pack"}
          </button>
          <button type="button" onClick={handleDownload}>
            Download Tender Confidence Pack
          </button>
        </div>
      </div>

      {open ? (
        <div
          style={{
            display: "grid",
            gap: "0.85rem",
            padding: "1rem",
            borderRadius: 16,
            border: "1px solid var(--rd-border)",
            background: "var(--rd-surface-soft)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Profile</div>
              <strong>{profileTitle}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Trade / Category</div>
              <strong>{worker.skillTag ?? worker.specialistArea ?? worker.primary_role ?? worker.workerType}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Workforce Type</div>
              <strong>{worker.workerType === "contractor" ? "Contractor" : "Tradesman"}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Location Area</div>
              <strong>{locationArea}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Avg Response Time</div>
              <strong>{worker.avgResponseTimeLabel ?? "Not recorded"}</strong>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Site Score status</div>
              <strong>{scoreStatus}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Verified completed jobs</div>
              <strong>{worker.statHubMeta.verifiedCompletedJobsCount}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Reviewed jobs contributing</div>
              <strong>{worker.statHubMeta.reviewedJobsCount}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Portfolio-backed jobs</div>
              <strong>{worker.statHubMeta.portfolioBackedJobsCount ?? 0}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Repeat-booked count</div>
              <strong>{worker.statHubMeta.repeatBookedCount ?? 0}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Next score release</div>
              <strong>{formatReleaseDate(worker.stathub.nextReleaseAt)}</strong>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Primary Role</div>
              <strong>{worker.workerType === "contractor" ? "Contractor" : "Tradesman"}</strong>
            </div>
            {worker.contractorType ? (
              <div>
                <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Contractor Type</div>
                <strong>{worker.contractorType === "multi_discipline" ? "Multi-Discipline" : "Specialist"}</strong>
              </div>
            ) : null}
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>
                {worker.workerType === "contractor" ? "Specialist Area" : "Skill Tag"}
              </div>
              <strong>{worker.specialistArea ?? worker.skillTag ?? "Not recorded"}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Languages Spoken</div>
              <strong>{worker.languagesSpoken.length > 0 ? worker.languagesSpoken.join(", ") : "Not provided"}</strong>
            </div>
          </div>

          {worker.stathub.status !== "insufficient" ? (
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Site Score snapshot</div>
              <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text)", fontWeight: 700 }}>
                {(worker.stathub.overallScore ?? worker.stathub.internalScoreSnapshot ?? 0)}/100
              </p>
            </div>
          ) : null}

          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Score confidence</div>
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text)" }}>{scoreEvidenceCopy}</p>
          </div>

          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Portfolio highlights</div>
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text)" }}>
              {worker.portfolio.length > 0
                ? worker.portfolio.map((item) => item.title).join(" | ")
                : "Portfolio evidence is still being assembled."}
            </p>
          </div>

          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Credentials / compliance</div>
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text)" }}>{credentialsSummary}</p>
          </div>

          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Client feedback highlights</div>
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text)" }}>
              {worker.clientFeedbackHighlights.join(" | ")}
            </p>
          </div>

          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>Scoring workflow</div>
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text)" }}>
              StatHub generates Site Score monthly using only jobs completed through the platform, then admin validates the release.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
