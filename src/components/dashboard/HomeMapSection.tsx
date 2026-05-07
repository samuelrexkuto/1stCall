import { HomeMap } from "@/components/dashboard/HomeMap";
import type { JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import type { DashboardMapDataPayload } from "@/lib/dashboard";
import type { WorkerOverviewRow } from "@/lib/workers/types";
import styles from "./HomeMap.module.css";

export function HomeMapSection({
  initialData,
  initialError,
  jobs = [],
  workers = [],
}: {
  initialData?: DashboardMapDataPayload | null;
  initialError?: string;
  jobs?: JobOverviewRow[];
  workers?: WorkerOverviewRow[];
}) {
  if (initialError) {
    return (
      <section className={styles.errorSection}>
        <h3 className={styles.errorTitle}>Operations Map</h3>
        <p className={styles.emptyText}>Map failed to load: {initialError}</p>
      </section>
    );
  }

  return <HomeMap initialData={initialData ?? null} initialError={null} jobs={jobs} workers={workers} />;
}
