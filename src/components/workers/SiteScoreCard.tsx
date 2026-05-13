import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Callout } from "@radix-ui/themes";
import type { WorkerOverviewRow, WorkerStatHubData } from "@/lib/workers/types";

function formatReleaseDate(value: string | null) {
  if (!value) return "Not scheduled yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: WorkerStatHubData["status"]) {
  if (status === "established") return "Established Score";
  if (status === "provisional") return "Provisional Score";
  return "Insufficient Verified Data";
}

function getStatusStyle(status: WorkerStatHubData["status"]) {
  if (status === "established") {
    return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
  }
  if (status === "provisional") {
    return { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd" };
  }
  return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
}

export function SiteScoreCard({ worker }: { worker: WorkerOverviewRow }) {
  const stathub = worker.stathub;

  return (
    <section
      style={{
        padding: "1rem",
        borderRadius: 16,
        background: "var(--rd-surface-soft)",
        border: "1px solid var(--rd-border)",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Site Score presented by StatHub</h3>
          <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
            Monthly score generated from jobs completed through the platform and validated before release.
          </p>
        </div>
        <span
          style={{
            ...getStatusStyle(stathub.status),
            borderRadius: 999,
            padding: "0.3rem 0.75rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            alignSelf: "start",
          }}
        >
          {getStatusLabel(stathub.status)}
        </span>
      </div>

      <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
        <strong>Next score release date:</strong> {formatReleaseDate(stathub.nextReleaseAt)}
      </p>
      <Callout.Root color="indigo" variant="soft" className="rd-info-callout">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>
          A credible public Site Score begins after 3 verified completed platform jobs with valid review data.
          {" "}
          Until then, score confidence is still building through direct review activity and portfolio-backed proof.
        </Callout.Text>
      </Callout.Root>
    </section>
  );
}
