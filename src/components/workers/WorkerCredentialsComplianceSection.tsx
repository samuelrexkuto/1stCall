import type { WorkerOverviewRow } from "@/lib/workers/types";

function yesNo(value: boolean | undefined, fallback = "No") {
  return value ? "Yes" : fallback;
}

export function WorkerCredentialsComplianceSection({ worker }: { worker: WorkerOverviewRow }) {
  const compliance = worker.credentialsCompliance;
  const isContractor = worker.workerType === "contractor";

  const items: Array<{ label: string; value: string; hidden?: boolean }> = [
    { label: "Insurance Verified", value: yesNo(compliance.insuranceVerified) },
    {
      label: "Insurance Types",
      value: compliance.insuranceTypes && compliance.insuranceTypes.length > 0 ? compliance.insuranceTypes.join(", ") : "Not recorded",
    },
    { label: "Enhanced DBS", value: yesNo(compliance.enhancedDbs) },
    { label: "First Aid Certified", value: yesNo(compliance.firstAidCertified) },
    { label: "Right to Work Verified", value: yesNo(compliance.rightToWorkVerified) },
    { label: "Companies House Verified", value: yesNo(compliance.companiesHouseVerified), hidden: !isContractor },
    {
      label: "Companies House Number",
      value: compliance.companiesHouseNumber ?? "Not applicable",
      hidden: !isContractor,
    },
    { label: "Constructionline Member", value: yesNo(compliance.constructionlineMember), hidden: !isContractor },
    { label: "CSCS Verified", value: yesNo(compliance.cscsVerified) },
    { label: "Qualification / NVQ", value: compliance.qualificationLabel ?? "Not recorded" },
    {
      label: "Accreditations / Memberships",
      value: compliance.accreditations && compliance.accreditations.length > 0 ? compliance.accreditations.join(", ") : "Not recorded",
    },
  ];

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Credentials / Compliance</h3>
        <p style={{ margin: "0.3rem 0 0", color: "var(--rd-text-muted)" }}>
          Procurement-relevant compliance and credential signals for consultant and contractor review.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.7rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {items.filter((item) => !item.hidden).map((item) => (
          <div
            key={item.label}
            style={{
              border: "1px solid var(--rd-border)",
              borderRadius: 14,
              padding: "0.85rem 0.95rem",
              background: "var(--rd-surface-soft)",
            }}
          >
            <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)" }}>{item.label}</div>
            <div style={{ marginTop: "0.25rem", fontWeight: 700, color: "var(--rd-text)" }}>{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
