"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import {
  buildProviderAccessSeed,
  canSaveToShortlist,
  readProviderAccessState,
  recordProviderAuditEvent,
  syncSavedShortlistCount,
} from "@/lib/provider-access";
import { isWorkerSaved, toggleSavedWorker, SAVED_WORKERS_UPDATED_EVENT } from "@/lib/saved-workers";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export function SaveWorkerButton({
  worker,
  onChange,
}: {
  worker: WorkerOverviewRow;
  onChange?: (saved: boolean) => void;
}) {
  const { user } = useAuthSession();
  const [saved, setSaved] = useState(false);
  const providerId = user?.providerId ?? "job-provider-local";
  const isJobProvider = user?.role === "job_provider";
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

  useEffect(() => {
    setSaved(isWorkerSaved(worker.worker_id, providerId));

    function handleUpdated() {
      setSaved(isWorkerSaved(worker.worker_id, providerId));
    }

    window.addEventListener(SAVED_WORKERS_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(SAVED_WORKERS_UPDATED_EVENT, handleUpdated);
  }, [providerId, worker.worker_id]);

  return (
    <button
      type="button"
      onClick={() => {
        if (isJobProvider && !saved) {
          const accessState = readProviderAccessState(providerId, accessSeed);
          const gate = canSaveToShortlist(accessState);
          if (!gate.allowed) {
            window.alert(gate.message ?? "Shortlist limit reached.");
            return;
          }
        }

        const result = toggleSavedWorker(worker, providerId);
        if (isJobProvider) {
          syncSavedShortlistCount(
            providerId,
            result.records.filter((record) => record.userId === providerId).length,
            accessSeed,
          );
          if (result.saved) {
            recordProviderAuditEvent(providerId, "shortlist_saved", { workerId: worker.worker_id });
          }
        }
        setSaved(result.saved);
        onChange?.(result.saved);
      }}
    >
      {saved ? (
        "Remove from Saved List"
      ) : (
        <>
          <span className="desktop-save-worker-label">Save Worker</span>
          <span className="mobile-save-worker-label">Save</span>
        </>
      )}
    </button>
  );
}
