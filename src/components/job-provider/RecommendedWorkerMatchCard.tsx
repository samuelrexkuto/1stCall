"use client";

import type { ReactNode } from "react";
import styles from "./AIHiringAssistant.module.css";

export interface RecommendedWorkerMatchCardData {
  workerId: string;
  displayName: string;
  subtitle: string;
  primaryRole: string;
  locationLabel: string;
  imageUrl: string;
  avatarUrl: string;
  matchStrength: number;
  distanceLabel?: string | null;
  recommendationSummary: string;
  reasons?: string[];
  gaps?: string[];
  scoreBreakdown?: {
    role?: number;
    skills?: number;
    compliance?: number;
    location?: number;
    availability?: number;
    performance?: number;
  };
  groupingDetailLabel: string;
  groupingDetailValue: string;
  siteScoreStatus: string;
  verifiedCompletedJobsCount: number;
}

export function RecommendedWorkerMatchCard({
  match,
  actions,
}: {
  match: RecommendedWorkerMatchCardData;
  actions?: ReactNode;
}) {
  const safeFallbackLabel = match.displayName.slice(0, 24).replace(/[<>&"]/g, "");
  const fallbackImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#e2e8f0"/><text x="72" y="710" fill="#0f172a" font-size="48" font-family="Arial" font-weight="700">${safeFallbackLabel}</text></svg>`,
  )}`;
  const imageUrl = match.imageUrl || fallbackImage;
  const avatarUrl = match.avatarUrl || imageUrl;

  return (
    <article className={styles.matchCard}>
      <div className={styles.matchImageWrap}>
        <img src={imageUrl} alt={match.displayName} loading="lazy" className={styles.matchImage} />
        <span className={styles.matchBadge}>{match.subtitle}</span>
        <span className={styles.matchAvatar}>
          <img src={avatarUrl} alt="" loading="lazy" />
        </span>
      </div>

      <div className={styles.matchBody}>
        <div className={styles.matchTop}>
          <div>
            <div className={styles.matchEyebrow}>{match.subtitle}</div>
            <h4 className={styles.matchName}>{match.displayName}</h4>
            <div className={styles.matchMeta}>
              {match.primaryRole} | {match.locationLabel}
            </div>
          </div>
          <div className={styles.matchScore}>
            <strong>{match.matchStrength}% match</strong>
            {match.distanceLabel ? <div className={styles.matchDistance}>{match.distanceLabel}</div> : null}
          </div>
        </div>

        <p className={styles.matchSummary}>{match.recommendationSummary}</p>

        {match.reasons?.length || match.gaps?.length ? (
          <div style={{ display: "grid", gap: "0.4rem", marginBottom: "0.75rem" }}>
            {match.reasons?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {match.reasons.slice(0, 4).map((reason) => (
                  <span key={reason} style={{ borderRadius: 999, background: "#ecfdf5", color: "#047857", padding: "0.2rem 0.5rem", fontSize: 12, fontWeight: 700 }}>
                    {reason}
                  </span>
                ))}
              </div>
            ) : null}
            {match.gaps?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {match.gaps.slice(0, 3).map((gap) => (
                  <span key={gap} style={{ borderRadius: 999, background: "#fff7ed", color: "#c2410c", padding: "0.2rem 0.5rem", fontSize: 12, fontWeight: 700 }}>
                    {gap}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.matchStats}>
          {match.scoreBreakdown ? (
            <div>
              <span className={styles.matchStatLabel}>Role / compliance</span>
              <span className={styles.matchStatValue}>
                {match.scoreBreakdown.role ?? "-"} / {match.scoreBreakdown.compliance ?? "-"}
              </span>
            </div>
          ) : null}
          <div>
            <span className={styles.matchStatLabel}>{match.groupingDetailLabel}</span>
            <span className={styles.matchStatValue}>{match.groupingDetailValue}</span>
          </div>
          <div>
            <span className={styles.matchStatLabel}>Location</span>
            <span className={styles.matchStatValue}>{match.locationLabel}</span>
          </div>
          <div>
            <span className={styles.matchStatLabel}>Site Score Status</span>
            <span className={styles.matchStatValue}>{match.siteScoreStatus}</span>
          </div>
          <div>
            <span className={styles.matchStatLabel}>Verified completed jobs</span>
            <span className={styles.matchStatValue}>{match.verifiedCompletedJobsCount}</span>
          </div>
        </div>

        {actions ? <div className={styles.matchActions}>{actions}</div> : null}
      </div>
    </article>
  );
}
