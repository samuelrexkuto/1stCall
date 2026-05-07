export function formatLocation(area?: string | null, postcode?: string | null) {
  const cleanArea = String(area || "").trim();
  const cleanPostcode = String(postcode || "").trim();

  if (!cleanArea && !cleanPostcode) return "Not provided";
  if (cleanArea && cleanPostcode && cleanArea.toLowerCase().includes(cleanPostcode.toLowerCase())) {
    return cleanArea;
  }

  return [cleanArea, cleanPostcode].filter(Boolean).join(" ");
}

export function normaliseRequestedWorker(worker: any, index = 0) {
  const area = worker?.area || worker?.location || worker?.location_display || worker?.town || "";
  const postcode = worker?.postcode || "";

  return {
    id: worker?.id || worker?.worker_id || worker?.workerId,
    workerId: worker?.workerId || worker?.worker_id || worker?.id,
    name:
      worker?.name ||
      worker?.full_name ||
      worker?.display_name ||
      worker?.worker_name ||
      "Unnamed worker",
    primaryRole:
      worker?.primaryRole ||
      worker?.primary_role ||
      worker?.role ||
      worker?.trade ||
      "Not provided",
    workforceType:
      worker?.workforceType ||
      worker?.workforce_type ||
      worker?.contractor_speciality ||
      worker?.primary_role ||
      worker?.role ||
      worker?.trade ||
      "Tradesman",
    area: area || null,
    postcode: postcode || null,
    locationLabel: formatLocation(area, postcode),
    matchPercentage:
      worker?.matchPercentage ||
      worker?.match_percentage ||
      worker?.matchScore ||
      worker?.match_score ||
      worker?.match_strength ||
      null,
    requestedRank:
      worker?.requestedRank ||
      worker?.requested_rank ||
      index + 1,
    requestedByClient:
      worker?.requestedByClient ??
      worker?.requested_by_client ??
      worker?.isClientRequested ??
      worker?.is_client_requested ??
      true,
    requestedAt:
      worker?.requestedAt ||
      worker?.requested_by_client_at ||
      worker?.created_at ||
      null,
    dispatchStatus:
      worker?.dispatchStatus ||
      worker?.dispatch_status ||
      worker?.assignment_status ||
      "requested",
    dispatch_status:
      worker?.dispatch_status ||
      worker?.dispatchStatus ||
      worker?.assignment_status ||
      "requested",
    confirmedForJob: Boolean(worker?.confirmedForJob ?? worker?.confirmed_for_job ?? false),
    confirmed_for_job: Boolean(worker?.confirmed_for_job ?? worker?.confirmedForJob ?? false),
    confirmedAt: worker?.confirmedAt || worker?.confirmed_at || null,
    confirmed_at: worker?.confirmed_at || worker?.confirmedAt || null,
    releasedToClient: Boolean(worker?.releasedToClient ?? worker?.released_to_client ?? false),
    released_to_client: Boolean(worker?.released_to_client ?? worker?.releasedToClient ?? false),
    releasedToClientAt: worker?.releasedToClientAt || worker?.released_to_client_at || null,
    released_to_client_at: worker?.released_to_client_at || worker?.releasedToClientAt || null,
    status: "Requested by client" as const,
    phone:
      worker?.phone ||
      worker?.mobile ||
      null,
    mobile:
      worker?.mobile ||
      null,
    email:
      worker?.email ||
      null,
    avatarUrl:
      worker?.avatarUrl ||
      worker?.avatar_url ||
      worker?.profile_image_url ||
      null,
    contactDetailsReleased:
      worker?.contactDetailsReleased ??
      worker?.contact_details_released ??
      false,
    canViewContactDetails:
      worker?.canViewContactDetails ??
      worker?.can_view_contact_details ??
      false,
  };
}

export function mergeAndNormaliseRequestedWorkforce(...sources: any[][]) {
  const map = new Map<string, any>();

  sources.flat().filter(Boolean).forEach((worker, index) => {
    const normalised = normaliseRequestedWorker(worker, index);
    const key = normalised.id || normalised.workerId || `${normalised.name}-${normalised.primaryRole}`;

    if (!key) return;

    const existing = map.get(key) || {};

    map.set(key, {
      ...normalised,
      ...existing,
      ...Object.fromEntries(
        Object.entries(normalised).filter(([, value]) => value !== null && value !== undefined && value !== ""),
      ),
      matchPercentage:
        normalised.matchPercentage ||
        existing.matchPercentage ||
        null,
      requestedByClient: true,
      dispatchStatus:
        normalised.dispatchStatus ||
        existing.dispatchStatus ||
        "requested",
      dispatch_status:
        normalised.dispatch_status ||
        existing.dispatch_status ||
        "requested",
      confirmedForJob:
        normalised.confirmedForJob ||
        existing.confirmedForJob ||
        false,
      confirmed_for_job:
        normalised.confirmed_for_job ||
        existing.confirmed_for_job ||
        false,
      confirmedAt:
        normalised.confirmedAt ||
        existing.confirmedAt ||
        null,
      confirmed_at:
        normalised.confirmed_at ||
        existing.confirmed_at ||
        null,
      releasedToClient:
        normalised.releasedToClient ||
        existing.releasedToClient ||
        false,
      released_to_client:
        normalised.released_to_client ||
        existing.released_to_client ||
        false,
      releasedToClientAt:
        normalised.releasedToClientAt ||
        existing.releasedToClientAt ||
        null,
      released_to_client_at:
        normalised.released_to_client_at ||
        existing.released_to_client_at ||
        null,
      contactDetailsReleased:
        normalised.contactDetailsReleased ||
        existing.contactDetailsReleased ||
        false,
      canViewContactDetails:
        normalised.canViewContactDetails ||
        existing.canViewContactDetails ||
        false,
      status: "Requested by client",
    });
  });

  return Array.from(map.values()).sort(
    (a, b) => (a.requestedRank || 999) - (b.requestedRank || 999),
  );
}
