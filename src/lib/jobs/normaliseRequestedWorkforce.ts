import {
  mergeAndNormaliseRequestedWorkforce,
  normaliseRequestedWorker,
} from "@/lib/jobs/mergeRequestedWorkforce";

const REQUESTED_DISPATCH_STATUSES = new Set([
  "requested",
  "client_requested",
  "requested_by_client",
  "dispatched",
  "accepted",
  "declined",
  "no_response",
]);

export interface NormalisedRequestedWorkforce {
  id: string;
  workerId?: string;
  assignmentId?: string;
  name: string;
  primaryRole: string;
  workforceType: string;
  area: string | null;
  postcode: string | null;
  locationLabel?: string;
  matchPercentage: number | null;
  phone: string | null;
  mobile?: string | null;
  email: string | null;
  avatarUrl: string | null;
  requestedRank: number | null;
  requestedByClient: boolean;
  requestedAt: string | null;
  dispatchStatus: string | null;
  dispatch_status?: string | null;
  confirmedForJob?: boolean;
  confirmed_for_job?: boolean;
  confirmedAt?: string | null;
  confirmed_at?: string | null;
  releasedToClient?: boolean;
  released_to_client?: boolean;
  releasedToClientAt?: string | null;
  released_to_client_at?: string | null;
  contactDetailsReleased?: boolean;
  canViewContactDetails?: boolean;
  status: "Requested by client";
}

export function normaliseRequestedWorkforce(job: any): NormalisedRequestedWorkforce[] {
  return mergeAndNormaliseRequestedWorkforce(
    ...( [
      job?.requestedWorkforce,
      job?.requested_workforce,
      job?.requestedWorkers,
      job?.requested_workers,
      job?.client_requested_workforce,
    ].filter(Array.isArray) as any[][] )
  ) as NormalisedRequestedWorkforce[];
}

export function normaliseWorkerCard(worker: any, index: number): NormalisedRequestedWorkforce {
  return normaliseRequestedWorker(worker, index) as NormalisedRequestedWorkforce;
}

export function resolveRequestedWorkforce(job: any): NormalisedRequestedWorkforce[] {
  const explicitRequested = [
    job?.requestedWorkforce,
    job?.requestedWorkers,
    job?.requested_workforce,
    job?.requested_workers,
    job?.client_requested_workforce,
  ].filter(Array.isArray).flat();

  const matchingSource = [
    job?.matchingWorkers,
    job?.matching_workers,
    job?.matchedWorkers,
    job?.matched_workers,
    job?.matches,
    job?.contractors,
  ].filter(Array.isArray).flat();
  const requestedFromMatching = matchingSource.filter((worker: any) => {
    const dispatchStatus =
      worker?.dispatchStatus ||
      worker?.dispatch_status ||
      worker?.status ||
      worker?.assignment_status ||
      "";

    return (
      worker?.requestedByClient === true ||
      worker?.requested_by_client === true ||
      worker?.isClientRequested === true ||
      worker?.is_client_requested === true ||
      REQUESTED_DISPATCH_STATUSES.has(dispatchStatus)
    );
  });

  return mergeAndNormaliseRequestedWorkforce(
    explicitRequested,
    requestedFromMatching,
  ) as NormalisedRequestedWorkforce[];
}
