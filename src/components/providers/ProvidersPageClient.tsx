"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProviderOverviewTable, type ProviderOverviewRow } from "@/components/providers/ProviderOverviewTable";
import { normalizeAccountTier } from "@/lib/provider-access";
export function ProvidersPageClient({
  initialData,
}: {
  initialData: {
    providers: ProviderOverviewRow[];
    errorMessage: string;
  };
}) {
  const [providers, setProviders] = useState<ProviderOverviewRow[]>(initialData.providers);
  const [errorMessage, setErrorMessage] = useState(initialData.errorMessage);
  const [filters, setFilters] = useState({
    name: "",
    accountType: "",
    tier: "",
    billingStatus: "",
    location: "",
    trialStatus: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  useEffect(() => {
    setProviders(initialData.providers);
    setErrorMessage(initialData.errorMessage);
  }, [initialData]);

  const summary = useMemo(
    () =>
      providers.reduce(
        (acc, provider) => {
          acc.total += 1;
          if (provider.email) acc.withEmail += 1;
          if (provider.phone) acc.withPhone += 1;
          const tier = normalizeAccountTier(provider.account_tier);
          if (tier === "monthly_full_access") acc.monthly += 1;
          if (tier === "payg") acc.payg += 1;
          if (tier === "free_preview") acc.free += 1;
          return acc;
        },
        { total: 0, withEmail: 0, withPhone: 0, free: 0, payg: 0, monthly: 0 },
      ),
    [providers],
  );

  const filteredProviders = useMemo(
    () =>
      providers.filter((provider) => {
        const accountType = getAccountTypeLabel(provider).toLowerCase();
        const trialStatus = getTrialStatus(provider);
        const nameMatch = [provider.name, provider.company_name, provider.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(appliedFilters.name.trim().toLowerCase());
        const accountTypeMatch = !appliedFilters.accountType || accountType === appliedFilters.accountType;
        const tierMatch = !appliedFilters.tier || normalizeAccountTier(provider.account_tier) === appliedFilters.tier;
        const billingMatch = !appliedFilters.billingStatus || (provider.billing_status ?? "trial") === appliedFilters.billingStatus;
        const locationMatch =
          !appliedFilters.location ||
          [provider.town, provider.postcode]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(appliedFilters.location.trim().toLowerCase());
        const trialMatch = !appliedFilters.trialStatus || trialStatus === appliedFilters.trialStatus;
        return nameMatch && accountTypeMatch && tierMatch && billingMatch && locationMatch && trialMatch;
      }),
    [appliedFilters, providers],
  );

  function applyFilters() {
    setAppliedFilters(filters);
  }

  function resetFilters() {
    const nextFilters = {
      name: "",
      accountType: "",
      tier: "",
      billingStatus: "",
      location: "",
      trialStatus: "",
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  return (
    <main>
      <p style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/">Back to home</Link>
        <Link href="/providers/new">Create subscriber</Link>
        <Link href="/jobs">View jobs</Link>
      </p>

      <h1 style={{ marginBottom: "0.5rem" }}>Project Management Overview</h1>
      <p style={{ marginTop: 0 }}>
        Total subscriber accounts: {summary.total} | Free: {summary.free} | PAYG: {summary.payg} | Monthly: {summary.monthly}
      </p>
      <p style={{ marginTop: 0, color: "var(--rd-text-muted)" }}>
        This view tracks consultant, contractor, and subscriber accounts that manage projects and use the platform to source labour or subcontractors.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.75rem",
          alignItems: "end",
          padding: "0.95rem",
          borderRadius: 10,
          border: "1px solid var(--rd-border)",
          background: "var(--rd-bg-elevated)",
          margin: "1rem 0",
        }}
      >
        <label>
          Name
          <input
            value={filters.name}
            onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label>
          Account type / grouping
          <select
            value={filters.accountType}
            onChange={(event) => setFilters((current) => ({ ...current, accountType: event.target.value }))}
          >
            <option value="">All</option>
            <option value="subscriber">Subscriber</option>
            <option value="consultant">Consultant</option>
            <option value="client">Client</option>
            <option value="contractor">Contractor</option>
          </select>
        </label>
        <label>
          Tier
          <select
            value={filters.tier}
            onChange={(event) => setFilters((current) => ({ ...current, tier: event.target.value }))}
          >
            <option value="">All</option>
            <option value="free_preview">Free Preview</option>
            <option value="payg">PAYG</option>
            <option value="monthly_full_access">Monthly — Full Access</option>
            <option value="trial_full_access">30-Day Trial — Full Access</option>
            <option value="manual_full_access">Manual Full Access</option>
          </select>
        </label>
        <label>
          Billing status
          <select
            value={filters.billingStatus}
            onChange={(event) => setFilters((current) => ({ ...current, billingStatus: event.target.value }))}
          >
            <option value="">All</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="past_due">Past due</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label>
          Location / town
          <input
            value={filters.location}
            onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
          />
        </label>
        <label>
          Trial status
          <select
            value={filters.trialStatus}
            onChange={(event) => setFilters((current) => ({ ...current, trialStatus: event.target.value }))}
          >
            <option value="">All</option>
            <option value="none">None</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button type="button" onClick={applyFilters}>
            Apply filters
          </button>
          <button type="button" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </section>

      {errorMessage ? <p>{errorMessage}</p> : null}

      {!errorMessage && providers.length === 0 ? <p>No providers found in Supabase.</p> : null}
      {!errorMessage && providers.length > 0 ? (
        <ProviderOverviewTable
          providers={filteredProviders}
          onProviderUpdate={(updatedProvider) =>
            setProviders((current) =>
              current.map((provider) =>
                provider.id === updatedProvider.id || provider.provider_id === updatedProvider.provider_id
                  ? updatedProvider
                  : provider,
              ),
            )
          }
          onDeleteSuccess={(providerId) =>
            setProviders((current) => current.filter((provider) => provider.id !== providerId && provider.provider_id !== providerId))
          }
        />
      ) : null}
    </main>
  );
}

function getAccountTypeLabel(provider: ProviderOverviewRow) {
  if (provider.company_name?.toLowerCase().includes("consult")) return "consultant";
  if (provider.name.toLowerCase().includes("client")) return "client";
  if (provider.name.toLowerCase().includes("contractor")) return "contractor";
  return "subscriber";
}

function getTrialStatus(provider: ProviderOverviewRow) {
  if (isTrialActive(provider)) return "active";
  if (provider.trial_status === "active" && provider.trial_end_date) return "expired";
  return provider.trial_status ?? "none";
}

function isTrialActive(provider: ProviderOverviewRow) {
  if (!(provider.trial_access || provider.is_trial_month || provider.trial_granted_by_admin)) return false;
  if (provider.trial_access_level && provider.trial_access_level !== "full_access") return false;
  if (provider.trial_status !== "active" || !provider.trial_start_date || !provider.trial_end_date) return false;
  const start = parseTrialBoundary(provider.trial_start_date, false);
  const end = parseTrialBoundary(provider.trial_end_date, true);
  const now = Date.now();
  return Boolean(start && end && start.getTime() <= now && end.getTime() > now);
}

function parseTrialBoundary(value: string, endOfDay: boolean) {
  const hasTime = value.includes("T");
  const parsed = new Date(hasTime ? value : `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (hasTime && endOfDay) parsed.setUTCHours(23, 59, 59, 999);
  if (hasTime && !endOfDay) parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}
