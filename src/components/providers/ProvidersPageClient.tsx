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
    <div>
      <div className="rd-page-header">
        <div className="rd-page-heading-row">
          <div>
            <h1 className="rd-page-title">Project Management Overview</h1>
            <p className="rd-page-subtitle">
              Total subscriber accounts: {summary.total} | Free: {summary.free} | PAYG: {summary.payg} | Monthly: {summary.monthly}
            </p>
            <p className="rd-page-subtitle">
              This view tracks consultant, contractor, and subscriber accounts that manage projects and use the platform to source labour or subcontractors.
            </p>
          </div>

          <div className="rd-page-actions">
            <Link className="rd-button rd-button--secondary" href="/providers/new">
              Create subscriber
            </Link>

            <Link className="rd-button rd-button--secondary" href="/jobs">
              View jobs
            </Link>
          </div>
        </div>
      </div>

      <section className="rd-card rd-admin-filter-card">
        <form
          className="rd-form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="rd-admin-filter-grid">
            <label className="rd-field">
              <span className="rd-field-label">Name</span>
          <input
            className="rd-control"
            name="name"
            value={filters.name}
            onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
          />
            </label>
            <label className="rd-field">
              <span className="rd-field-label">Account type / grouping</span>
          <select
            className="rd-control"
            name="accountType"
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
            <label className="rd-field">
              <span className="rd-field-label">Tier</span>
          <select
            className="rd-control"
            name="tier"
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
            <label className="rd-field">
              <span className="rd-field-label">Billing status</span>
          <select
            className="rd-control"
            name="billingStatus"
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
            <label className="rd-field">
              <span className="rd-field-label">Location / town</span>
          <input
            className="rd-control"
            name="location"
            value={filters.location}
            onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
          />
            </label>
            <label className="rd-field">
              <span className="rd-field-label">Trial status</span>
          <select
            className="rd-control"
            name="trialStatus"
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
          </div>

          <div className="rd-actions-row">
            <button className="rd-button rd-button--primary" type="submit">
              Apply filters
            </button>
            <button className="rd-button rd-button--secondary" type="button" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </form>
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
    </div>
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
