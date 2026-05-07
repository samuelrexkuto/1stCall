"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { Modal } from "@/components/ui/Modal";
import { SaveWorkerButton } from "@/components/workers/SaveWorkerButton";
import { SiteScoreCard } from "@/components/workers/SiteScoreCard";
import { TenderConfidencePackPreview } from "@/components/workers/TenderConfidencePackPreview";
import { WorkerDocumentsCarousel } from "@/components/workers/WorkerDocumentsCarousel";
import { WorkerPerformanceSummary } from "@/components/workers/WorkerPerformanceSummary";
import { WorkerPortfolioSection } from "@/components/workers/WorkerPortfolioSection";
import { WorkerCredentialsComplianceSection } from "@/components/workers/WorkerCredentialsComplianceSection";
import {
  applyUsageEvent,
  buildProviderAccessSeed,
  canOpenProviderProfile,
  getProviderFacingDisplayName,
  getProviderFacingLocationLabel,
  maskEmail,
  maskPhone,
  readProviderAccessState,
  recordProviderAuditEvent,
} from "@/lib/provider-access";
import { getWorkerDisplayGrouping } from "@/lib/worker-display";
import type { WorkerDocument } from "@/lib/worker-documents";
import type { WorkerOverviewRow } from "@/lib/workers/types";

const baseProfileTabs = [
  "Site Score presented by StatHub",
  "Performance Summary",
  "Portfolio",
  "Credentials / Compliance",
  "Tender Confidence Pack",
  "Documents",
] as const;

type ProfileTab = (typeof baseProfileTabs)[number];

