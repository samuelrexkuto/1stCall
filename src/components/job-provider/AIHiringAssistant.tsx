"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { RecommendedWorkerMatchCard } from "@/components/job-provider/RecommendedWorkerMatchCard";
import { WorkerProfileModal } from "@/components/workers/WorkerProfileModal";
import type { StructuredJobIntake } from "@/lib/job-intake/schema";
import type { ResolvedLocationPayload } from "@/lib/location";
import { saveWorker } from "@/lib/saved-workers";
import {
  getProviderFacingDisplayName,
  getProviderFacingLocationLabel,
  getSiteScoreStatusLabel,
} from "@/lib/provider-access";
import {
  readWorkforceDispatchAIState,
  WORKFORCE_DISPATCH_AI_UPDATED_EVENT,
} from "@/lib/workforce-dispatch-ai-state";
import {
  getRecommendedWorkersForJob,
  parseLaymanJobDescription,
  suggestStructuredJobPost,
  type JobProviderJobHistoryRow,
} from "@/lib/job-provider-ai";
import {
  getSafeWorkerSubtitle,
  getWorkerCardImage,
  getWorkerDisplayGrouping,
  getWorkerProfileImage,
} from "@/lib/worker-display";
import type { WorkerOverviewRow } from "@/lib/workers/types";
import styles from "./AIHiringAssistant.module.css";

