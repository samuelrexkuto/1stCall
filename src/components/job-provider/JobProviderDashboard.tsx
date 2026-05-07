"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { AIHiringAssistant } from "@/components/job-provider/AIHiringAssistant";
import { JobForm } from "@/components/forms/JobForm";
import { SavedWorkersPanel } from "@/components/workers/SavedWorkersPanel";
import { WorkerOverviewTable } from "@/components/workers/WorkerOverviewTable";
import type { JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import type { CreateJobInput } from "@/lib/validation/schemas";
import type { DispatchJobOption } from "@/components/workers/WorkerBroadcastModal";
import type { SuggestedJobPost } from "@/lib/job-provider-ai";
import { buildProviderAccessSeed, canCreateManualDraft, getAccountEntitlements, getDispatchRemainingLabel, getTierLabel, readProviderAccessState } from "@/lib/provider-access";
import type { WorkerOverviewRow } from "@/lib/workers/types";

function matchesFilter(worker: WorkerOverviewRow, query: { name: string; role: string; location: string; availability: string }) {
  const nameMatch = !query.name || worker.full_name.toLowerCase().includes(query.name.toLowerCase());
  const roleMatch = !query.role || (worker.primary_role ?? "").toLowerCase().includes(query.role.toLowerCase());
  const locationMatch =
    !query.location ||
    (worker.location_display ?? `${worker.town ?? ""} ${worker.postcode}`)
      .toLowerCase()
      .includes(query.location.toLowerCase());
  const availabilityMatch =
    !query.availability ||
    (query.availability === "available" ? worker.available_today : !worker.available_today);

  return nameMatch && roleMatch && locationMatch && availabilityMatch;
}

export function JobProviderDashboard({
  userName,
  workers,
  jobs,
  providers,
}: {
  userName?: string;
  workers: WorkerOverviewRow[];
  jobs: JobOverviewRow[];
  providers: Array<{ provider_id: string; company_name: string }>;
}) {
  const { user } = useAuthSession();
  const [filters, setFilters] = useState({
    name: "",
    role: "",
    location: "",
    availability: "",
  });
  const [applyPatch, setApplyPatch] = useState<Partial<CreateJobInput>>({});
  const [applyVersion, setApplyVersion] = useState(0);
  const matchesRef = useRef<HTMLElement | null>(null);
  const intakeRef = useRef<HTMLElement | null>(null);
  const providerId = user?.providerId ?? "job-provider-local";
  const accessState = readProviderAccessState(
    providerId,
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
  );
  const manualDraftGate = canCreateManualDraft(accessState);

  const filteredWorkers = useMemo(
    () => workers.filter((worker) => matchesFilter(worker, filters)),
    [filters, workers],
  );

  function handleUseSuggestedJobPost(patch: Partial<CreateJobInput>, suggestion: SuggestedJobPost) {
    setApplyPatch({
      ...patch,
      title: patch.title || suggestion.title || "",
      required_role: patch.required_role || suggestion.tradeCategory || "",
      area: patch.area || suggestion.location || "",
    });
    setApplyVersion((current) => current + 1);
    intakeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleViewSuggestedMatches(suggestion: SuggestedJobPost) {
    setFilters((current) => ({
      ...current,
      role: suggestion.tradeCategory ?? current.role,
      location: suggestion.location ?? current.location,
    }));
    matchesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main style={{ display: "grid", gap: "1.5rem" }}>
      <section
        style={{
          padding: "1.2rem",
          borderRadius: 20,
          border: "1px solid #dbe1ea",
          background: "#ffffff",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Job Provider Dashboard</h1>
          <p style={{ margin: "0.35rem 0 0", color: "#475569" }}>
            {userName ? `${userName}, ` : ""}manage hiring needs inside your own account scope, review masked workforce matches, build a reusable shortlist, compare decision-ready profiles, and request dispatch coordination through the platform.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: "0.85rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <div style={{ padding: "0.95rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#64748b", fontSize: "0.82rem" }}>Account tier</div>
            <strong>{getTierLabel(accessState)}</strong>
          </div>
          <div style={{ padding: "0.95rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#64748b", fontSize: "0.82rem" }}>Dispatch usage</div>
            <strong>{getDispatchRemainingLabel(accessState)} remaining</strong>
          </div>
          <div style={{ padding: "0.95rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#64748b", fontSize: "0.82rem" }}>Hiring bench</div>
            <strong>{workers.length} workforce matches</strong>
          </div>
        </div>
        <p style={{ margin: 0, color: "#475569" }}>
          {getAccountEntitlements(accessState).isFreePreview
            ? "Free Preview supports masked browsing, limited shortlist review, 1 AI trial, and no dispatch requests."
            : getAccountEntitlements(accessState).isPayg
              ? `Current PAYG pack: ${accessState.paygPackType ?? "Not recorded"}. Dispatch is included in the pack and no separate dispatch charge is created per request.`
              : `Monthly Membership is £249/month with unlimited dispatch requests included. Renewal: ${accessState.monthlyRenewalDate ?? "TBC"}.`}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/account">Manage Account</Link>
          {!getAccountEntitlements(accessState).hasFullAccess ? <Link href="/account">Upgrade / Top Up</Link> : null}
        </div>
      </section>

      <AIHiringAssistant
        workers={workers}
        recentJobs={jobs.map((job) => ({
          job_title: job.job_title,
          trade_type: job.trade_type,
          area: job.area,
          postcode: job.postcode,
        }))}
      />

      <section
        ref={intakeRef}
        style={{
          padding: "1rem",
          borderRadius: 18,
          border: "1px solid #dbe1ea",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.1rem" }}>Quick Job Post / Job Intake</h2>
        <p style={{ marginTop: 0, color: "#475569" }}>
          Reuses the current job form so provider requests stay inside the existing intake path for your own account scope.
        </p>
        {manualDraftGate.allowed ? (
          <JobForm
            providers={providers}
            successRedirect="/"
            applyPatch={applyPatch}
            applyVersion={applyVersion}
            applyMode="overwrite"
          />
        ) : (
          <div
            style={{
              padding: "0.95rem",
              borderRadius: 14,
              border: "1px solid #fde68a",
              background: "#fff7ed",
              color: "#92400e",
            }}
          >
            {manualDraftGate.message}
          </div>
        )}
      </section>

      <section
        ref={matchesRef}
        style={{
          padding: "1rem",
          borderRadius: 18,
          border: "1px solid #dbe1ea",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Workforce Matches</h2>
            <p style={{ margin: "0.35rem 0 0", color: "#475569" }}>
              Search tradesmen and contractors inside your account scope, save a hiring bench, compare 2 to 4 profiles, and review Tender Confidence Packs.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginTop: "1rem",
            marginBottom: "1rem",
          }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Worker name
            <input
              value={filters.name}
              onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Trade
            <input
              value={filters.role}
              onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Location
            <input
              value={filters.location}
              onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Availability
            <select
              value={filters.availability}
              onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value }))}
            >
              <option value="">All</option>
              <option value="available">Available</option>
              <option value="unavailable">Project committed</option>
            </select>
          </label>
        </div>

        <WorkerOverviewTable
          workers={filteredWorkers}
          jobs={[] as DispatchJobOption[]}
          jobsUnavailable
          preferredRole={filters.role || undefined}
          mode="job_provider"
        />
      </section>

      <SavedWorkersPanel jobs={[] as DispatchJobOption[]} jobsUnavailable preferredRole={filters.role || undefined} mode="job_provider" />
    </main>
  );
}
