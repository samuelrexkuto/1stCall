import {
  getProviderFacingDisplayName,
  getProviderFacingLocationText,
  getSiteScoreStatusLabel,
} from "@/lib/provider-access";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export type HiringPatternInsightType =
  | "distance"
  | "repeat_booking"
  | "score_match"
  | "availability"
  | "portfolio_strength";

export type HiringPatternInsight = {
  title: string;
  description: string;
  type: HiringPatternInsightType;
};

export type SuggestedJobPost = {
  title?: string;
  tradeCategory?: string;
  coreRole?: string | null;
  selectedRole?: string | null;
  requiredRole?: string | null;
  trade?: string | null;
  quantity?: number;
  location?: string;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  startDate?: string;
  durationLabel?: string;
  skillsRequired?: string[];
  requirements?: string[];
  ppeRequired?: boolean | null;
  dbsRequired?: boolean | null;
  dbsRequirement?: string | null;
  enhancedDbsRequired?: boolean | null;
  ownToolsRequired?: boolean | null;
  cscsRequired?: boolean | null;
  ipafRequired?: boolean | null;
  certificatesRequired?: string | null;
  notes?: string;
  siteType?: string;
};

export type WorkerRecommendation = {
  workerId: string;
  scoreReason: string;
  distanceLabel?: string;
  matchStrength: number;
  roleScore?: number;
  skillsScore?: number;
  complianceScore?: number;
  locationScore?: number;
  availabilityScore?: number;
  performanceScore?: number;
  reasons?: string[];
  gaps?: string[];
};

export interface HiringHistoryInput {
  recentRoles: string[];
  recentAreas: string[];
  repeatWorkerNames: string[];
}

export interface JobProviderJobHistoryRow {
  job_title: string;
  trade_type: string | null;
  area: string | null;
  postcode: string;
}

const tradeKeywordMap = [
  { trade: "Painter / Decorator", keywords: ["painter", "painting", "decorator", "decorating"] },
  { trade: "Electrician", keywords: ["electrician", "spark", "sparky"] },
  { trade: "Carpenter", keywords: ["carpenter", "carpentry", "joiner", "chippy"] },
  { trade: "Plumber", keywords: ["plumber", "plumbing"] },
  { trade: "Groundworker", keywords: ["groundworker", "ground works", "groundwork"] },
  { trade: "Bricklayer", keywords: ["bricklayer", "bricklaying"] },
  { trade: "Labourer", keywords: ["labourer", "laborer", "operative"] },
  { trade: "Traffic Marshal", keywords: ["traffic marshal", "banksman"] },
];

const siteTypes = ["school", "hospital", "warehouse", "office", "residential", "site", "university"];
const weekdayPattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeRole(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\blabor\b/g, "labour")
    .replace(/\blaborer\b/g, "labourer")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\bworkers\b/g, "worker")
    .replace(/\blabourers\b/g, "labourer")
    .replace(/\boperatives\b/g, "operative")
    .replace(/\s+/g, " ")
    .trim();
}

const labourerRoleFamily = new Set([
  "labour",
  "labourer",
  "general labourer",
  "skilled labourer",
  "site labourer",
  "construction labourer",
  "general labour",
  "skilled labour",
]);

const relatedConstructionRoles = [
  "operative",
  "groundworker",
  "traffic marshal",
  "banksman",
  "general builder",
  "multi trader",
  "site operative",
];

function getRoleFamily(value?: string | null) {
  const normalized = normalizeRole(value);
  if (!normalized) return null;
  if (
    labourerRoleFamily.has(normalized) ||
    normalized.includes("labourer") ||
    normalized.includes("labour operative") ||
    normalized === "labour"
  ) {
    return "labourer";
  }
  return normalized;
}

function tokenizeRole(value?: string | null) {
  return normalizeRole(value)
    .split(" ")
    .filter((token) => token.length > 2 && !["and", "the", "for"].includes(token));
}

