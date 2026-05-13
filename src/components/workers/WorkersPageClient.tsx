"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Button } from "@radix-ui/themes";
import { STANDARD_ROLES } from "@/lib/constants/roles";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { SendOnboardingLinkModal } from "@/components/staff/SendOnboardingLinkModal";
import { WorkerOverviewTable } from "@/components/workers/WorkerOverviewTable";
import type { DispatchJobOption } from "@/components/workers/WorkerBroadcastModal";
import type { WorkerOverviewRow } from "@/lib/workers/types";
import type { ProviderAccessSeed } from "@/lib/provider-access";

interface WorkersPageClientProps {
  initialFilters: {
    name: string;
    worker_type: string;
    primary_role: string;
    location: string;
    available_today: string;
  };
  initialData: {
    workers: WorkerOverviewRow[];
    jobs: DispatchJobOption[];
    jobsUnavailable: boolean;
    errorMessage: string;
    providerAccessSeed?: ProviderAccessSeed & { providerId: string; email: string | null; name: string };
  };
}

function buildWorkersQueryString(filters: WorkersPageClientProps["initialFilters"]) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return searchParams.toString();
}

export function WorkersPageClient({ initialFilters, initialData }: WorkersPageClientProps) {
  const router = useRouter();
  const { user } = useAuthSession();
  const [filters, setFilters] = useState(initialFilters);
  const [workers, setWorkers] = useState<WorkerOverviewRow[]>(initialData.workers);
  const [jobs, setJobs] = useState<DispatchJobOption[]>(initialData.jobs);
  const [jobsUnavailable, setJobsUnavailable] = useState(initialData.jobsUnavailable);
  const [errorMessage, setErrorMessage] = useState(initialData.errorMessage);
  const [sendOnboardingModalOpen, setSendOnboardingModalOpen] = useState(false);
  const hasActiveFilters = useMemo(
    () => Object.values(initialFilters).some((value) => Boolean(value)),
    [initialFilters],
  );
  const [filtersOpen, setFiltersOpen] = useState(hasActiveFilters);
  const [isMobileFiltersViewport, setIsMobileFiltersViewport] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
    setWorkers(initialData.workers);
    setJobs(initialData.jobs);
    setJobsUnavailable(initialData.jobsUnavailable);
    setErrorMessage(initialData.errorMessage);
  }, [initialFilters, initialData]);

  useEffect(() => {
    setFiltersOpen(hasActiveFilters);
  }, [hasActiveFilters]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewport = () => setIsMobileFiltersViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  function updateFilter<K extends keyof WorkersPageClientProps["initialFilters"]>(
    key: K,
    value: WorkersPageClientProps["initialFilters"][K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const queryString = buildWorkersQueryString(filters);
    router.replace(queryString ? `/workers?${queryString}` : "/workers");
  }

  function handleReset() {
    const clearedFilters: WorkersPageClientProps["initialFilters"] = {
      name: "",
      worker_type: "",
      primary_role: "",
      location: "",
      available_today: "",
    };

    setFilters(clearedFilters);
    router.replace("/workers");
  }

  const summary = useMemo(
    () =>
      workers.reduce(
        (acc, worker) => {
          acc.total += 1;
          if (worker.available_today) acc.available += 1;
          return acc;
        },
        { total: 0, available: 0 },
      ),
    [workers],
  );

  const isJobProvider = user?.role === "job_provider";

  function renderFilterCollapsible(className = "") {
    return (
      <Collapsible.Root
        open={isMobileFiltersViewport ? filtersOpen : true}
        onOpenChange={setFiltersOpen}
        className={`overview-filter-collapsible ${className}`.trim()}
      >
        <Collapsible.Trigger asChild>
          <Button
            type="button"
            variant="surface"
            color="gray"
            radius="full"
            size="2"
            className="overview-filter-toggle"
            aria-label={filtersOpen ? "Collapse Workforce Overview filters" : "Expand Workforce Overview filters"}
          >
            <MixerHorizontalIcon aria-hidden="true" />
            Filters
            <ChevronDownIcon
              aria-hidden="true"
              className={filtersOpen ? "overview-filter-toggle-chevron is-open" : "overview-filter-toggle-chevron"}
            />
          </Button>
        </Collapsible.Trigger>
        <Collapsible.Content forceMount className="overview-filter-content">
          <form
            className="overview-filter-form"
            onSubmit={handleApplyFilters}
            style={{
              marginBottom: "1rem",
            }}
          >
            <label className="overview-filter-field">
              Name
              <input
                value={filters.name}
                onChange={(event) => updateFilter("name", event.target.value)}
              />
            </label>
            <label className="overview-filter-field">
              Workforce type
              <select
                value={filters.worker_type}
                onChange={(event) => updateFilter("worker_type", event.target.value)}
              >
                <option value="">Select Tradesman or Contractor</option>
                <option value="tradesman">Tradesman</option>
                <option value="contractor">Contractor</option>
                <option value="specialist_contractor">Specialist Contractor</option>
              </select>
            </label>
            <label className="overview-filter-field">
              Primary role / trade
              <select
                value={filters.primary_role}
                onChange={(event) => updateFilter("primary_role", event.target.value)}
              >
                <option value="">All</option>
                {STANDARD_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="overview-filter-field">
              Location
              <input
                value={filters.location}
                onChange={(event) => updateFilter("location", event.target.value)}
              />
            </label>
            <label className="overview-filter-field">
              Available
              <select
                value={filters.available_today}
                onChange={(event) => updateFilter("available_today", event.target.value)}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">Project committed</option>
              </select>
            </label>
            <div className="overview-filter-actions">
              <button type="submit">Apply filters</button>
              <button type="button" onClick={handleReset}>
                Reset
              </button>
            </div>
          </form>
        </Collapsible.Content>
      </Collapsible.Root>
    );
  }

  return (
    <main>
      <p style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {!isJobProvider ? <Link href="/workers/new">Create new worker</Link> : null}
        {!isJobProvider ? (
          <button type="button" onClick={() => setSendOnboardingModalOpen(true)}>
            Send onboarding form link
          </button>
        ) : null}
        {!isJobProvider ? <a href="/onboarding" target="_blank" rel="noreferrer">Preview onboarding form</a> : null}
      </p>

      <h1 className="overview-page-title" style={{ marginBottom: "0.5rem" }}>Workforce Overview</h1>
      <p className="overview-page-summary" style={{ marginTop: 0 }}>
        Total workforce records: {summary.total} | Available: {summary.available}
      </p>

      {renderFilterCollapsible("workforce-filter-desktop-shell")}

      {errorMessage ? <p>{errorMessage}</p> : null}
      {!errorMessage ? (
        <p className="workforce-overview-helper-text" style={{ marginTop: 0, color: "var(--rd-text-muted)" }}>
          {isJobProvider
            ? "Use this provider-scoped workforce view to discover relevant tradesmen and contractors, review profiles, and build a reusable shortlist for your hiring needs."
            : "Use this operations workspace to manage workforce records, review onboarding/compliance signals, compare candidates, and prepare dispatch execution across the platform."}
        </p>
      ) : null}

      {!errorMessage && workers.length === 0 ? (
        <p>No workers found in Supabase.</p>
      ) : null}

      {!errorMessage && workers.length > 0 ? (
        <WorkerOverviewTable
          workers={workers}
          jobs={jobs}
          jobsUnavailable={jobsUnavailable}
          preferredRole={filters.primary_role || undefined}
          mode={isJobProvider ? "job_provider" : "admin"}
          providerAccessSeed={initialData.providerAccessSeed}
          mobileFilterControls={renderFilterCollapsible("workforce-filter-mobile-shell")}
          onDeleteSuccess={(workerId) =>
            setWorkers((current) => current.filter((worker) => worker.worker_id !== workerId))
          }
        />
      ) : null}

      {!isJobProvider ? (
        <SendOnboardingLinkModal
          open={sendOnboardingModalOpen}
          onClose={() => setSendOnboardingModalOpen(false)}
        />
      ) : null}
    </main>
  );
}
