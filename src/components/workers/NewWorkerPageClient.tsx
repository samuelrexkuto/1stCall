"use client";

import dynamic from "next/dynamic";

const WorkerForm = dynamic(
  () => import("@/components/forms/WorkerForm").then((module) => module.WorkerForm),
  {
    ssr: false,
    loading: () => (
      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          padding: "1rem",
          borderRadius: 12,
          border: "1px solid var(--rd-border)",
          background: "var(--rd-bg-elevated)",
        }}
      >
        <strong>Loading worker form…</strong>
        <span style={{ color: "var(--rd-text-muted)" }}>
          Preparing location search, document upload sections, and worker fields.
        </span>
      </section>
    ),
  },
);

export function NewWorkerPageClient() {
  return <WorkerForm successRedirect="/workers" />;
}