export function AIHiringAssistant({
  workers,
  recentJobs,
  title = "AI Hiring Assistant",
  description = "Turn a plain-English request into a structured job post and shortlist recommendations.",
  initialInput = "",
  hideJobRequestInput = false,
}: {
  workers: WorkerOverviewRow[];
  recentJobs: JobProviderJobHistoryRow[];
  title?: string;
  description?: string;
  initialInput?: string;
  hideJobRequestInput?: boolean;
}) {
  const { user } = useAuthSession();
  const [input, setInput] = useState(initialInput);
  const [structuredResult, setStructuredResult] = useState<StructuredJobIntake | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocationPayload | null>(null);
  const [activeWorker, setActiveWorker] = useState<WorkerOverviewRow | null>(null);
  const [feedback, setFeedback] = useState("");
  const [profileInitialTab, setProfileInitialTab] = useState<"Site Score presented by StatHub" | "Tender Confidence Pack">("Site Score presented by StatHub");
  const providerId = user?.providerId ?? "job-provider-local";
  const isJobProvider = user?.role === "job_provider";
  const showHeader = Boolean(title || description);

  useEffect(() => {
    if (!hideJobRequestInput) return;

    function syncFromDispatchAI() {
      const state = readWorkforceDispatchAIState();
      setInput(state?.promptText ?? "");
      setStructuredResult(state?.structuredJob ?? null);
      setResolvedLocation(state?.resolvedLocation ?? null);
    }

    window.addEventListener(WORKFORCE_DISPATCH_AI_UPDATED_EVENT, syncFromDispatchAI);
    return () => window.removeEventListener(WORKFORCE_DISPATCH_AI_UPDATED_EVENT, syncFromDispatchAI);
  }, [hideJobRequestInput]);

  const suggestion = useMemo(() => {
    const parsed = suggestStructuredJobPost(parseLaymanJobDescription(input));
    return {
      ...parsed,
      location:
        structuredResult?.location ??
        resolvedLocation?.location_display ??
        resolvedLocation?.formatted_address ??
        parsed.location,
      locationLatitude: resolvedLocation?.latitude ?? null,
      locationLongitude: resolvedLocation?.longitude ?? null,
    };
  }, [input, resolvedLocation, structuredResult?.location]);
  const latestJobSuggestion = useMemo(() => {
    const latestJob = recentJobs[0];
    if (!latestJob) return null;

    const location = latestJob.area ?? latestJob.postcode;
    return suggestStructuredJobPost({
      title: latestJob.job_title,
      tradeCategory: latestJob.trade_type ?? undefined,
      location,
    });
  }, [recentJobs]);
  const hasGeneratedResults = hideJobRequestInput ? Boolean(input.trim() || structuredResult) : Boolean(input.trim());
  const fallbackToLatestJob = hideJobRequestInput && !hasGeneratedResults && Boolean(latestJobSuggestion);
  const recommendationInput = fallbackToLatestJob && latestJobSuggestion ? latestJobSuggestion : suggestion;
  const hasResults = hasGeneratedResults || fallbackToLatestJob;
  const recommendations = useMemo(
    () => (hasResults ? getRecommendedWorkersForJob(recommendationInput, recentJobs, workers).slice(0, 4) : []),
    [hasResults, recommendationInput, recentJobs, workers],
  );
  const recommendationsTitle = fallbackToLatestJob
    ? "Last recommended matches"
    : "Recommended matches";
  const mobileRecommendationRows = useMemo(
    () => ({
      top: recommendations.filter((_, index) => index % 2 === 0),
      bottom: recommendations.filter((_, index) => index % 2 !== 0),
    }),
    [recommendations],
  );

  return (
    <>
      <section className={styles.assistantResults}>
        {showHeader ? (
          <div className={styles.assistantHeader}>
            {title ? <h2 className={styles.assistantTitle}>{title}</h2> : null}
            {description ? <p className={styles.assistantDescription}>{description}</p> : null}
          </div>
        ) : null}

        {hideJobRequestInput ? null : (
          <label style={{ display: "grid", gap: "0.45rem" }}>
            Job request
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="I need 2 painters for a school in Croydon for 5 days starting Monday."
              style={{ minHeight: 120, resize: "vertical" }}
            />
          </label>
        )}

        {feedback ? <p style={{ margin: 0, color: "#166534" }}>{feedback}</p> : null}

        {!hasResults && !hideJobRequestInput ? (
          <section className={styles.emptyState}>
            Generate a Workforce Dispatch AI brief above to see the worker alert simulator, hiring insights, and recommended matches.
          </section>
        ) : null}

        {hasResults && recommendations.length > 0 ? (
          <div className={styles.recommendedPanel}>
            <div className={styles.recommendedSection}>
              <h3 className={styles.recommendedTitle}>{recommendationsTitle}</h3>
                <div className={styles.mobileMatchCarousel}>
                  <div className={styles.mobileMatchRow} aria-label={`${recommendationsTitle} row 1`}>
                    {mobileRecommendationRows.top.map(({ worker, recommendation }) => {
                      const displayName = isJobProvider ? getProviderFacingDisplayName(worker) : worker.full_name;
                      const locationLabel = isJobProvider
                        ? getProviderFacingLocationLabel(worker)
                        : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`;
                      const imageUrl = getWorkerCardImage(worker);
                      const grouping = getWorkerDisplayGrouping(worker);

                      return (
                        <button
                          key={`mobile-${worker.worker_id}`}
                          type="button"
                          className={styles.mobileMatchCard}
                          onClick={() => {
                            setProfileInitialTab("Site Score presented by StatHub");
                            setActiveWorker(worker);
                          }}
                        >
                          <img src={imageUrl} alt={displayName} className={styles.mobileMatchImage} loading="lazy" />
                          <span className={styles.mobileMatchBody}>
                            <span className={styles.mobileMatchName}>{displayName}</span>
                            <span className={styles.mobileMatchMeta}>{grouping.detailValue}</span>
                            <span className={styles.mobileMatchMeta}>{locationLabel}</span>
                            <span className={styles.mobileMatchTag}>{recommendation.matchStrength}% match</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {mobileRecommendationRows.bottom.length > 0 ? (
                    <div className={styles.mobileMatchRow} aria-label={`${recommendationsTitle} row 2`}>
                      {mobileRecommendationRows.bottom.map(({ worker, recommendation }) => {
                        const displayName = isJobProvider ? getProviderFacingDisplayName(worker) : worker.full_name;
                        const locationLabel = isJobProvider
                          ? getProviderFacingLocationLabel(worker)
                          : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`;
                        const imageUrl = getWorkerCardImage(worker);
                        const grouping = getWorkerDisplayGrouping(worker);

                        return (
                          <button
                            key={`mobile-${worker.worker_id}`}
                            type="button"
                            className={styles.mobileMatchCard}
                            onClick={() => {
                              setProfileInitialTab("Site Score presented by StatHub");
                              setActiveWorker(worker);
                            }}
                          >
                            <img src={imageUrl} alt={displayName} className={styles.mobileMatchImage} loading="lazy" />
                            <span className={styles.mobileMatchBody}>
                              <span className={styles.mobileMatchName}>{displayName}</span>
                              <span className={styles.mobileMatchMeta}>{grouping.detailValue}</span>
                              <span className={styles.mobileMatchMeta}>{locationLabel}</span>
                              <span className={styles.mobileMatchTag}>{recommendation.matchStrength}% match</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className={styles.matchList}>
                  {recommendations.map(({ worker, recommendation }) => {
              const displayName = isJobProvider ? getProviderFacingDisplayName(worker) : worker.full_name;
              const locationLabel = isJobProvider
                ? getProviderFacingLocationLabel(worker)
                : worker.location_display ?? `${worker.town ?? "-"} / ${worker.postcode}`;
              const imageUrl = getWorkerCardImage(worker);
              const avatarUrl = getWorkerProfileImage(worker);
              const subtitle = getSafeWorkerSubtitle(worker);
              const grouping = getWorkerDisplayGrouping(worker);
              const scoreStatus = getSiteScoreStatusLabel(worker.stathub.status);
              const responseTime = worker.avgResponseTimeLabel
                ? `Avg Response Time: ${worker.avgResponseTimeLabel}`
                : "Response time not yet recorded";
              const recommendationSummary = [
                recommendation.scoreReason,
                worker.stathub.status === "insufficient"
                  ? `Evidence is still building before a mature public score is released.`
                  : "",
                responseTime,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <RecommendedWorkerMatchCard
                  key={worker.worker_id}
                  match={{
                    workerId: worker.worker_id,
                    displayName,
                    subtitle,
                    primaryRole: worker.primary_role ?? "General workforce",
                    locationLabel,
                    imageUrl,
                    avatarUrl,
                    matchStrength: recommendation.matchStrength,
                    distanceLabel: recommendation.distanceLabel,
                    recommendationSummary,
                    reasons: recommendation.reasons,
                    gaps: recommendation.gaps,
                    scoreBreakdown: {
                      role: recommendation.roleScore,
                      skills: recommendation.skillsScore,
                      compliance: recommendation.complianceScore,
                      location: recommendation.locationScore,
                      availability: recommendation.availabilityScore,
                      performance: recommendation.performanceScore,
                    },
                    groupingDetailLabel: grouping.detailLabel,
                    groupingDetailValue: grouping.detailValue,
                    siteScoreStatus: scoreStatus,
                    verifiedCompletedJobsCount: worker.statHubMeta.verifiedCompletedJobsCount,
                  }}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileInitialTab("Site Score presented by StatHub");
                          setActiveWorker(worker);
                        }}
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileInitialTab("Tender Confidence Pack");
                          setActiveWorker(worker);
                        }}
                      >
                        Open Tender Confidence Pack
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          saveWorker(worker, providerId);
                          setFeedback(`${displayName} saved to the shortlist.`);
                        }}
                      >
                        Save Worker
                      </button>
                    </>
                  }
                />
              );
                  })}
                </div>
            </div>
          </div>
        ) : null}
      </section>

      <WorkerProfileModal
        open={Boolean(activeWorker)}
        worker={activeWorker}
        onClose={() => setActiveWorker(null)}
        mode="job_provider"
        initialTab={profileInitialTab}
      />
    </>
  );
}