export function WorkerProfileModal({
  worker,
  open,
  onClose,
  onBroadcast,
  mode = "admin",
  initialTab = "Site Score presented by StatHub",
}: {
  worker: WorkerOverviewRow | null;
  open: boolean;
  onClose: () => void;
  onBroadcast?: (worker: WorkerOverviewRow) => void;
  mode?: "admin" | "job_provider";
  initialTab?: ProfileTab;
}) {
  const { user } = useAuthSession();
  const [workerDocuments, setWorkerDocuments] = useState<WorkerDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [blockedMessage, setBlockedMessage] = useState("");
  const providerId = user?.providerId ?? "job-provider-local";
  const isLimitedProviderView = mode === "job_provider" && user?.role === "job_provider";
  const accessSeed = useMemo(
    () =>
      buildProviderAccessSeed({
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
      }),
    [
      user?.accountTier,
      user?.billingStatus,
      user?.monthlyActive,
      user?.monthlyRenewalDate,
      user?.paygDispatchAllowanceRemaining,
      user?.paygDispatchAllowanceTotal,
      user?.paygPackType,
    ],
  );

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open, worker?.worker_id]);

  useEffect(() => {
    if (!open || !worker || !isLimitedProviderView) {
      setBlockedMessage("");
      return;
    }

    const accessState = readProviderAccessState(providerId, accessSeed);
    const gate = canOpenProviderProfile(accessState);
    if (!gate.allowed) {
      setBlockedMessage(gate.message ?? "Profile review limit reached.");
      return;
    }

    setBlockedMessage("");
    applyUsageEvent(providerId, "profile_opened", accessSeed);
    recordProviderAuditEvent(providerId, "profile_opened", { workerId: worker.worker_id });
  }, [accessSeed, isLimitedProviderView, open, providerId, worker]);

  useEffect(() => {
    if (!worker || blockedMessage) {
      setWorkerDocuments([]);
      setDocumentsLoading(false);
      setDocumentsError("");
      return;
    }

    const controller = new AbortController();
    const workerId = worker.worker_id;

    async function loadWorkerDocuments() {
      setDocumentsLoading(true);
      setDocumentsError("");

      try {
        const response = await fetch(`/api/workers/${workerId}/documents`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.success) {
          setWorkerDocuments([]);
          setDocumentsError(payload.error ?? "Unable to load worker documents.");
          return;
        }

        setWorkerDocuments(Array.isArray(payload.documents) ? payload.documents : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setWorkerDocuments([]);
        setDocumentsError(error instanceof Error ? error.message : "Unable to load worker documents.");
      } finally {
        if (!controller.signal.aborted) {
          setDocumentsLoading(false);
        }
      }
    }

    void loadWorkerDocuments();
    return () => controller.abort();
  }, [blockedMessage, worker]);

  const profileTitle = worker
    ? isLimitedProviderView
      ? `${getWorkerDisplayGrouping(worker).typeLabel}: ${getProviderFacingDisplayName(worker)}`
      : `${getWorkerDisplayGrouping(worker).typeLabel}: ${worker.full_name}`
    : "Worker Details";
  const profileTabs = isLimitedProviderView
    ? baseProfileTabs.filter((tab) => tab !== "Documents")
    : baseProfileTabs;

  return (
    <Modal
      open={open}
      title={profileTitle}
      onClose={onClose}
    >
      {worker ? (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {blockedMessage ? (
            <section
              style={{
                display: "grid",
                gap: "0.65rem",
                padding: "1rem",
                borderRadius: 14,
                border: "1px solid rgba(245, 158, 11, 0.35)",
                background: "color-mix(in srgb, var(--rd-bg-elevated) 88%, #f59e0b 12%)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Profile preview limit reached</h3>
              <p style={{ margin: 0, color: "var(--rd-text)" }}>{blockedMessage}</p>
            </section>
          ) : null}

          {!blockedMessage ? (() => {
            const grouping = getWorkerDisplayGrouping(worker);
            const limitedTitle = `${grouping.typeLabel}: ${getProviderFacingDisplayName(worker)}`;
            const detailItems: Array<[string, string]> = [
              ["Mobile", isLimitedProviderView ? maskPhone(worker.phone) : worker.phone ?? "-"],
              ["WhatsApp", isLimitedProviderView ? maskPhone(worker.whatsapp_number) : worker.whatsapp_number ?? "-"],
              ["Email", isLimitedProviderView ? maskEmail(worker.email) : worker.email ?? "-"],
              ["Grouping", grouping.typeLabel],
              [grouping.detailLabel, grouping.detailValue],
              ["Workforce Type", grouping.typeLabel],
              [
                "Location",
                isLimitedProviderView
                  ? getProviderFacingLocationLabel(worker)
                  : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`,
              ],
              ["Avg Response Time", worker.avgResponseTimeLabel ?? "Not recorded"],
              ["Languages Spoken", worker.languagesSpoken.length ? worker.languagesSpoken.join(", ") : "Not provided"],
              ["Verified Completed Jobs", String(worker.statHubMeta.verifiedCompletedJobsCount)],
            ];

            if (worker.workerType === "contractor") {
              detailItems.splice(6, 0, [
                "Contractor Type",
                worker.contractorType
                  ? worker.contractorType === "multi_discipline"
                    ? "Multi-Discipline"
                    : "Specialist"
                  : "Not recorded",
              ]);
            }

            return (
              <>
                {isLimitedProviderView ? (
                  <section
                    style={{
                      display: "grid",
                      gap: "0.35rem",
                      padding: "0.9rem 1rem",
                      borderRadius: 14,
                      background: "var(--rd-surface-soft)",
                      border: "1px solid var(--rd-border)",
                    }}
                  >
                    <strong style={{ color: "var(--rd-text)" }}>{limitedTitle}</strong>
                    <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
                      Provider-side review keeps identity, direct contact details, and precise address masked until the platform coordinates the next stage.
                    </p>
                  </section>
                ) : null}

                <section
                  style={{
                    display: "grid",
                    gap: "0.55rem 1rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  {detailItems.map(([label, value]) => (
                    <div key={label as string} style={{ display: "grid", gap: "0.1rem" }}>
                      <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)", fontWeight: 600 }}>{label}</div>
                      <div style={{ color: "var(--rd-text)", fontWeight: 700, lineHeight: 1.25 }}>{value as string}</div>
                    </div>
                  ))}
                </section>
              </>
            );
          })() : null}

          {!blockedMessage && worker.recent_completed_jobs.length > 0 ? (
            <section
              style={{
                display: "grid",
                gap: "0.5rem",
                padding: "0.85rem 0.95rem",
                borderRadius: 14,
                background: "var(--rd-surface-soft)",
                border: "1px solid var(--rd-border)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "0.98rem" }}>Completed platform jobs in score history</h3>
                <p style={{ margin: "0.25rem 0 0", color: "var(--rd-text-muted)" }}>
                  Only jobs completed through the platform are counted in the monthly Site Score workflow.
                </p>
              </div>
              <div style={{ display: "grid", gap: "0.45rem" }}>
                {worker.recent_completed_jobs.slice(0, 3).map((job) => (
                  <div
                    key={`${job.jobId}-${job.completedAt ?? job.bookingStatus}`}
                    style={{
                      display: "grid",
                      gap: "0.15rem",
                      padding: "0.65rem 0.75rem",
                      borderRadius: 12,
                      background: "var(--rd-bg-elevated)",
                      border: "1px solid var(--rd-border)",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "var(--rd-text)" }}>{job.jobTitle}</div>
                    <div style={{ color: "var(--rd-text-muted)", fontSize: "0.92rem" }}>
                      Secured by {job.providerName}
                      {job.requiredRole ? ` | ${job.requiredRole}` : ""}
                    </div>
                    <div style={{ color: "var(--rd-text-soft)", fontSize: "0.88rem" }}>
                      {job.completedAt ? `Completed ${new Intl.DateTimeFormat("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(job.completedAt))}` : "Completed date pending"} | Status {job.bookingStatus}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!blockedMessage ? (
          <section style={{ display: "grid", gap: "0.7rem" }}>
            <div
              role="tablist"
              aria-label="Worker profile sections"
              style={{
                display: "flex",
                gap: "0.45rem",
                overflowX: "auto",
                paddingBottom: "0.15rem",
                scrollbarWidth: "thin",
              }}
            >
              {profileTabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: "0 0 auto",
                      padding: "0.58rem 0.82rem",
                      borderRadius: 999,
                      border: isActive ? "1px solid var(--rd-primary)" : "1px solid var(--rd-border)",
                      background: isActive ? "var(--rd-primary)" : "var(--rd-surface-soft)",
                      color: isActive ? "var(--rd-primary-text)" : "var(--rd-text)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              aria-label={activeTab}
              style={{
                display: "grid",
                gap: "0.85rem",
              }}
            >
              {activeTab === "Site Score presented by StatHub" ? <SiteScoreCard worker={worker} /> : null}
              {activeTab === "Performance Summary" ? <WorkerPerformanceSummary worker={worker} /> : null}
              {activeTab === "Portfolio" ? <WorkerPortfolioSection worker={worker} /> : null}
              {activeTab === "Credentials / Compliance" ? <WorkerCredentialsComplianceSection worker={worker} /> : null}
              {activeTab === "Tender Confidence Pack" ? (
                <TenderConfidencePackPreview worker={worker} defaultOpen mode={mode} />
              ) : null}
              {activeTab === "Documents" ? (
                <>
                  {documentsError ? <p style={{ margin: 0 }}>{documentsError}</p> : null}
                  {documentsLoading ? <p style={{ margin: 0 }}>Loading documents...</p> : null}
                  {!documentsLoading && !documentsError ? (
                    <WorkerDocumentsCarousel documents={workerDocuments} />
                  ) : null}
                </>
              ) : null}
            </div>
          </section>
          ) : null}

          <section style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <SaveWorkerButton worker={worker} />
            {onBroadcast ? (
              <button type="button" onClick={() => onBroadcast(worker)}>
                Broadcast / Dispatch
              </button>
            ) : null}
            {mode === "admin" ? <Link href={`/workers/${worker.worker_id}/edit`}>Edit Worker</Link> : null}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
