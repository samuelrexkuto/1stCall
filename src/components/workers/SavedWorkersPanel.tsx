"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { CompareContractorsModal } from "@/components/workers/CompareContractorsModal";
import { SaveWorkerButton } from "@/components/workers/SaveWorkerButton";
import { WorkerBroadcastModal, type DispatchJobOption } from "@/components/workers/WorkerBroadcastModal";
import { WorkerProfileModal } from "@/components/workers/WorkerProfileModal";
import {
  applyUsageEvent,
  buildProviderAccessSeed,
  canCompareProfiles,
  canRequestDispatch,
  getAccountEntitlements,
  getDispatchRemainingLabel,
  getProviderFacingDisplayName,
  getSiteScoreStatusLabel,
  getTierLabel,
  postProviderAuditEvent,
  readProviderAccessState,
  recordProviderAuditEvent,
  syncSavedShortlistCount,
  type ProviderAccessSeed,
} from "@/lib/provider-access";
import {
  getSafeWorkerDisplayName,
  getSafeWorkerSubtitle,
  getWorkerCardImage,
  getWorkerProfileImage,
} from "@/lib/worker-display";
import {
  readSavedWorkers,
  removeSavedWorker,
  SAVED_WORKERS_UPDATED_EVENT,
  type SavedWorkerRecord,
} from "@/lib/saved-workers";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export function SavedWorkersPanel({
  jobs,
  jobsUnavailable,
  preferredRole,
  mode = "admin",
  variant = "panel",
  latestWorkers = [],
  providerAccessSeed,
}: {
  jobs: DispatchJobOption[];
  jobsUnavailable?: boolean;
  preferredRole?: string;
  mode?: "admin" | "job_provider";
  variant?: "panel" | "stories";
  latestWorkers?: WorkerOverviewRow[];
  providerAccessSeed?: ProviderAccessSeed & { providerId: string; email: string | null; name: string };
}) {
  const { user } = useAuthSession();
  const [records, setRecords] = useState<SavedWorkerRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeWorker, setActiveWorker] = useState<WorkerOverviewRow | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const providerId = providerAccessSeed?.providerId ?? user?.providerId ?? "job-provider-local";
  const isJobProvider = mode === "job_provider" && user?.role === "job_provider";
  const accessSeed = useMemo(
    () =>
      buildProviderAccessSeed(
        providerAccessSeed ?? {
          accountTier: user?.accountTier,
          billingStatus: user?.billingStatus,
          paygPackType: user?.paygPackType,
          paygDispatchAllowanceTotal: user?.paygDispatchAllowanceTotal,
          paygDispatchAllowanceRemaining: user?.paygDispatchAllowanceRemaining,
          monthlyRenewalDate: user?.monthlyRenewalDate,
          monthlyActive: user?.monthlyActive,
          activeSubscription: user?.monthlyActive,
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
        },
      ),
    [
      providerAccessSeed,
      user?.accountTier,
      user?.billingStatus,
      user?.compareActionsThisMonth,
      user?.isTrialMonth,
      user?.manualDraftsUsed,
      user?.monthlyActive,
      user?.monthlyRenewalDate,
      user?.paygDispatchAllowanceRemaining,
      user?.paygDispatchAllowanceTotal,
      user?.paygPackType,
      user?.profileOpensThisMonth,
      user?.trialAccess,
      user?.trialAccessLevel,
      user?.trialEndDate,
      user?.trialGrantedByAdmin,
      user?.trialStartDate,
      user?.trialStatus,
    ],
  );

  useEffect(() => {
    const nextRecords = readSavedWorkers({ userId: isJobProvider ? providerId : undefined });
    setRecords(nextRecords);
    if (isJobProvider) {
      syncSavedShortlistCount(providerId, nextRecords.length, accessSeed);
    }

    function syncSavedWorkers() {
      const updatedRecords = readSavedWorkers({ userId: isJobProvider ? providerId : undefined });
      setRecords(updatedRecords);
      if (isJobProvider) {
        syncSavedShortlistCount(providerId, updatedRecords.length, accessSeed);
      }
    }

    window.addEventListener(SAVED_WORKERS_UPDATED_EVENT, syncSavedWorkers);
    return () => window.removeEventListener(SAVED_WORKERS_UPDATED_EVENT, syncSavedWorkers);
  }, [accessSeed, isJobProvider, providerId]);

  const workers = useMemo(() => {
    const latestById = new Map(latestWorkers.map((worker) => [worker.worker_id, worker]));
    return records.map((record) => latestById.get(record.workerId) ?? record.worker);
  }, [latestWorkers, records]);
  const selectedWorkers = useMemo(
    () => workers.filter((worker) => selectedIds.includes(worker.worker_id)),
    [selectedIds, workers],
  );
  const canDispatch = mode === "admin";
  const providerAccessState = isJobProvider ? readProviderAccessState(providerId, accessSeed) : null;
  const providerEntitlements = providerAccessState ? getAccountEntitlements(providerAccessState) : null;

  function toggleSelected(workerId: string) {
    setSelectedIds((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId],
    );
    setFeedback("");
  }

  function handleCompare() {
    if (selectedWorkers.length < 2) {
      setFeedback("Select at least 2 saved contractors or tradesmen to compare.");
      return;
    }

    const compareGate = isJobProvider
      ? canCompareProfiles(readProviderAccessState(providerId, accessSeed), selectedWorkers.length)
      : { allowed: selectedWorkers.length <= 4 };

    if (!compareGate.allowed) {
      setFeedback(compareGate.message ?? "Your current tier does not support this compare selection.");
      return;
    }

    if (!isJobProvider && selectedWorkers.length > 4) {
      setFeedback("Compare Contractors / Tradesmen supports up to 4 profiles at a time.");
      return;
    }

    if (isJobProvider) {
      applyUsageEvent(providerId, "compare_action_used", accessSeed);
      recordProviderAuditEvent(providerId, "compare_action_used", { count: selectedWorkers.length, source: "saved" });
    }

    setFeedback("");
    setCompareOpen(true);
  }

  async function handleRequestDispatch() {
    if (!isJobProvider) return;
    if (selectedWorkers.length === 0) {
      setFeedback("Select at least 1 saved contractor or tradesman before requesting dispatch.");
      return;
    }

    const accessState = readProviderAccessState(providerId, accessSeed);
    const entitlements = getAccountEntitlements(accessState);
    const dispatchGate = canRequestDispatch(accessState);
    if (!dispatchGate.allowed) {
      setFeedback(dispatchGate.message ?? "Dispatch requests are not available on this account tier.");
      return;
    }

    try {
      await postProviderAuditEvent("dispatch_requested", {
        count: selectedWorkers.length,
        worker_ids: selectedWorkers.map((worker) => worker.worker_id),
        source: "saved",
      });
      setFeedback(
        entitlements.hasUnlimitedDispatches
          ? "Dispatch request sent. Our admin team has been notified."
          : "Dispatch request received. Your PAYG dispatch allowance has been updated.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Dispatch requests are not available on this account tier.");
    }
  }

  function scrollCarousel(direction: "prev" | "next") {
    carouselRef.current?.scrollBy({
      left: direction === "next" ? 340 : -340,
      behavior: "smooth",
    });
  }

  if (variant === "stories") {
    return (
      <>
        <section className="saved-bench-stories" aria-label="Saved hiring bench">
          {workers.length === 0 ? (
            <div className="saved-bench-stories__empty">
              Saved tradesmen and contractors will appear here.
            </div>
          ) : (
            <div className="saved-bench-stories__track">
              {workers.map((worker) => {
                const displayName = getSafeWorkerDisplayName(worker, user?.role);
                const subtitle = getSafeWorkerSubtitle(worker);
                const imageUrl = getWorkerProfileImage(worker);

                return (
                  <button
                    key={worker.worker_id}
                    type="button"
                    className="saved-bench-stories__item"
                    onClick={() => setActiveWorker(worker)}
                    title={`${displayName} - ${subtitle}`}
                  >
                    <span className="saved-bench-stories__ring">
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        className="saved-bench-stories__avatar"
                      />
                    </span>
                    <span className="saved-bench-stories__name">{displayName}</span>
                    <span className="saved-bench-stories__trade">{subtitle}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <WorkerProfileModal
          open={Boolean(activeWorker)}
          worker={activeWorker}
          onClose={() => setActiveWorker(null)}
          onBroadcast={
            canDispatch
              ? (worker) => {
                  setSelectedIds([worker.worker_id]);
                  setBroadcastOpen(true);
                }
              : undefined
          }
          mode={mode}
        />

        <CompareContractorsModal
          open={compareOpen}
          workers={selectedWorkers}
          onClose={() => setCompareOpen(false)}
          onViewProfile={(worker) => {
            setCompareOpen(false);
            setActiveWorker(worker);
          }}
          mode={mode}
        />

        {canDispatch ? (
          <WorkerBroadcastModal
            open={broadcastOpen}
            workers={selectedWorkers}
            jobs={jobs}
            jobsUnavailable={jobsUnavailable}
            preferredRole={preferredRole}
            onClose={() => setBroadcastOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <section
        style={{
          marginTop: "3rem",
          padding: 0,
          background: "transparent",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
              {mode === "job_provider" ? "Saved Hiring Bench" : "Saved Workers & Contractors"}
            </h2>
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
              {mode === "job_provider"
                ? "Reusable shortlist of tradesmen and contractors saved for hiring review, comparison, and future demand inside your own account scope."
                : "Saved shortlist for internal review, comparison, and dispatch execution across the platform."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            {providerAccessState ? (
              <div
                style={{
                  padding: "0.55rem 0.8rem",
                  borderRadius: 999,
                  background: "var(--rd-surface-soft)",
                  color: "var(--rd-text)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  boxShadow: "inset 0 0 0 1px rgba(226,232,240,0.95)",
                }}
              >
                {getTierLabel(providerAccessState)} |{" "}
                {providerEntitlements?.hasUnlimitedDispatches
                  ? `Dispatch access: ${getDispatchRemainingLabel(providerAccessState)}`
                  : `Dispatch remaining: ${getDispatchRemainingLabel(providerAccessState)}`}
                {providerEntitlements?.trialEndsAt ? ` | Trial ends: ${providerEntitlements.trialEndsAt}` : ""}
              </div>
            ) : null}
            {canDispatch ? (
              <button type="button" disabled={selectedWorkers.length === 0} onClick={() => setBroadcastOpen(true)}>
                Broadcast / Dispatch
              </button>
            ) : null}
            {isJobProvider ? (
              <button
                type="button"
                disabled={selectedWorkers.length === 0 || providerEntitlements?.canRequestDispatch === false}
                onClick={handleRequestDispatch}
              >
                Request Dispatch
              </button>
            ) : null}
            <button type="button" onClick={handleCompare}>
              Compare
            </button>
          </div>
        </div>

        {feedback ? <p style={{ marginBottom: 0, color: "#b45309" }}>{feedback}</p> : null}
        {isJobProvider && providerEntitlements?.canRequestDispatch === false ? (
          <p style={{ marginBottom: 0, color: "#b45309" }}>
            Free Preview does not include dispatch requests. Upgrade to PAYG or Monthly.
          </p>
        ) : null}

        {workers.length === 0 ? (
          <p style={{ marginBottom: 0, color: "var(--rd-text-muted)" }}>
            Saved workforce records will appear here after providers favourite them from the workforce overview.
          </p>
        ) : (
          <div style={{ marginTop: "1.25rem", display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ color: "var(--rd-text-muted)" }}>
                Scrollable hiring bench with saved tradesmen and contractors, built for faster shortlist review.
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => scrollCarousel("prev")}>Previous</button>
                <button type="button" onClick={() => scrollCarousel("next")}>Next</button>
              </div>
            </div>
            <div
              ref={carouselRef}
              style={{
                display: "flex",
                gap: "1.5rem",
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                paddingBottom: "0.9rem",
                scrollbarWidth: "thin",
              }}
            >
            {workers.map((worker) => (
              (() => {
                const displayName = getSafeWorkerDisplayName(worker, user?.role);
                const imageUrl = getWorkerCardImage(worker);
                const subtitle = getSafeWorkerSubtitle(worker);
                return (
              <article
                key={worker.worker_id}
                style={{
                  scrollSnapAlign: "start",
                  width: "min(82vw, 340px)",
                  minWidth: "min(82vw, 340px)",
                  maxWidth: 360,
                  flex: "0 0 min(82vw, 340px)",
                  border: "none",
                  borderRadius: 30,
                  background: "transparent",
                  display: "grid",
                  overflow: "hidden",
                  boxShadow: "none",
                }}
              >
                <div style={{ position: "relative", aspectRatio: "16 / 10.5", background: "var(--rd-border)", borderRadius: 30, overflow: "hidden" }}>
                  <img
                    src={imageUrl}
                    alt={displayName}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <label
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 0.72rem",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.94)",
                    }}
                  >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(worker.worker_id)}
                    onChange={() => toggleSelected(worker.worker_id)}
                    aria-label={`Select saved worker ${displayName}`}
                  />
                  <strong>{selectedIds.includes(worker.worker_id) ? "Selected" : "Select"}</strong>
                  </label>
                </div>
                <div style={{ padding: "0.95rem 0.25rem 0.25rem", display: "grid", gap: "0.72rem" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: "1.08rem" }}>{displayName}</strong>
                    <p style={{ margin: "0.28rem 0 0", color: "var(--rd-text-muted)", lineHeight: 1.45 }}>
                      {subtitle}
                    </p>
                    <p style={{ margin: "0.2rem 0 0", color: "var(--rd-text)", fontWeight: 600 }}>
                      {getSiteScoreStatusLabel(worker.stathub.status)}
                    </p>
                  </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setActiveWorker(worker)}>
                    View Profile
                  </button>
                  {canDispatch ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds([worker.worker_id]);
                        setBroadcastOpen(true);
                      }}
                    >
                      Broadcast / Dispatch
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIds([worker.worker_id]);
                      setFeedback("Select one more saved contractor or tradesman to compare.");
                    }}
                  >
                    Compare
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeSavedWorker(worker.worker_id, isJobProvider ? providerId : undefined);
                      setSelectedIds((current) => current.filter((id) => id !== worker.worker_id));
                    }}
                  >
                    Remove
                  </button>
                </div>
                  <div>
                    <SaveWorkerButton worker={worker} />
                  </div>
                </div>
              </article>
                );
              })()
            ))}
            </div>
          </div>
        )}
      </section>

      <WorkerProfileModal
        open={Boolean(activeWorker)}
        worker={activeWorker}
        onClose={() => setActiveWorker(null)}
        onBroadcast={
          canDispatch
            ? (worker) => {
                setSelectedIds([worker.worker_id]);
                setBroadcastOpen(true);
              }
            : undefined
        }
        mode={mode}
      />

      <CompareContractorsModal
        open={compareOpen}
        workers={selectedWorkers}
        onClose={() => setCompareOpen(false)}
        onViewProfile={(worker) => {
          setCompareOpen(false);
          setActiveWorker(worker);
        }}
        mode={mode}
      />

      {canDispatch ? (
        <WorkerBroadcastModal
          open={broadcastOpen}
          workers={selectedWorkers}
          jobs={jobs}
          jobsUnavailable={jobsUnavailable}
          preferredRole={preferredRole}
          onClose={() => setBroadcastOpen(false)}
        />
      ) : null}
    </>
  );
}
