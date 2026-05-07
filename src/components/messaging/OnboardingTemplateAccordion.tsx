"use client";

export function OnboardingTemplateAccordion({
  title,
  open,
  onToggle,
  value,
  onChange,
  loading,
  error,
  active,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  error?: string;
  active?: boolean;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--rd-border)",
        borderRadius: 16,
        background: "var(--rd-surface-soft)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.9rem 1rem",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 600, color: "var(--rd-text)" }}>{title}</div>
          <div style={{ marginTop: "0.15rem", fontSize: "0.9rem", color: "var(--rd-text-muted)" }}>
            Optional, editable, and ready to use for onboarding outreach.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--rd-text-muted)" }}>
          {active ? (
            <span
              style={{
                padding: "0.25rem 0.55rem",
                borderRadius: 999,
                background: "var(--rd-control-active-bg)",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              Active
            </span>
          ) : null}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open ? (
        <div style={{ padding: "0 1rem 1rem" }}>
          {loading ? <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>Loading onboarding template...</p> : null}
          {error ? (
            <p style={{ margin: 0, color: "#b45309" }}>
              {error}
            </p>
          ) : null}
          {!loading ? (
            <>
              <p style={{ margin: "0 0 0.55rem", color: "var(--rd-text-muted)" }}>
                Edit the onboarding copy here before sending.
              </p>
              <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                style={{ width: "100%", minHeight: 190, resize: "vertical" }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
