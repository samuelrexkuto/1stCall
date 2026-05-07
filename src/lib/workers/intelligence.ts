import type {
  WorkerCredentialsCompliance,
  WorkerPerformanceSummary,
  WorkerPortfolioItem,
  WorkerStatHubData,
  WorkerStatHubMeta,
} from "@/lib/workers/types";
import { normaliseWorkforceGrouping } from "@/lib/workforce-grouping";

type WorkerSource = {
  worker_id: string;
  full_name: string;
  primary_role: string | null;
  skill_tags?: string[];
  town: string | null;
  postcode: string;
  location_display: string | null;
  available_today: boolean;
  right_to_work: boolean;
  contract_signed: boolean;
  contract_status?: string | null;
  contract_signed_at?: string | null;
  id_document_uploaded?: boolean;
  cscs_uploaded?: boolean;
  portfolio_uploaded?: boolean;
  certificates_uploaded?: boolean;
  priority_tier: string;
  reliability_score: number;
  created_at: string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildNextReleaseDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function formatArea(worker: Pick<WorkerSource, "location_display" | "town" | "postcode">) {
  return worker.location_display ?? ([worker.town, worker.postcode].filter(Boolean).join(" / ") || "Area unavailable");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isGenericContractorLabel(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized === "contractor" || normalized === "contractors";
}

function buildInternalScoreSnapshot(worker: WorkerSource, verifiedBookingsCount: number) {
  const reliabilityScore = clampScore(worker.reliability_score > 0 ? worker.reliability_score : 58 + verifiedBookingsCount * 4);
  const siteConductScore = clampScore(
    52 +
      (worker.right_to_work ? 8 : 0) +
      (worker.contract_signed || worker.contract_status === "signed" || worker.contract_signed_at ? 6 : 0) +
      (worker.id_document_uploaded ? 6 : 0) +
      (worker.certificates_uploaded ? 4 : 0),
  );
  const workQualityScore = clampScore(
    50 +
      (worker.portfolio_uploaded ? 12 : 0) +
      (worker.certificates_uploaded ? 8 : 0) +
      (worker.cscs_uploaded ? 8 : 0) +
      Math.min(verifiedBookingsCount * 2, 12),
  );
  const overallScore = clampScore(reliabilityScore * 0.45 + siteConductScore * 0.25 + workQualityScore * 0.3);

  return {
    overallScore,
    reliabilityScore,
    siteConductScore,
    workQualityScore,
  };
}

export function buildWorkerStatHubData(
  worker: WorkerSource,
  options?: { verifiedBookingsCount?: number; reviewedJobsCount?: number },
): WorkerStatHubData {
  const verifiedBookingsCount =
    typeof options?.verifiedBookingsCount === "number"
      ? Math.max(0, Math.round(options.verifiedBookingsCount))
      : 0;
  const reviewedJobsCount =
    typeof options?.reviewedJobsCount === "number"
      ? Math.max(0, Math.round(options.reviewedJobsCount))
      : verifiedBookingsCount;
  const verifiedReviewedJobsCount = Math.min(verifiedBookingsCount, reviewedJobsCount);
  const status =
    verifiedReviewedJobsCount >= 6
      ? "established"
      : verifiedReviewedJobsCount >= 3
        ? "provisional"
        : "insufficient";
  const internalSnapshot = buildInternalScoreSnapshot(worker, verifiedBookingsCount);

  return {
    status,
    overallScore: status === "insufficient" ? 0 : internalSnapshot.overallScore,
    reliabilityScore: status === "insufficient" ? null : internalSnapshot.reliabilityScore,
    siteConductScore: status === "insufficient" ? null : internalSnapshot.siteConductScore,
    workQualityScore: status === "insufficient" ? null : internalSnapshot.workQualityScore,
    internalScoreSnapshot: internalSnapshot.overallScore,
    verifiedBookingsCount,
    nextReleaseAt: buildNextReleaseDate(),
  };
}

export function buildWorkerStatHubMeta(input: {
  verifiedCompletedJobsCount: number;
  reviewedJobsCount: number;
  portfolioBackedJobsCount?: number;
  repeatBookedCount?: number;
}): WorkerStatHubMeta {
  const verifiedCompletedJobsCount = Math.max(0, Math.round(input.verifiedCompletedJobsCount));
  const reviewedJobsCount = Math.max(0, Math.round(input.reviewedJobsCount));
  const status =
    Math.min(verifiedCompletedJobsCount, reviewedJobsCount) >= 6
      ? "established"
      : Math.min(verifiedCompletedJobsCount, reviewedJobsCount) >= 3
        ? "provisional"
        : "insufficient";

  return {
    verifiedCompletedJobsCount,
    reviewedJobsCount,
    portfolioBackedJobsCount: Math.max(0, Math.round(input.portfolioBackedJobsCount ?? 0)),
    repeatBookedCount: Math.max(0, Math.round(input.repeatBookedCount ?? 0)),
    status,
  };
}

export function buildWorkerPerformanceSummary(
  worker: WorkerSource,
  stathub: WorkerStatHubData,
  completedJobsCount = stathub.verifiedBookingsCount,
): WorkerPerformanceSummary {
  return {
    completedJobsCount,
    repeatClientsCount: 0,
    noShowIncidents: 0,
    sameDayCancellations: 0,
    lastBookingCompletedAt: null,
  };
}

export function buildWorkerPortfolio(worker: WorkerSource, stathub: WorkerStatHubData): WorkerPortfolioItem[] {
  if (!worker.portfolio_uploaded) return [];

  const trade = worker.primary_role ?? "General Operative";
  const areaLabel = formatArea(worker);
  const items: WorkerPortfolioItem[] = [];

  if (stathub.verifiedBookingsCount > 0) {
    items.push({
      id: `${worker.worker_id}-portfolio-platform-1`,
      title: `${trade} verified platform job`,
      tradeCategory: trade,
      areaLabel,
      completedMonth: MONTH_NAMES[new Date().getUTCMonth()],
      completedYear: String(new Date().getUTCFullYear()),
      role: trade,
      description: "Verified platform placement with completed-job evidence and matching portfolio proof.",
      mediaUrls: [`/portfolio/${worker.worker_id}/platform-1`],
      verificationType: "platform_verified",
    });
  }

  items.push({
    id: `${worker.worker_id}-portfolio-external-1`,
    title: `${trade} portfolio evidence`,
    tradeCategory: trade,
    areaLabel,
    completedMonth: MONTH_NAMES[new Date().getUTCMonth()],
    completedYear: String(new Date().getUTCFullYear()),
    role: trade,
    description: "External portfolio evidence shared by the worker for similar site requirements.",
    mediaUrls: [`/portfolio/${worker.worker_id}/1`],
    verificationType: "external",
  });

  return items;
}

export function buildWorkerCredentialsSummary(worker: WorkerSource) {
  const items: string[] = [];

  if (worker.right_to_work) items.push("Right to work verified");
  if (worker.contract_signed || worker.contract_status === "signed" || worker.contract_signed_at) {
    items.push("Signed contract on file");
  }
  if (worker.id_document_uploaded) items.push("ID document uploaded");
  if (worker.cscs_uploaded) items.push("CSCS evidence uploaded");
  if (worker.certificates_uploaded) items.push("Certificates uploaded");
  if (items.length === 0) items.push("Compliance review in progress");

  return items;
}

export function buildWorkerCredentialsCompliance(input: {
  worker: WorkerSource;
  insuranceVerified?: boolean;
  insuranceTypes?: string[];
  enhancedDbs?: boolean;
  firstAidCertified?: boolean;
  companiesHouseVerified?: boolean;
  companiesHouseNumber?: string | null;
  constructionlineMember?: boolean;
  qualificationLabel?: string | null;
  accreditations?: string[];
}): WorkerCredentialsCompliance {
  const { worker } = input;

  return {
    insuranceVerified: Boolean(input.insuranceVerified),
    insuranceTypes: input.insuranceTypes ?? [],
    enhancedDbs: Boolean(input.enhancedDbs),
    firstAidCertified: Boolean(input.firstAidCertified),
    rightToWorkVerified: Boolean(worker.right_to_work),
    companiesHouseVerified: Boolean(input.companiesHouseVerified),
    companiesHouseNumber: input.companiesHouseNumber ?? null,
    constructionlineMember: Boolean(input.constructionlineMember),
    cscsVerified: Boolean(worker.cscs_uploaded),
    qualificationLabel:
      input.qualificationLabel ?? (worker.certificates_uploaded ? "Certificates on file" : null),
    accreditations: input.accreditations ?? [],
  };
}

export function deriveWorkerProfileClassification(worker: Pick<WorkerSource, "primary_role" | "skill_tags"> & {
  worker_type?: string | null;
  contractor_type?: string | null;
  specialist_area?: string | null;
}) {
  const role = normalizeText(worker.primary_role);
  const rawSkillTags = Array.isArray(worker.skill_tags) ? worker.skill_tags.filter(Boolean) : [];
  const primarySkillTag = rawSkillTags[0]?.trim() || (worker.primary_role?.trim() ?? null);
  const explicitWorkerType = normalizeText(worker.worker_type);
  const explicitContractorType = normalizeText(worker.contractor_type);
  const explicitSpecialistArea = worker.specialist_area?.trim() || null;
  const isContractor = normaliseWorkforceGrouping({
    worker_type: explicitWorkerType,
    contractor_type: explicitContractorType,
    primary_role: role,
    specialistArea: explicitSpecialistArea,
  }) === "Contractor";

  if (!isContractor) {
    return {
      workerType: "tradesman" as const,
      contractorType: null,
      specialistArea: null,
      skillTag: primarySkillTag,
    };
  }

  const contractorType =
    explicitContractorType === "multi_discipline" || explicitContractorType === "multi discipline"
      ? "multi_discipline" as const
      : explicitContractorType === "specialist"
        ? "specialist" as const
        : rawSkillTags.length > 1 || role.includes("multi discipline") || role.includes("multi-discipline")
          ? "multi_discipline" as const
          : "specialist" as const;

  return {
    workerType: "contractor" as const,
    contractorType,
    specialistArea:
      contractorType === "specialist"
        ? isGenericContractorLabel(explicitSpecialistArea ?? primarySkillTag)
          ? null
          : (explicitSpecialistArea ?? primarySkillTag)
        : null,
    skillTag: primarySkillTag,
  };
}

export function buildWorkerFeedbackHighlights(
  stathub: WorkerStatHubData,
  performanceSummary: WorkerPerformanceSummary,
  meta?: WorkerStatHubMeta,
) {
  if (stathub.status === "insufficient") {
    return [
      "A credible public Site Score begins after 3 verified completed platform jobs with valid review data.",
      "Until then, score confidence is still building through direct review activity and portfolio-backed proof.",
    ];
  }

  return [
    stathub.status === "provisional"
      ? "This score is based on early verified platform activity and becomes more reliable as more completed jobs and review evidence are added."
      : "This Site Score is based on a stronger body of verified completed platform jobs and monthly validated review evidence.",
    (meta?.repeatBookedCount ?? performanceSummary.repeatClientsCount ?? 0) > 0
      ? "Repeat-booked client history is supporting score credibility."
      : "Score credibility improves through repeated verified completed jobs, client review evidence, and portfolio-backed project proof.",
  ];
}
