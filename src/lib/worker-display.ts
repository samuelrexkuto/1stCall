import { getProviderFacingDisplayName } from "@/lib/provider-access";
import type { AppUserRole } from "@/lib/auth/types";
import { getPrimaryRole, normaliseWorkforceGrouping } from "@/lib/workforce-grouping";
import type { WorkerOverviewRow } from "@/lib/workers/types";

type WorkerCardLike = Pick<
  WorkerOverviewRow,
  "worker_id" | "full_name" | "workerType" | "contractorType" | "specialistArea" | "skillTag" | "portfolio"
> & {
  portfolio_uploaded?: boolean;
  profileImageUrl?: string | null;
  cardImageUrl?: string | null;
};

function isGenericContractorName(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || normalized === "contractor" || normalized === "contractor contractor";
}

function isGenericContractorValue(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || normalized === "contractor" || normalized === "contractors" || normalized === "specialist";
}

function buildFallbackCardImage(label: string) {
  const safeLabel = encodeURIComponent(label.slice(0, 24) || "RD");
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#dbeafe"/>
          <stop offset="50%" stop-color="#eff6ff"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <circle cx="180" cy="180" r="140" fill="rgba(37,99,235,0.08)"/>
      <circle cx="1060" cy="640" r="180" fill="rgba(15,23,42,0.08)"/>
      <text x="72" y="710" fill="#0f172a" font-size="48" font-family="Arial, sans-serif" font-weight="700">${safeLabel}</text>
    </svg>`,
  )}`;
}

function buildFallbackAvatar(label: string) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "RD";

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#f2f6ff"/>
          <stop offset="100%" stop-color="#dbeafe"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" rx="200" fill="url(#g)"/>
      <circle cx="200" cy="150" r="72" fill="rgba(37,99,235,0.14)"/>
      <path d="M82 334c22-60 68-92 118-92s96 32 118 92" fill="rgba(15,23,42,0.1)"/>
      <text x="200" y="220" text-anchor="middle" fill="#0f172a" font-size="92" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
    </svg>`,
  )}`;
}

export function getWorkerPortfolioImages(worker: WorkerCardLike) {
  const media = worker.portfolio.flatMap((item) =>
    item.mediaUrls.filter((url) => Boolean(url) && !url.startsWith("/portfolio/")),
  );
  if (media.length > 0) {
    return media;
  }

  if (worker.portfolio_uploaded) {
    return [`/portfolio/${worker.worker_id}/1`];
  }

  return [];
}

export function getWorkerCardImage(worker: WorkerCardLike) {
  if (worker.cardImageUrl) {
    return worker.cardImageUrl;
  }

  if (worker.profileImageUrl) {
    return worker.profileImageUrl;
  }

  const [firstImage] = getWorkerPortfolioImages(worker);
  if (firstImage) {
    return firstImage;
  }

  return buildFallbackCardImage(worker.full_name || "Recruited Dispatch");
}

export function getWorkerProfileImage(worker: WorkerCardLike) {
  if (worker.profileImageUrl) {
    return worker.profileImageUrl;
  }

  if (worker.cardImageUrl) {
    return worker.cardImageUrl;
  }

  const [firstImage] = getWorkerPortfolioImages(worker);
  if (firstImage) {
    return firstImage;
  }

  return buildFallbackAvatar(worker.full_name || "Recruited Dispatch");
}

export function getSafeWorkerDisplayName(worker: WorkerCardLike, role: AppUserRole | null | undefined) {
  if (worker.workerType === "contractor" && !isGenericContractorName(worker.full_name)) {
    return worker.full_name.trim();
  }

  if (role === "admin") {
    return worker.full_name;
  }

  return getProviderFacingDisplayName(worker);
}

export function getSafeWorkerSubtitle(worker: WorkerCardLike) {
  if (worker.workerType === "contractor") {
    const specialistArea = worker.specialistArea?.trim();
    if (specialistArea && specialistArea.toLowerCase() !== "contractor") return `${specialistArea} Contractor`;
    if (worker.contractorType === "multi_discipline") return "Contractor";
    if (worker.contractorType === "specialist") return "Specialist Contractor";
    return "Contractor";
  }

  if (worker.skillTag?.trim()) return worker.skillTag.trim();
  return "Tradesman";
}

export function getWorkerDisplayGrouping(worker: WorkerCardLike & { primary_role?: string | null }) {
  const grouping = normaliseWorkforceGrouping(worker);

  if (grouping === "Contractor") {
    return {
      typeLabel: "Contractor",
      detailLabel: "Primary role",
      detailValue:
        worker.contractorType === "multi_discipline"
          ? "Multi-Discipline"
          : !isGenericContractorValue(getPrimaryRole(worker))
            ? getPrimaryRole(worker)
            : "Multi-Discipline",
    };
  }

  return {
    typeLabel: "Tradesman",
    detailLabel: "Primary role",
    detailValue: getPrimaryRole(worker),
  };
}
