"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { CompareContractorsModal } from "@/components/workers/CompareContractorsModal";
import { SaveWorkerButton } from "@/components/workers/SaveWorkerButton";
import {
  WorkerBroadcastModal,
  type DispatchJobOption,
} from "@/components/workers/WorkerBroadcastModal";
import { WorkerProfileModal } from "@/components/workers/WorkerProfileModal";
import {
  applyUsageEvent,
  buildProviderAccessSeed,
  canCompareProfiles,
  canRequestDispatch,
  getAccountEntitlements,
  getDispatchRemainingLabel,
  getProviderFacingDisplayName,
  getProviderFacingLocationLabel,
  getSiteScoreStatusLabel,
  getTierLabel,
  postProviderAuditEvent,
  readProviderAccessState,
  recordProviderAuditEvent,
  type ProviderAccessSeed,
} from "@/lib/provider-access";
import { getWorkerDisplayGrouping } from "@/lib/worker-display";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export function WorkerOverviewTable({
  workers,
  jobs,
  jobsUnavailable,
  preferredRole,
  onDeleteSuccess,
  mode = "admin",
  providerAccessSeed,
}: {
  workers: WorkerOverviewRow[];
  jobs: DispatchJobOption[];
  jobsUnavailable?: boolean;
  preferredRole?: string;
  onDeleteSuccess?: (workerId: string) => void;
  mode?: "admin" | "job_provider";
  providerAccessSeed?: ProviderAccessSeed & { providerId: string; email: string | null; name: string };
}) {
  const router = useRouter();
  const { user } = useAuthSession();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeWorker, setActiveWorker] = useState<WorkerOverviewRow | null>(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [liveProviderAccessSeed, setLiveProviderAccessSeed] = useState(providerAccessSeed);
  const providerId = liveProviderAccessSeed?.providerId ?? providerAccessSeed?.providerId ?? user?.providerId ?? "job-provider-local";
  const isJobProvider = mode === "job_provider" && user?.role === "job_provider";
  const accessSeed = buildProviderAccessSeed(
    liveProviderAccessSeed ?? providerAccessSeed ?? {
      accessTier: user?.accountTier,
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
  );

  useEffect(() => {
    setLiveProviderAccessSeed(providerAccessSeed);
  }, [providerAccessSeed]);

  useEffect(() => {
    if (!isJobProvider) return;
    let cancelled = false;

    async function refreshAccount() {
      const response = await fetch("/api/account", { cache: "no-store" }).catch(() => null);
      if (!response || cancelled) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || cancelled || !payload.provider) return;
      setLiveProviderAccessSeed({
        providerId: payload.provider.id,
        email: payload.provider.email,
        name: payload.provider.name,
        accessTier: payload.provider.accessTier,
        accessStatus: payload.provider.accessStatus,
        accountTier: payload.provider.accountTier,
        billingStatus: payload.provider.billingStatus,
        paygPackType: payload.provider.paygPackType,
        paygDispatchAllowanceTotal: payload.provider.paygDispatchAllowanceTotal,
        paygDispatchAllowanceRemaining: payload.provider.paygDispatchAllowanceRemaining,
        monthlyRenewalDate: payload.provider.monthlyRenewalDate,
        monthlyActive: payload.provider.monthlyActive,
        activeSubscription: payload.provider.activeSubscription,
        trialAccess: payload.provider.trialAccess,
        isTrialMonth: payload.provider.isTrialMonth,
        trialGrantedByAdmin: payload.provider.trialGrantedByAdmin,
        trialStartDate: payload.provider.trialStartDate,
        trialEndDate: payload.provider.trialEndDate,
        trialStatus: payload.provider.trialStatus,
        trialAccessLevel: payload.provider.trialAccessLevel,
        profileOpensThisMonth: payload.provider.profileOpensThisMonth,
        compareActionsThisMonth: payload.provider.compareActionsThisMonth,
        manualDraftsUsed: payload.provider.manualDraftsUsed,
        fullAccess: payload.provider.fullAccess,
        adminFullAccess: payload.provider.adminFullAccess,
        accessLevel: payload.provider.accessLevel,
      });
    }

    function handleFocus() {
      void refreshAccount();
    }

    window.addEventListener("focus", handleFocus);
    const interval = window.setInterval(refreshAccount, 30000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
    };
  }, [isJobProvider]);

  function toggleSelection(workerId: string) {
    setSelectionMessage("");
    setSelectedIds((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId],
    );
  }

  function toggleSelectAll() {
    setSelectionMessage("");
    setSelectedIds((current) =>
      current.length === workers.length ? [] : workers.map((worker) => worker.worker_id),
    );
  }

  const selectedWorkers = workers.filter((worker) => selectedIds.includes(worker.worker_id));
  const canDispatch = mode === "admin";
  const canMutateWorkers = mode === "admin";

  async function handleDelete(workerId: string, fullName: string) {
    const confirmed = window.confirm(`Delete worker "${fullName}"? This cannot be undone.`);
    if (!confirmed) return;

    const response = await fetch(`/api/workers/${workerId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      window.alert(payload.error ?? "Unable to delete worker.");
      return;
    }

    onDeleteSuccess?.(workerId);
    router.refresh();
  }

  function handleCompare() {
    if (selectedWorkers.length < 2) {
      setSelectionMessage("Select at least 2 contractors or tradesmen to compare.");
      return;
    }

    const compareGate = isJobProvider
      ? canCompareProfiles(readProviderAccessState(providerId, accessSeed), selectedWorkers.length)
      : { allowed: selectedWorkers.length <= 4 };

    if (!compareGate.allowed) {
      setSelectionMessage(
        compareGate.message ?? "Compare Contractors / Tradesmen supports fewer profiles on this account tier.",
      );
      return;
    }

    if (!isJobProvider && selectedWorkers.length > 4) {
      setSelectionMessage("Compare Contractors / Tradesmen supports up to 4 profiles at a time.");
      return;
    }

    if (isJobProvider) {
      applyUsageEvent(providerId, "compare_action_used", accessSeed);
      recordProviderAuditEvent(providerId, "compare_action_used", { count: selectedWorkers.length });
    }

    setSelectionMessage("");
    setCompareModalOpen(true);
  }

  async function handleRequestDispatch() {
    if (!isJobProvider) return;
    if (selectedWorkers.length === 0) {
      setSelectionMessage("Select at least 1 shortlisted contractor or tradesman before requesting dispatch.");
      return;
    }

    const accessState = readProviderAccessState(providerId, accessSeed);
    const entitlements = getAccountEntitlements(accessState);
    const dispatchGate = canRequestDispatch(accessState);
    if (!dispatchGate.allowed) {
      setSelectionMessage(dispatchGate.message ?? "Dispatch request unavailable on this account tier.");
      return;
    }

    try {
      await postProviderAuditEvent("dispatch_requested", {
        count: selectedWorkers.length,
        worker_ids: selectedWorkers.map((worker) => worker.worker_id),
        source: "workforce_overview",
      });
      setSelectionMessage(
        entitlements.hasUnlimitedDispatches
          ? "Dispatch request sent. Our admin team has been notified."
          : "Dispatch request received. Your PAYG dispatch allowance has been updated.",
      );
    } catch (error) {
      setSelectionMessage(error instanceof Error ? error.message : "Dispatch request unavailable on this account tier.");
    }
  }

  const providerAccessState = isJobProvider ? readProviderAccessState(providerId, accessSeed) : null;
  const providerEntitlements = providerAccessState ? getAccountEntitlements(providerAccessState) : null;
  const displayWorkers = useMemo(() => {
    const unique = new Map<string, WorkerOverviewRow>();
    for (const worker of workers) {
      const key = worker.workerType === "contractor"
        ? [
            "contractor",
            worker.full_name.trim().toLowerCase(),
            worker.contractorType ?? "",
            worker.specialistArea?.trim().toLowerCase() ?? "",
            worker.location_display?.trim().toLowerCase() ?? "",
            worker.town?.trim().toLowerCase() ?? "",
            worker.postcode?.trim().toLowerCase() ?? "",
          ].join("|")
        : worker.worker_id;

      if (!unique.has(key)) {
        unique.set(key, worker);
      }
    }
    return Array.from(unique.values());
  }, [workers]);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0 }}>Selected workforce: {selectedIds.length}</p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {isJobProvider && providerAccessState ? (
            <div
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: 999,
                border: "1px solid var(--rd-border)",
                background: "var(--rd-surface-soft)",
                color: "var(--rd-text)",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              {getTierLabel(providerAccessState)} |{" "}
              {providerEntitlements?.hasUnlimitedDispatches
                ? `Dispatch access: ${getDispatchRemainingLabel(providerAccessState)}`
                : providerEntitlements?.isFreePreview
                  ? "Dispatch unavailable"
                : `Dispatch remaining: ${getDispatchRemainingLabel(providerAccessState)}`}
              {providerEntitlements?.trialEndsAt ? ` | Trial ends: ${providerEntitlements.trialEndsAt}` : ""}
            </div>
          ) : null}
          {canDispatch ? (
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setDispatchModalOpen(true)}
            >
              Broadcast / Dispatch
            </button>
          ) : null}
          {isJobProvider ? (
            <button
              type="button"
              disabled={selectedIds.length === 0 || providerEntitlements?.canRequestDispatch === false}
              onClick={handleRequestDispatch}
            >
              Request Dispatch
            </button>
          ) : null}
          <button type="button" onClick={handleCompare}>
            Compare Contractors / Tradesmen
          </button>
        </div>
      </div>

      {selectionMessage ? (
        <p style={{ marginTop: "-0.35rem", marginBottom: "1rem", color: "#b45309" }}>{selectionMessage}</p>
      ) : null}
      {isJobProvider && providerEntitlements?.canRequestDispatch === false ? (
        <p style={{ marginTop: "-0.35rem", marginBottom: "1rem", color: "#b45309" }}>
          Free Preview does not include dispatch requests. Upgrade to PAYG or Monthly.
        </p>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "var(--rd-bg-elevated)",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                <input
                  type="checkbox"
                  checked={displayWorkers.length > 0 && selectedIds.length === displayWorkers.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all workers"
                />
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Name</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Grouping</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Location</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Available</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Site Score</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Completed Jobs</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayWorkers.map((worker) => (
              <tr key={worker.worker_id}>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(worker.worker_id)}
                    onChange={() => toggleSelection(worker.worker_id)}
                    aria-label={`Select ${worker.full_name}`}
                  />
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  {(() => {
                    const displayName = isJobProvider
                      ? getProviderFacingDisplayName(worker)
                      : worker.full_name;
                    return (
                  <button
                    type="button"
                    onClick={() => setActiveWorker(worker)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--rd-text)",
                      textDecoration: "underline",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    {displayName}
                  </button>
                    );
                  })()}
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  {(() => {
                    const grouping = getWorkerDisplayGrouping(worker);
                    return (
                  <div style={{ display: "grid", gap: "0.15rem" }}>
                    <strong style={{ color: "var(--rd-text)" }}>
                      {grouping.typeLabel}
                    </strong>
                    <span style={{ color: "var(--rd-text-muted)" }}>
                      {grouping.detailLabel}: {grouping.detailValue}
                    </span>
                  </div>
                    );
                  })()}
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  {isJobProvider
                    ? getProviderFacingLocationLabel(worker)
                    : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`}
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  {worker.available_today ? "Yes" : "Project committed"}
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  {worker.stathub.status === "insufficient"
                    ? getSiteScoreStatusLabel(worker.stathub.status)
                    : `${worker.stathub.overallScore}/100`}
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{worker.completed_jobs_count}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <SaveWorkerButton worker={worker} />
                    {canMutateWorkers ? <Link href={`/workers/${worker.worker_id}/edit`}>Edit</Link> : null}
                    {canMutateWorkers ? (
                      <button type="button" onClick={() => handleDelete(worker.worker_id, worker.full_name)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WorkerProfileModal
        open={Boolean(activeWorker)}
        worker={activeWorker}
        onClose={() => setActiveWorker(null)}
        onBroadcast={
          canDispatch
            ? (worker) => {
                setSelectedIds([worker.worker_id]);
                setDispatchModalOpen(true);
              }
            : undefined
        }
        mode={mode}
      />

      <CompareContractorsModal
        open={compareModalOpen}
        workers={selectedWorkers}
        onClose={() => setCompareModalOpen(false)}
        onViewProfile={(worker) => {
          setCompareModalOpen(false);
          setActiveWorker(worker);
        }}
        mode={mode}
      />

      {canDispatch ? (
        <WorkerBroadcastModal
          open={dispatchModalOpen}
          workers={selectedWorkers}
          jobs={jobs}
          jobsUnavailable={jobsUnavailable}
          preferredRole={preferredRole}
          onClose={() => setDispatchModalOpen(false)}
        />
      ) : null}
    </>
  );
}
