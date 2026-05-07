"use client";

import { getProviderFacingLocationLabel, getSiteScoreStatusLabel } from "@/lib/provider-access";
import {
  getSafeWorkerDisplayName,
  getWorkerDisplayGrouping,
  getWorkerCardImage,
  getWorkerProfileImage,
} from "@/lib/worker-display";
import type { AppUserRole } from "@/lib/auth/types";
import type { WorkerOverviewRow } from "@/lib/workers/types";
import styles from "../HomeMap.module.css";

export function OperationalMapWorkerCard({
  worker,
  role,
  selected,
  onSelect,
  onHover,
  onLeave,
}: {
  worker: WorkerOverviewRow;
  role: AppUserRole | null | undefined;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const imageUrl = getWorkerCardImage(worker);
  const profileImageUrl = getWorkerProfileImage(worker);
  const displayName = getSafeWorkerDisplayName(worker, role);
  const grouping = getWorkerDisplayGrouping(worker);
  const subtitle = grouping.detailValue;
  const siteScoreStatus = getSiteScoreStatusLabel(worker.stathub.status);
  const locationLabel = getProviderFacingLocationLabel(worker);
  const completedJobs =
    worker.statHubMeta.verifiedCompletedJobsCount ?? worker.completed_jobs_count ?? 0;

  return (
    <article
      className={`${styles.workerCard} ${selected ? styles.workerCardActive : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
    >
      <div className={styles.workerCardImageWrap}>
        <img
          src={imageUrl}
          alt={displayName}
          loading="lazy"
          className={styles.workerCardImage}
        />
        <div className={styles.workerCardAvatar}>
          <img src={profileImageUrl} alt="" className={styles.workerCardAvatarImage} />
        </div>
        <div className={styles.workerCardTopMeta}>
          <span className={styles.workerCardBadge}>{grouping.typeLabel}</span>
        </div>
      </div>

      <div className={styles.workerCardBody}>
        <div className={styles.workerCardHeading}>
          <div className={styles.workerCardEyebrow}>{subtitle}</div>
          <h3 className={styles.workerCardTitle}>{displayName}</h3>
        </div>

        <div className={styles.workerCardDetails}>
          <div className={styles.workerCardDetailItem}>
            <span className={styles.workerCardDetailLabel}>{grouping.detailLabel}</span>
            <span className={styles.workerCardDetailValue}>{grouping.detailValue}</span>
          </div>
          <div className={styles.workerCardDetailItem}>
            <span className={styles.workerCardDetailLabel}>Location</span>
            <span className={styles.workerCardDetailValue}>{locationLabel || "Area withheld"}</span>
          </div>
        </div>

        <div className={styles.workerCardStats}>
          <div className={styles.workerCardStat}>
            <span className={styles.workerCardStatLabel}>Site Score</span>
            <span className={styles.workerCardStatValue}>{siteScoreStatus}</span>
          </div>
          <div className={styles.workerCardStat}>
            <span className={styles.workerCardStatLabel}>Completed jobs</span>
            <span className={styles.workerCardStatValue}>{completedJobs}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
