import type { WorkerOverviewRow } from "@/lib/workers/types";

function verificationLabel(type: "platform_verified" | "external") {
  return type === "platform_verified" ? "Verified Platform Job" : "External Portfolio Item";
}

export function WorkerPortfolioSection({ worker }: { worker: WorkerOverviewRow }) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Portfolio</h3>
        <p style={{ margin: "0.3rem 0 0", color: "var(--rd-text-muted)" }}>
          Compact evidence set for client review and shortlist decisions.
        </p>
      </div>

      {worker.portfolio.length === 0 ? (
        <div
          style={{
            padding: "0.95rem 1rem",
            borderRadius: 14,
            border: "1px dashed var(--rd-border-strong)",
            color: "var(--rd-text-muted)",
            background: "var(--rd-surface-soft)",
          }}
        >
          No portfolio items are attached yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {worker.portfolio.map((item) => (
            <article
              key={item.id}
              style={{
                padding: "0.95rem 1rem",
                borderRadius: 16,
                border: "1px solid var(--rd-border)",
                background: "var(--rd-surface-soft)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <strong>{item.title}</strong>
                  <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
                    {item.tradeCategory} | {item.areaLabel} | {item.completedMonth} {item.completedYear}
                  </p>
                </div>
                <span
                  style={{
                    alignSelf: "start",
                    borderRadius: 999,
                    padding: "0.25rem 0.65rem",
                    background: item.verificationType === "platform_verified" ? "#dcfce7" : "#e2e8f0",
                    color: item.verificationType === "platform_verified" ? "#166534" : "#334155",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  {verificationLabel(item.verificationType)}
                </span>
              </div>
              <p style={{ margin: "0.55rem 0 0", color: "var(--rd-text)" }}>
                <strong>Role:</strong> {item.role}
              </p>
              <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>{item.description}</p>
              <p style={{ margin: "0.45rem 0 0", color: "var(--rd-text-soft)" }}>
                {item.mediaUrls.length > 0 ? `${item.mediaUrls.length} media reference(s) available` : "No media preview attached"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
