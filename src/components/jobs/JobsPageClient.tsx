"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STANDARD_ROLES } from "@/lib/constants/roles";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { JobOverviewTable, type JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import {
  normaliseBroadcastStatus,
  type BroadcastStatus,
} from "@/lib/dispatch/broadcast-status-constants";

interface ProviderOption {
  provider_id: string;
  company_name: string;
}

interface JobsPageClientProps {
  initialFilters: {
    status: string;
    title: string;
    role: string;
    area: string;
    postcode: string;
    provider: string;
    job_status: string;
    fill_status: string;
    payment_status: string;
    broadcast_status: string;
  };
  initialData: {
    jobs: JobOverviewRow[];
    providers: ProviderOption[];
    capabilities: { invoices: boolean };
    warningMessage: string;
    errorMessage: string;
  };
}

function buildJobsQueryString(filters: JobsPageClientProps["initialFilters"]) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return searchParams.toString();
}

export function JobsPageClient({ initialFilters, initialData }: JobsPageClientProps) {
  const router = useRouter();
  const { user } = useAuthSession();
  const [filters, setFilters] = useState(initialFilters);
  const [jobs, setJobs] = useState<JobOverviewRow[]>(initialData.jobs);
  const [providers, setProviders] = useState<ProviderOption[]>(initialData.providers);
  const [capabilities, setCapabilities] = useState(initialData.capabilities);
  const [errorMessage, setErrorMessage] = useState(initialData.errorMessage);
  const [warningMessage, setWarningMessage] = useState(initialData.warningMessage);

  useEffect(() => {
    setFilters(initialFilters);
    setJobs(initialData.jobs);
    setProviders(initialData.providers);
    setCapabilities(initialData.capabilities);
    setErrorMessage(initialData.errorMessage);
    setWarningMessage(initialData.warningMessage);
  }, [initialFilters, initialData]);

  function updateFilter<K extends keyof JobsPageClientProps["initialFilters"]>(
    key: K,
    value: JobsPageClientProps["initialFilters"][K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const queryString = buildJobsQueryString(filters);
    router.replace(queryString ? `/jobs?${queryString}` : "/jobs");
  }

  function handleReset() {
    const clearedFilters: JobsPageClientProps["initialFilters"] = {
      status: "",
      title: "",
      role: "",
      area: "",
      postcode: "",
      provider: "",
      job_status: "",
      fill_status: "",
      payment_status: "",
      broadcast_status: "",
    };

    setFilters(clearedFilters);
    router.replace("/jobs");
  }

  const summary = useMemo(
    () =>
      jobs.reduce(
        (acc, job) => {
          acc.total += 1;
          if (job.job_status === "open") acc.open += 1;
          const broadcastStatus = normaliseBroadcastStatus(job.broadcast_status);
          if (broadcastStatus === "broadcast ready") acc.broadcastReady += 1;
          if (broadcastStatus === "awaiting response") acc.awaitingResponse += 1;
          if (broadcastStatus === "completed") acc.completed += 1;
          return acc;
        },
        { total: 0, open: 0, broadcastReady: 0, awaitingResponse: 0, completed: 0 },
      ),
    [jobs],
  );

  const isJobProvider = user?.role === "job_provider";

  function handleBroadcastStatusUpdated(jobId: string, status: BroadcastStatus) {
    setJobs((current) =>
      current.map((job) =>
        job.job_id === jobId
          ? { ...job, broadcast_status: status }
          : job,
      ),
    );
  }

  function handleJobUpdated(updatedJob: JobOverviewRow) {
    const updatedJobId = updatedJob.job_id || (updatedJob as { id?: string }).id;
    if (!updatedJobId) return;

    const confirmedCount = Number(
      updatedJob.workersConfirmed ??
      updatedJob.workers_confirmed ??
      updatedJob.confirmed_workforce_count ??
      updatedJob.acceptedWorkforce?.length ??
      updatedJob.accepted_workers?.length ??
      0,
    );

    setJobs((current) =>
      current.map((job) =>
        job.job_id === updatedJobId || (job as { id?: string }).id === updatedJobId
          ? {
              ...job,
              ...updatedJob,
              job_id: job.job_id,
              workersConfirmed: confirmedCount,
              workers_confirmed: confirmedCount,
              confirmed_workforce_count: confirmedCount,
            }
          : job,
      ),
    );
  }

  return (
    <main>
      <h1 style={{ marginBottom: "0.5rem" }}>Jobs Overview</h1>
      <p style={{ marginTop: 0 }}>
        {isJobProvider ? "Your jobs only" : "All jobs"}: {summary.total} | Open: {summary.open} | Broadcast ready: {summary.broadcastReady} |
        Awaiting response: {summary.awaitingResponse} | Completed: {summary.completed}
      </p>

      {errorMessage ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.9rem 1rem",
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
          }}
        >
          <strong style={{ display: "block", marginBottom: "0.3rem" }}>
            Jobs could not be loaded right now.
          </strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {warningMessage ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.9rem 1rem",
            borderRadius: 10,
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            color: "#92400e",
          }}
        >
          <strong style={{ display: "block", marginBottom: "0.3rem" }}>
            Compatibility mode
          </strong>
          <span>{warningMessage}</span>
        </div>
      ) : null}

      <form
        className="overview-filter-form"
        onSubmit={handleApplyFilters}
        style={{
          marginBottom: "1rem",
        }}
      >
        <label className="overview-filter-field">
          Job title
          <input
            value={filters.title}
            onChange={(event) => updateFilter("title", event.target.value)}
          />
        </label>
        <label className="overview-filter-field">
          Required role
          <select
            value={filters.role}
            onChange={(event) => updateFilter("role", event.target.value)}
          >
            <option value="">All</option>
            {STANDARD_ROLES.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {roleOption}
              </option>
            ))}
          </select>
        </label>
        <label className="overview-filter-field">
          Area
          <input
            value={filters.area}
            onChange={(event) => updateFilter("area", event.target.value)}
          />
        </label>
        <label className="overview-filter-field">
          Postcode
          <input
            value={filters.postcode}
            onChange={(event) => updateFilter("postcode", event.target.value)}
          />
        </label>
        {!isJobProvider ? (
          <label className="overview-filter-field">
            Provider
            <select
              value={filters.provider}
              onChange={(event) => updateFilter("provider", event.target.value)}
            >
              <option value="">All</option>
              {providers.map((provider) => (
                <option key={provider.provider_id} value={provider.company_name}>
                  {provider.company_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="overview-filter-field">
          Job status
          <select
            value={filters.job_status}
            onChange={(event) => updateFilter("job_status", event.target.value)}
          >
            <option value="">All</option>
            <option value="open">open</option>
            <option value="partially_filled">partially_filled</option>
            <option value="filled">filled</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        <label className="overview-filter-field">
          Payment status
          <select
            value={filters.payment_status}
            onChange={(event) => updateFilter("payment_status", event.target.value)}
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="part_paid">part_paid</option>
            <option value="paid">paid</option>
            <option value="overdue">overdue</option>
            <option value="written_off">written_off</option>
          </select>
        </label>
        <label className="overview-filter-field">
          Broadcast status
          <select
            value={filters.broadcast_status}
            onChange={(event) => updateFilter("broadcast_status", event.target.value)}
          >
            <option value="">All</option>
            <option value="broadcast ready">broadcast ready</option>
            <option value="awaiting response">awaiting response</option>
            <option value="completed">completed</option>
          </select>
        </label>
        <input type="hidden" name="status" value={filters.status} />
        <div className="overview-filter-actions">
          <button type="submit">Apply filters</button>
          <button type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {!errorMessage && jobs.length === 0 ? <p>No jobs found for the current filter.</p> : null}
      {!errorMessage && jobs.length > 0 ? (
        <JobOverviewTable
          invoiceFeaturesEnabled={capabilities.invoices}
          jobs={jobs}
          mode={isJobProvider ? "job_provider" : "admin"}
          onDeleteSuccess={(jobId) =>
            setJobs((current) => current.filter((job) => job.job_id !== jobId))
          }
          onBroadcastStatusUpdated={handleBroadcastStatusUpdated}
          onJobUpdated={handleJobUpdated}
        />
      ) : null}
    </main>
  );
}
