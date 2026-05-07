export type WorkforceGrouping = "Tradesman" | "Contractor";

export type WorkforceGroupingSource = {
  full_name?: string | null;
  workforce_type?: string | null;
  worker_type?: string | null;
  workerType?: string | null;
  type?: string | null;
  grouping?: string | null;
  primary_role?: string | null;
  primaryRole?: string | null;
  role?: string | null;
  trade?: string | null;
  speciality?: string | null;
  specialty?: string | null;
  selected_role?: string | null;
  skillTag?: string | null;
  specialistArea?: string | null;
  contractorType?: string | null;
  contractor_type?: string | null;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function normaliseWorkforceGrouping(worker: WorkforceGroupingSource): WorkforceGrouping {
  const rawType = normalizeText(
    worker.workforce_type ??
      worker.worker_type ??
      worker.workerType ??
      worker.type ??
      worker.grouping,
  );
  const rawRole = normalizeText(
    worker.primary_role ??
      worker.primaryRole ??
      worker.role ??
      worker.trade ??
      worker.speciality ??
      worker.specialty ??
      worker.selected_role ??
      worker.skillTag ??
      worker.specialistArea,
  );
  const rawName = normalizeText(worker.full_name);
  const rawContractorType = normalizeText(worker.contractor_type ?? worker.contractorType);
  const combined = `${rawType} ${rawRole} ${rawContractorType} ${rawName}`;

  const contractorTerms = [
    "contractor",
    "company",
    "limited",
    "ltd",
    "multi-discipline",
    "multi discipline",
    "subcontractor",
  ];
  const tradesmanTerms = [
    "tradesman",
    "trade",
    "labourer",
    "laborer",
    "skilled labourer",
    "general labourer",
    "plaster",
    "plasterer",
    "plastering",
    "electrician",
    "sparky",
    "carpenter",
    "chippy",
    "plumber",
    "dryliner",
    "painter",
    "bricklayer",
    "tiler",
    "roofer",
  ];

  if (contractorTerms.some((term) => combined.includes(term))) return "Contractor";
  if (tradesmanTerms.some((term) => combined.includes(term))) return "Tradesman";
  return "Tradesman";
}

export function getPrimaryRole(worker: WorkforceGroupingSource) {
  return (
    worker.primary_role ||
    worker.primaryRole ||
    worker.role ||
    worker.trade ||
    worker.speciality ||
    worker.specialty ||
    worker.selected_role ||
    worker.skillTag ||
    worker.specialistArea ||
    "Not provided"
  );
}
