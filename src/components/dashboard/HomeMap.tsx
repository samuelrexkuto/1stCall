"use client";

import dynamic from "next/dynamic";
import type { JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import type { DashboardMapDataPayload } from "@/lib/dashboard";
import type { WorkerOverviewRow } from "@/lib/workers/types";

const HomeMapClient = dynamic(
  () => import("./HomeMapClient").then((module) => module.HomeMapClient),
  {
    ssr: false,
    loading: () => (
      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          border: "1px solid #dbe1ea",
          borderRadius: 8,
          background: "#ffffff",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Operations Map</h2>
        <p style={{ margin: "0.35rem 0 0", color: "#475569" }}>Loading map...</p>
      </section>
    ),
  },
);

export function HomeMap({
  initialData = null,
  initialError = null,
  jobs = [],
  workers = [],
}: {
  initialData?: DashboardMapDataPayload | null;
  initialError?: string | null;
  jobs?: JobOverviewRow[];
  workers?: WorkerOverviewRow[];
}) {
  return <HomeMapClient initialData={initialData} initialError={initialError} jobs={jobs} workers={workers} />;
}
