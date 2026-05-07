"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { JobForm } from "@/components/forms/JobForm";
import { clearManualJobDraft, readManualJobDraft } from "@/lib/manual-job-draft";
import {
  applyUsageEvent,
  buildProviderAccessSeed,
  canCreateManualDraft,
  getTierLabel,
  readProviderAccessState,
  recordProviderAuditEvent,
} from "@/lib/provider-access";
import type { CreateJobInput } from "@/lib/validation/schemas";

export function ManualEntryJobPostPageClient({
  providers,
  successRedirect,
}: {
  providers: Array<{ provider_id: string; company_name: string }>;
  successRedirect: string;
}) {
  const { user } = useAuthSession();
  const [applyPatch, setApplyPatch] = useState<Partial<CreateJobInput>>({});
  const [applyVersion, setApplyVersion] = useState(0);
  const [blockedMessage, setBlockedMessage] = useState("");
  const isJobProvider = user?.role === "job_provider";
  const providerId = user?.providerId ?? "job-provider-local";
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
    if (isJobProvider) {
      const gate = canCreateManualDraft(readProviderAccessState(providerId, accessSeed));
      if (!gate.allowed) {
        setBlockedMessage(gate.message ?? "Manual draft limit reached.");
        return;
      }

      applyUsageEvent(providerId, "manual_job_draft_used", accessSeed);
      recordProviderAuditEvent(providerId, "manual_job_draft_used", { source: "manual_entry_page" });
      setBlockedMessage("");
    }

    const draft = readManualJobDraft();
    if (draft) {
      setApplyPatch(draft);
      setApplyVersion((current) => current + 1);
      clearManualJobDraft();
    }
  }, [accessSeed, isJobProvider, providerId]);

  const accessState = isJobProvider ? readProviderAccessState(providerId, accessSeed) : null;

  return (
    <main>
      <p style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/">Back to home</Link>
        <Link href="/ai-hiring-assistant">Switch to AI Hiring Assistant</Link>
      </p>
      <h1 style={{ marginBottom: "0.5rem" }}>Manual Entry Job Post</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Manual job posting using the existing system form and current visual structure.
      </p>
      {accessState ? (
        <p style={{ marginTop: 0, color: "#475569" }}>
          {getTierLabel(accessState)}. Free Preview includes 1 manual draft, PAYG supports ongoing limited-access job workflow, and Monthly supports full provider-side intake usage.
        </p>
      ) : null}
      {blockedMessage ? (
        <section
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            borderRadius: 14,
            border: "1px solid #fde68a",
            background: "#fff7ed",
            color: "#92400e",
          }}
        >
          {blockedMessage}
        </section>
      ) : null}
      {!blockedMessage ? (
      <JobForm
        providers={providers}
        successRedirect={successRedirect}
        applyPatch={applyPatch}
        applyVersion={applyVersion}
        applyMode="overwrite"
      />
      ) : null}
    </main>
  );
}