function getTradeVariants(value: string) {
  const normalized = normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);

  if (normalized.includes("labour")) {
    variants.add("labourer");
    variants.add("labour");
    variants.add("general labourer");
    variants.add("general labour");
    variants.add("skilled labourer");
    variants.add("skilled labour");
  }

  for (const entry of tradeKeywordMap) {
    if (entry.trade.toLowerCase() === normalized || entry.keywords.some((keyword) => normalized.includes(keyword))) {
      variants.add(entry.trade.toLowerCase());
      entry.keywords.forEach((keyword) => variants.add(keyword));
    }
  }

  return Array.from(variants);
}

function workerTradeTargets(worker: WorkerOverviewRow) {
  return [
    worker.primary_role,
    worker.specialistArea,
    worker.skillTag,
    ...(Array.isArray(worker.skill_tags) ? worker.skill_tags : []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim());
}

function workerMatchesTargetTrade(worker: WorkerOverviewRow, targetTrade: string) {
  const targetVariants = getTradeVariants(targetTrade);
  if (!targetVariants.length) return true;

  const workerTargets = workerTradeTargets(worker);
  if (!workerTargets.length) return false;

  return workerTargets.some((workerTarget) =>
    targetVariants.some((variant) =>
      workerTarget === variant ||
      workerTarget.includes(variant) ||
      variant.includes(workerTarget),
    ),
  );
}

function hasCoordinates(latitude?: number | null, longitude?: number | null) {
  return typeof latitude === "number" && Number.isFinite(latitude) &&
    typeof longitude === "number" && Number.isFinite(longitude);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMiles(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function matchTrade(text: string) {
  const lower = normalizeText(text);
  for (const entry of tradeKeywordMap) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) {
      return entry.trade;
    }
  }
  return "";
}

function extractQuantity(text: string) {
  const match = text.match(/\b(\d+)\s+(?:workers?|people|staff|painters?|electricians?|labourers?|plumbers?|carpenters?)\b/i);
  return match ? Number(match[1]) : 1;
}

function extractDuration(text: string) {
  const match = text.match(/\b(\d+)\s+(day|days|week|weeks|month|months)\b/i);
  return match ? `${match[1]} ${match[2]}` : "";
}

function extractStartDate(text: string) {
  const weekdayMatch = text.match(weekdayPattern);
  if (weekdayMatch) return weekdayMatch[1];

  const startingMatch = text.match(/\bstarting\s+(.+?)(?:\.|,|$)/i);
  return startingMatch ? startingMatch[1].trim() : "";
}

function extractSiteType(text: string) {
  const lower = normalizeText(text);
  return siteTypes.find((type) => lower.includes(type)) ?? "";
}

function extractLocation(text: string) {
  const match = text.match(/\b(?:in|at)\s+([A-Za-z0-9 ,'-]+?)(?:\s+for\s+|\s+starting\s+|$)/i);
  return match ? match[1].trim().replace(/[.,]$/, "") : "";
}

export function parseLaymanJobDescription(input: string): SuggestedJobPost {
  const tradeCategory = matchTrade(input);
  const quantity = extractQuantity(input);
  const siteType = extractSiteType(input);
  const location = extractLocation(input);
  const durationLabel = extractDuration(input);
  const startDate = extractStartDate(input);
  const notes = siteType ? `${siteType[0].toUpperCase()}${siteType.slice(1)} environment noted.` : "";

  return {
    title: [quantity > 1 ? `${quantity}` : "", tradeCategory, location ? `in ${location}` : ""]
      .filter(Boolean)
      .join(" ")
      .trim(),
    tradeCategory,
    quantity,
    location,
    startDate,
    durationLabel,
    notes,
    siteType,
  };
}

export function suggestStructuredJobPost(parsedInput: SuggestedJobPost): SuggestedJobPost {
  const trade = parsedInput.tradeCategory || "General workforce";
  const quantity = parsedInput.quantity ?? 1;

  return {
    ...parsedInput,
    title:
      parsedInput.title ||
      `${quantity} ${trade}${parsedInput.location ? ` needed in ${parsedInput.location}` : ""}`,
    notes:
      parsedInput.notes ||
      [
        parsedInput.siteType ? `${parsedInput.siteType} environment` : "",
        parsedInput.durationLabel ? `Duration: ${parsedInput.durationLabel}` : "",
        parsedInput.startDate ? `Start: ${parsedInput.startDate}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
  };
}

function buildHistoryInput(jobs: JobProviderJobHistoryRow[]): HiringHistoryInput {
  return {
    recentRoles: jobs.map((job) => job.trade_type ?? "").filter(Boolean),
    recentAreas: jobs.map((job) => job.area ?? job.postcode).filter(Boolean),
    repeatWorkerNames: [],
  };
}

function getLocationFitBand(worker: WorkerOverviewRow, location: string) {
  if (!location) return "unknown";
  const lower = normalizeText(location);
  const locationDisplay = normalizeText(worker.location_display ?? "");
  const town = normalizeText(worker.town ?? "");
  const postcode = normalizeText(worker.postcode);

  if (locationDisplay.includes(lower) || town.includes(lower)) {
    return "local";
  }

  if (postcode && lower.includes(postcode.slice(0, 3))) {
    return "nearby";
  }

  return "wider";
}

function locationMatchLabel(worker: WorkerOverviewRow, location: string) {
  const fitBand = getLocationFitBand(worker, location);

  if (fitBand === "unknown") return "Distance from map pin unavailable";
  if (fitBand === "local") return "Distance from map pin unavailable";
  if (fitBand === "nearby") return "Distance from map pin unavailable";
  return "Distance from map pin unavailable";
}

function getDistanceLabel(worker: WorkerOverviewRow, jobInput: SuggestedJobPost) {
  if (
    hasCoordinates(jobInput.locationLatitude, jobInput.locationLongitude) &&
    hasCoordinates(worker.latitude, worker.longitude)
  ) {
    const miles = getDistanceMiles(
      {
        latitude: jobInput.locationLatitude as number,
        longitude: jobInput.locationLongitude as number,
      },
      {
        latitude: worker.latitude as number,
        longitude: worker.longitude as number,
      },
    );

    if (Number.isFinite(miles)) {
      return `${miles.toFixed(miles < 10 ? 1 : 0)} miles away`;
    }
  }

  return locationMatchLabel(worker, jobInput.location ?? "");
}

function locationScore(worker: WorkerOverviewRow, jobInput: SuggestedJobPost) {
  if (
    hasCoordinates(jobInput.locationLatitude, jobInput.locationLongitude) &&
    hasCoordinates(worker.latitude, worker.longitude)
  ) {
    const miles = getDistanceMiles(
      {
        latitude: jobInput.locationLatitude as number,
        longitude: jobInput.locationLongitude as number,
      },
      {
        latitude: worker.latitude as number,
        longitude: worker.longitude as number,
      },
    );

    if (miles <= 5) return 10;
    if (miles <= 10) return 8;
    if (miles <= 20) return 6;
    if (miles <= 35) return 4;
    return 2;
  }

  const fitBand = getLocationFitBand(worker, jobInput.location ?? "");
  if (fitBand === "local") return 8;
  if (fitBand === "nearby") return 6;
  if ((jobInput.location ?? "").toLowerCase().includes("london") && worker.postcode.toUpperCase().startsWith("N")) {
    return 6;
  }
  return jobInput.location ? 4 : 5;
}

function getTargetRole(jobInput: SuggestedJobPost) {
  return [
    jobInput.coreRole,
    jobInput.selectedRole,
    jobInput.requiredRole,
    jobInput.trade,
    jobInput.tradeCategory,
    jobInput.title,
  ].find((value) => Boolean(value?.trim())) ?? "";
}

function calculateRoleScore(worker: WorkerOverviewRow, targetRole: string) {
  const normalizedTarget = normalizeRole(targetRole);
  const targetFamily = getRoleFamily(normalizedTarget);
  const workerTargets = workerTradeTargets(worker);
  const workerFamilies = workerTargets.map((value) => getRoleFamily(value));
  const targetTokens = new Set(tokenizeRole(normalizedTarget));
  const reasons: string[] = [];

  if (!normalizedTarget) {
    return { score: 30, reasons: ["Role requirement not specific"], gaps: [] as string[] };
  }

  if (workerTargets.some((value) => value === normalizedTarget)) {
    reasons.push(`Exact ${normalizedTarget} role match`);
    return { score: 45, reasons, gaps: [] as string[] };
  }

  if (targetFamily && workerFamilies.includes(targetFamily)) {
    reasons.push(targetFamily === "labourer" ? "Strong labourer role match" : "Strong role family match");
    return { score: 40, reasons, gaps: [] as string[] };
  }

  if (
    targetFamily === "labourer" &&
    workerTargets.some((value) => relatedConstructionRoles.some((role) => value.includes(role)))
  ) {
    reasons.push("Related construction role");
    return { score: 25, reasons, gaps: [] as string[] };
  }

  if (
    workerTargets.some((value) => tokenizeRole(value).some((token) => targetTokens.has(token)))
  ) {
    reasons.push("Partial role keyword match");
    return { score: 10, reasons, gaps: [] as string[] };
  }

  return { score: 0, reasons: [], gaps: [`Role is not a clear ${targetRole} match`] };
}

function calculateSkillsScore(worker: WorkerOverviewRow, jobInput: SuggestedJobPost, roleScore: number) {
  const requirements = [...(jobInput.skillsRequired ?? []), ...(jobInput.requirements ?? [])]
    .map((value) => normalizeRole(value))
    .filter(Boolean)
    .filter((value) => !/(dbs|ppe|tools?|ipaf|cscs)/i.test(value));
  const workerSkills = [
    worker.primary_role,
    worker.specialistArea,
    worker.skillTag,
    ...(Array.isArray(worker.skill_tags) ? worker.skill_tags : []),
  ].map((value) => normalizeRole(value)).filter(Boolean);

  if (!requirements.length) {
    return { score: 12, reasons: ["No specialist skill restriction"], gaps: [] as string[] };
  }

  const hasBasicOnly = requirements.every((item) => ["basic", "general", "standard"].includes(item));
  if (hasBasicOnly && roleScore >= 40) {
    return { score: 15, reasons: ["Basic skill requirement matched"], gaps: [] as string[] };
  }

  const matches = requirements.filter((requirement) =>
    workerSkills.some((skill) => skill.includes(requirement) || requirement.includes(skill)),
  );

  if (matches.length) {
    return {
      score: Math.round(Math.min(15, 8 + (matches.length / requirements.length) * 7)),
      reasons: [`Matched skills: ${matches.join(", ")}`],
      gaps: [] as string[],
    };
  }

  if (roleScore >= 40) {
    return {
      score: 11,
      reasons: ["Role fit covers general skill requirement"],
      gaps: requirements.length ? [`Specific skills not recorded: ${requirements.join(", ")}`] : [],
    };
  }

  return { score: 5, reasons: [], gaps: [`Skills not verified: ${requirements.join(", ")}`] };
}

function calculateComplianceScore(worker: WorkerOverviewRow, jobInput: SuggestedJobPost) {
  const gaps: string[] = [];
  const reasons: string[] = [];
  const checks: number[] = [];
  const compliance = worker.credentialsCompliance;

  if (jobInput.enhancedDbsRequired || /enhanced/i.test(jobInput.dbsRequirement ?? "")) {
    if (compliance.enhancedDbs) {
      checks.push(1);
      reasons.push("Enhanced DBS verified");
    } else {
      checks.push(0.35);
      gaps.push("Enhanced DBS not yet verified");
    }
  } else if (jobInput.dbsRequired || /dbs/i.test(jobInput.dbsRequirement ?? "")) {
    if (compliance.enhancedDbs) {
      checks.push(1);
      reasons.push("DBS coverage recorded");
    } else {
      checks.push(0.55);
      gaps.push("DBS status not verified");
    }
  }

  if (jobInput.ppeRequired) {
    if (worker.credentialsSummary.some((item) => /ppe/i.test(item)) || worker.skill_tags.some((item) => /ppe/i.test(item))) {
      checks.push(1);
      reasons.push("PPE status recorded");
    } else {
      checks.push(0.6);
      gaps.push("PPE status not recorded");
    }
  }

  if (jobInput.ownToolsRequired) {
    if (
      worker.credentialsSummary.some((item) => /tools?/i.test(item)) ||
      worker.skill_tags.some((item) => /tools?/i.test(item))
    ) {
      checks.push(1);
      reasons.push("Own tools recorded");
    } else {
      checks.push(0.6);
      gaps.push("Own tools not recorded");
    }
  }

  if (jobInput.cscsRequired) {
    if (compliance.cscsVerified || worker.cscs_uploaded) {
      checks.push(1);
      reasons.push("CSCS verified");
    } else {
      checks.push(0.4);
      gaps.push("CSCS not verified");
    }
  }

  if (!checks.length) {
    return { score: 13, reasons: ["No hard compliance gaps recorded"], gaps };
  }

  return {
    score: Math.round((checks.reduce((total, value) => total + value, 0) / checks.length) * 15),
    reasons,
    gaps,
  };
}

function calculateAvailabilityScore(worker: WorkerOverviewRow) {
  if (worker.available_today) return { score: 10, reasons: ["Available today"], gaps: [] as string[] };
  if (/available|active|ready/i.test(worker.status)) {
    return { score: 7, reasons: ["Active worker"], gaps: [] as string[] };
  }
  if (/committed|busy/i.test(worker.status)) {
    return { score: 4, reasons: [], gaps: ["Currently project committed"] };
  }
  return { score: 5, reasons: [], gaps: ["Availability not confirmed"] };
}

function calculatePerformanceScore(worker: WorkerOverviewRow) {
  const siteScore = Math.max(0, worker.stathub.overallScore ?? 0);
  const reliability = Math.max(0, worker.stathub.reliabilityScore ?? 0);
  const bookings = Math.min(worker.stathub.verifiedBookingsCount, 5);
  const score = Math.round(Math.min(5, siteScore * 0.45 + reliability * 0.35 + bookings * 0.4));
  return {
    score,
    reasons: worker.stathub.verifiedBookingsCount > 0 ? [`Verified completed jobs: ${worker.statHubMeta.verifiedCompletedJobsCount}`] : [],
    gaps: [] as string[],
  };
}

export function getRecommendedWorkersForJob(
  jobInput: SuggestedJobPost,
  jobs: JobProviderJobHistoryRow[],
  workforceData: WorkerOverviewRow[],
) {
  const history = buildHistoryInput(jobs);
  const targetTrade = getTargetRole(jobInput);
  const ranked = workforceData
    .filter((worker) => {
      return workerMatchesTargetTrade(worker, targetTrade);
    })
    .map((worker) => {
      const role = normalizeText(worker.primary_role ?? "");
      const historyTradeMatch = history.recentRoles.some((recentRole) => normalizeText(recentRole).includes(role));
      const roleFit = calculateRoleScore(worker, targetTrade);
      const skillsFit = calculateSkillsScore(worker, jobInput, roleFit.score);
      const complianceFit = calculateComplianceScore(worker, jobInput);
      const locality = locationScore(worker, jobInput);
      const availabilityFit = calculateAvailabilityScore(worker);
      const performanceFit = calculatePerformanceScore(worker);
      const historyBoost = historyTradeMatch ? 2 : 0;
      const locationReason =
        locality >= 8 ? "Strong location match" :
        locality >= 6 ? "Same London region" :
        locality >= 4 ? "Location partially matched" :
        "Distance/location needs review";
      const reasons = [
        ...roleFit.reasons,
        ...skillsFit.reasons,
        ...complianceFit.reasons,
        locationReason,
        ...availabilityFit.reasons,
        ...performanceFit.reasons,
        historyTradeMatch ? "Matches recent hiring pattern" : null,
      ].filter((value): value is string => Boolean(value));
      const gaps = [
        ...roleFit.gaps,
        ...skillsFit.gaps,
        ...complianceFit.gaps,
        ...availabilityFit.gaps,
        locality <= 2 ? "Location is outside the preferred area" : null,
      ].filter((value): value is string => Boolean(value));

      const matchStrength = Math.round(
        Math.min(
          100,
          roleFit.score +
            skillsFit.score +
            complianceFit.score +
            locality +
            availabilityFit.score +
            performanceFit.score +
            historyBoost,
        ),
      );

      return {
        worker,
        recommendation: {
          workerId: worker.worker_id,
          distanceLabel: getDistanceLabel(worker, jobInput),
          matchStrength,
          roleScore: roleFit.score,
          skillsScore: skillsFit.score,
          complianceScore: complianceFit.score,
          locationScore: locality,
          availabilityScore: availabilityFit.score,
          performanceScore: performanceFit.score,
          reasons,
          gaps,
          scoreReason: [
            ...reasons.slice(0, 3),
            gaps.length ? `Gaps: ${gaps.slice(0, 2).join("; ")}` : null,
            worker.avgResponseTimeLabel
              ? `Avg Response Time: ${worker.avgResponseTimeLabel}`
              : "Response time not yet recorded",
            `Site Score Status: ${getSiteScoreStatusLabel(worker.stathub.status)}`,
          ].filter(Boolean).join(", "),
        } satisfies WorkerRecommendation,
      };
    });

  return ranked.sort((left, right) => right.recommendation.matchStrength - left.recommendation.matchStrength);
}

export function buildHiringPatternInsights(
  userHistoryJobs: JobProviderJobHistoryRow[],
  workforceData: WorkerOverviewRow[],
  jobInput: SuggestedJobPost,
) {
  const history = buildHistoryInput(userHistoryJobs);
  const recommendations = getRecommendedWorkersForJob(jobInput, userHistoryJobs, workforceData).slice(0, 3);
  const insights: HiringPatternInsight[] = [];

  if (jobInput.location) {
    insights.push({
      title: "Distance Pattern",
      description: `Best current matches cluster around ${getProviderFacingLocationText(jobInput.location)} using location fit and outward postcode proximity.`,
      type: "distance",
    });
  }

  if (history.recentRoles.length > 0 && jobInput.tradeCategory) {
    insights.push({
      title: "Repeat Hiring Pattern",
      description: `Recent hiring history leans toward ${history.recentRoles[0]}. The assistant is weighting similar trade selections.`,
      type: "repeat_booking",
    });
  }

  if ((recommendations[0]?.worker.stathub.overallScore ?? 0) > 0) {
    insights.push({
      title: "Score Match",
      description: `${getProviderFacingDisplayName(recommendations[0].worker)} leads the shortlist on combined Site Score maturity, reliability, and verified completed platform jobs.`,
      type: "score_match",
    });
  }

  if (recommendations.some((item) => item.worker.avgResponseTimeLabel)) {
    insights.push({
      title: "Response Time",
      description: "Average response time is being surfaced to help you judge likely engagement speed without exposing direct contact details.",
      type: "availability",
    });
  }

  if (recommendations.some((item) => item.worker.portfolio.length > 0 || item.worker.credentialsSummary.length > 0)) {
    insights.push({
      title: "Tender Pack Strength",
      description: "Portfolio evidence, credentials, and feedback highlights are boosting candidates with stronger Tender Confidence Packs.",
      type: "portfolio_strength",
    });
  }

  return insights;
}
