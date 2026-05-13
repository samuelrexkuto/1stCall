import type React from "react";
import type { WorkerOverviewRow } from "@/lib/workers/types";

function yesNo(value: boolean | undefined, fallback = "No") {
  return value ? "Yes" : fallback;
}

function ComplianceSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--rd-border)",
        borderRadius: 8,
        padding: "0.85rem 0.95rem",
        background: "var(--rd-surface-soft)",
        display: "grid",
        gap: "0.45rem",
      }}
    >
      <h4 style={{ margin: 0, fontSize: "0.95rem" }}>{title}</h4>
      <div style={{ display: "grid", gap: "0.35rem", color: "var(--rd-text-muted)" }}>{children}</div>
    </section>
  );
}

export function WorkerCredentialsComplianceSection({ worker }: { worker: WorkerOverviewRow }) {
  const compliance = worker.credentialsCompliance;
  const insuranceTypes = compliance.insuranceTypes ?? [];
  const accreditations = compliance.accreditations ?? [];

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Credentials / Compliance</h3>
        <p style={{ margin: "0.3rem 0 0", color: "var(--rd-text-muted)" }}>
          Procurement-relevant compliance and credential signals for consultant and contractor review.
        </p>
      </div>

      <div style={{ display: "grid", gap: "0.7rem" }}>
        <ComplianceSection title="Insurance">
          <p style={{ margin: 0 }}>Insurance verified: {yesNo(compliance.insuranceVerified)}</p>
          <p style={{ margin: 0 }}>{insuranceTypes.length > 0 ? insuranceTypes.join(", ") : "No insurance types listed."}</p>
        </ComplianceSection>

        <ComplianceSection title="CSCS">
          <p style={{ margin: 0 }}>CSCS status: {yesNo(compliance.cscsVerified, "Not recorded")}</p>
          {/* TODO: wire CSCS verification code when the validation/onboarding schema stores it. */}
          <p style={{ margin: 0 }}>Code required for verification: Verification code not provided.</p>
        </ComplianceSection>

        <ComplianceSection title="Enhanced DBS">
          <p style={{ margin: 0 }}>Enhanced DBS: {yesNo(compliance.enhancedDbs, "Not recorded")}</p>
          {/* TODO: surface DBS Update Service and Enhanced DBS paperwork fields when available. */}
          <p style={{ margin: 0 }}>No Enhanced DBS verification document provided.</p>
        </ComplianceSection>

        <ComplianceSection title="Qualifications / NVQ / Certification">
          <p style={{ margin: 0 }}>{compliance.qualificationLabel ?? "No qualifications, NVQs, or certifications listed."}</p>
          <p style={{ margin: 0 }}>Documents must be available for verification.</p>
        </ComplianceSection>

        <ComplianceSection title="Accreditations / Memberships">
          <p style={{ margin: 0 }}>{accreditations.length > 0 ? accreditations.join(", ") : "No accreditations or memberships listed."}</p>
          <p style={{ margin: 0 }}>Documents must be available for verification.</p>
        </ComplianceSection>
      </div>
    </section>
  );
}
