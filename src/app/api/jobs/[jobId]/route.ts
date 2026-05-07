import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import {
  resolveSavedCoordinates,
} from "@/lib/maps/geocode";
import { formatPayRate } from "@/lib/jobs/formatPayRate";
import { loadJobsOverview } from "@/lib/jobs";
import { loadRequestedWorkforceForJob } from "@/lib/jobs/loadRequestedWorkforce";
import { buildJobCompatibilityLocation, buildResolvedLocationPayload, hasValidCoordinates } from "@/lib/location";
import { isSchemaColumnMissing, normalizeJobLocationRecord } from "@/lib/location-records";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  try {
    const supabase = createAdminSupabaseClient();
    const currentUser = await getAppSessionUser();
    const fullSelect =
      "id, provider_id, title, required_role, area, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_resolved, location_precision, latitude, longitude, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, selected_role, trade, location_label, location_confirmed, start_time, end_time, time_window, duration, end_date, pay_rate, pay_rate_amount, pay_rate_unit, duties, dbs_required, dbs_requirement, enhanced_dbs_required, cscs_required, ipaf_required, own_tools_required, tools_required, ppe_required, ppe_detail, skills_required, requirements, shift_pattern, tickets_required, certificates_required, optional_supporting_notes, selected_keywords, payment_type, notes, payment_status, job_status, fill_status, broadcast_status, invoice_status, invoice_send_date, invoice_due_date, invoice_last_sent_at, invoice_notes, platform_backed_job, platform_backed_status, platform_backed_note, platform_backed_approved_by_admin, platform_backed_payment_terms, walk_off_clause_enabled, worker_payment_protected, payment_terms_days, provider_agreed_terms_verified, worker_agreed_terms_verified, created_at";
    const fallbackSelect =
      "id, provider_id, title, required_role, area, postcode, location_display, location_query, location_precision, latitude, longitude, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, duration, end_date, pay_rate, duties, dbs_requirement, ipaf_required, own_tools_required, ppe_required, skills_required, shift_pattern, tickets_required, optional_supporting_notes, payment_type, notes, payment_status, job_status, fill_status, broadcast_status, created_at";

    let { data, error } = await supabase
      .from("jobs")
      .select(fullSelect)
      .eq("id", jobId)
      .maybeSingle();

    if (error && isSchemaColumnMissing(error.message, "jobs")) {
      ({ data, error } = await supabase
        .from("jobs")
        .select(fallbackSelect)
        .eq("id", jobId)
        .maybeSingle());
    }

    if (error) {
      console.error("[api/jobs/:jobId] GET failed", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (
      currentUser?.role === "job_provider" &&
      currentUser.providerId &&
      String((data as { provider_id?: string | null }).provider_id ?? "") !== currentUser.providerId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let providerName: string | null = null;
    const providerId = (data as { provider_id?: string | null }).provider_id;
    if (providerId) {
      const { data: providerRow, error: providerError } = await supabase
        .from("job_providers")
        .select("name")
        .eq("id", providerId)
        .maybeSingle();
      if (providerError) {
        console.warn("[api/jobs/:jobId] provider lookup failed", providerError);
      }
      providerName = providerRow?.name ?? null;
    }

    const overview = await loadJobsOverview({
      title: "",
      role: "",
      area: "",
      postcode: "",
      provider: "",
      job_status: "",
      fill_status: "",
      payment_status: "",
      broadcast_status: "",
    }, {
      viewerProviderId: currentUser?.role === "job_provider" ? currentUser.providerId : undefined,
    }).catch((error) => {
      console.warn("[api/jobs/:jobId] overview lookup failed", error);
      return null;
    });
    const overviewJob = overview?.jobs.find((job) => job.job_id === jobId) ?? null;
    const requestedWorkforce = await loadRequestedWorkforceForJob(supabase, jobId, {
      viewerRole: currentUser?.role ?? "anonymous",
    });
    const requestedWorkerIds = requestedWorkforce.map((worker) => worker.id);
    const requestedWorkforceNames = requestedWorkforce.map((worker) => worker.name).filter(Boolean);
    const acceptedWorkforce = requestedWorkforce.filter((worker) => {
      const status = worker.dispatchStatus || worker.dispatch_status;
      return status === "accepted";
    });
    const confirmedWorkforce = requestedWorkforce.filter((worker) => {
      const status = worker.dispatchStatus || worker.dispatch_status;
      return status === "accepted" || worker.confirmedForJob || worker.confirmed_for_job;
    });
    const workersConfirmed =
      confirmedWorkforce.length ||
      acceptedWorkforce.length ||
      Number(
        (data as { workers_confirmed?: number | null; confirmed_workforce_count?: number | null }).workers_confirmed ??
        (data as { confirmed_workforce_count?: number | null }).confirmed_workforce_count ??
        data.headcount_confirmed ??
        0,
      );
    const fallbackJobForModal = {
      job_id: String(data.id),
      provider_id: providerId ?? null,
      job_title: String(data.title ?? "Job"),
      company_name: providerName ?? "",
      area: data.area ?? null,
      postcode: String(data.postcode ?? ""),
      start_date: data.starts_at ? String(data.starts_at).slice(0, 10) : "",
      start_time: data.start_time ?? (data.starts_at ? String(data.starts_at).slice(11, 16) : null),
      end_time: data.end_time ?? null,
      workers_required: Number(data.headcount_required ?? 0),
      workers_confirmed: workersConfirmed,
      workersConfirmed,
      confirmed_workforce_count: workersConfirmed,
      acceptedWorkforce,
      acceptedWorkers: acceptedWorkforce,
      accepted_workers: acceptedWorkforce,
      confirmedWorkforce,
      confirmed_workers: confirmedWorkforce,
      broadcast_status: data.broadcast_status ?? "broadcast ready",
      payment_status: data.payment_status ?? "unpaid",
      job_status: data.job_status ?? "open",
      created_at: data.created_at ?? "",
      trade_type: data.required_role ?? data.core_role ?? null,
      skill_tags: normaliseStringArray(data.selected_keywords).length
        ? normaliseStringArray(data.selected_keywords)
        : normaliseStringArray(data.skills_required),
      certificates_required: normaliseStringArray(data.tickets_required),
      fill_status: data.fill_status ?? "Open",
      matching_workers: [],
      matchingWorkers: [],
      requestedWorkforce,
      requested_workforce: requestedWorkforce,
      requestedWorkers: requestedWorkforce,
      requested_workers: requestedWorkforce,
      client_requested_workforce: requestedWorkforce,
      requestedWorkerIds,
      requested_workforce_names: requestedWorkforceNames,
      pay_rate: data.pay_rate ?? null,
      job_category: data.alert_type ?? null,
      alert_type: data.alert_type ?? null,
      core_role: data.core_role ?? null,
      selected_role: data.selected_role ?? null,
      trade: data.trade ?? null,
      location_label: data.location_label ?? null,
      location_confirmed: data.location_confirmed ?? null,
      time_window: data.time_window ?? null,
      duration: data.duration ?? null,
      end_date: data.end_date ?? null,
      pay_rate_display: data.pay_rate ? formatPayRate(data.pay_rate, data.payment_type ?? null) : null,
      duties: data.duties ?? null,
      dbs_requirement: data.dbs_requirement ?? null,
      dbs_required: data.dbs_required ?? null,
      ipaf_required: data.ipaf_required ?? null,
      own_tools_required: data.own_tools_required ?? null,
      ppe_required: data.ppe_required ?? null,
      ppe_detail: data.ppe_detail ?? null,
      skills_required: normaliseStringArray(data.skills_required),
      requirements: normaliseStringArray(data.requirements),
      shift_pattern: data.shift_pattern ?? null,
      tickets_required: normaliseStringArray(data.tickets_required),
      optional_supporting_notes: data.optional_supporting_notes ?? null,
      payment_type: data.payment_type ?? null,
      invoice_status: data.invoice_status ?? "not_ready",
      invoice_send_date: data.invoice_send_date ?? null,
      invoice_due_date: data.invoice_due_date ?? null,
      invoice_last_sent_at: data.invoice_last_sent_at ?? null,
      invoice_notes: data.invoice_notes ?? null,
    };
    const jobForModal = overviewJob
      ? {
          ...overviewJob,
          requestedWorkforce,
          requested_workforce: requestedWorkforce,
          requestedWorkers: requestedWorkforce,
          requested_workers: requestedWorkforce,
          client_requested_workforce: requestedWorkforce,
          requestedWorkerIds,
          requested_workforce_names: requestedWorkforceNames,
          workers_confirmed: workersConfirmed,
          workersConfirmed,
          confirmed_workforce_count: workersConfirmed,
          acceptedWorkforce,
          acceptedWorkers: acceptedWorkforce,
          accepted_workers: acceptedWorkforce,
          confirmedWorkforce,
          confirmed_workers: confirmedWorkforce,
        }
      : fallbackJobForModal;

    return NextResponse.json(
      {
        ok: true,
        ...data,
        provider_name: providerName,
        workers_confirmed: workersConfirmed,
        workersConfirmed,
        confirmed_workforce_count: workersConfirmed,
        requestedWorkforce,
        requested_workforce: requestedWorkforce,
        requestedWorkers: requestedWorkforce,
        requested_workers: requestedWorkforce,
        client_requested_workforce: requestedWorkforce,
        requestedWorkerIds,
        requested_workforce_names: requestedWorkforceNames,
        acceptedWorkforce,
        acceptedWorkers: acceptedWorkforce,
        accepted_workers: acceptedWorkforce,
        confirmedWorkforce,
        confirmed_workers: confirmedWorkforce,
        job: jobForModal,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[api/jobs/:jobId] GET crash", error);
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  }
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;

  const cleaned = String(value).replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normaliseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function buildServerJobUpdate(body: Record<string, unknown>) {
  const latitude = toNullableNumber(body.latitude);
  const longitude = toNullableNumber(body.longitude);

  return {
    provider_id: toNullableString(body.provider_id),
    title: String(body.title ?? "").trim(),
    required_role: String(body.required_role ?? "").trim(),
    location: String(body.location ?? "").trim(),
    place_id: toNullableString(body.place_id),
    latitude,
    longitude,
    location_resolved:
      Boolean(body.location_resolved) || (latitude != null && longitude != null),
    headcount_required: Number(body.headcount_required ?? 0) || 0,
    headcount_confirmed: Number(body.headcount_confirmed ?? 0) || 0,
    starts_at: toNullableString(body.starts_at),
    alert_type: toNullableString(body.alert_type),
    core_role: toNullableString(body.core_role),
    selected_role: toNullableString(body.selected_role),
    trade: toNullableString(body.trade),
    location_label: toNullableString(body.location_label),
    location_confirmed: Boolean(body.location_confirmed),
    start_time: toNullableString(body.start_time),
    end_time: toNullableString(body.end_time),
    time_window: toNullableString(body.time_window),
    duration: toNullableString(body.duration),
    end_date: toNullableString(body.end_date),
    pay_rate: toNullableString(body.pay_rate),
    pay_rate_amount: toNullableNumber(body.pay_rate_amount),
    pay_rate_unit: toNullableString(body.pay_rate_unit),
    duties: toNullableString(body.duties),
    dbs_required: Boolean(body.dbs_required),
    dbs_requirement: toNullableString(body.dbs_requirement),
    enhanced_dbs_required: Boolean(body.enhanced_dbs_required),
    cscs_required: Boolean(body.cscs_required),
    ipaf_required: Boolean(body.ipaf_required),
    own_tools_required: Boolean(body.own_tools_required),
    tools_required: toNullableString(body.tools_required),
    ppe_required: Boolean(body.ppe_required),
    ppe_detail: toNullableString(body.ppe_detail),
    skills_required: normaliseStringArray(body.skills_required),
    requirements: normaliseStringArray(body.requirements),
    shift_pattern: toNullableString(body.shift_pattern),
    tickets_required: normaliseStringArray(body.tickets_required),
    certificates_required: toNullableString(body.certificates_required),
    selected_keywords: normaliseStringArray(body.selected_keywords),
    payment_type: toNullableString(body.payment_type),
    notes: toNullableString(body.notes),
    job_status: toNullableString(body.job_status),
    payment_status: toNullableString(body.payment_status),
    supporting_notes: toNullableString(body.supporting_notes ?? body.optional_supporting_notes),
    platform_backed_job: Boolean(body.platform_backed_job),
    platform_backed_status: toNullableString(body.platform_backed_status) ?? "none",
    platform_backed_note: toNullableString(body.platform_backed_note),
    platform_backed_approved_by_admin: Boolean(body.platform_backed_approved_by_admin),
    platform_backed_payment_terms: toNullableString(body.platform_backed_payment_terms),
    walk_off_clause_enabled: Boolean(body.walk_off_clause_enabled),
    worker_payment_protected: Boolean(body.worker_payment_protected),
    payment_terms_days: toNullableNumber(body.payment_terms_days),
    provider_agreed_terms_verified: Boolean(body.provider_agreed_terms_verified),
    worker_agreed_terms_verified: Boolean(body.worker_agreed_terms_verified),
  };
}

async function updateJob(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  console.log("[api/jobs/:jobId] incoming body", json);
  console.log("[jobs:update] incoming payload:", json);
  const payload = buildServerJobUpdate(json);
  console.log("[jobs:update] clean payload:", payload);

  if (!payload.provider_id) {
    return NextResponse.json({ success: false, error: "Provider is required." }, { status: 400 });
  }

  if (!payload.title) {
    return NextResponse.json({ success: false, error: "Job title is required." }, { status: 400 });
  }

  if (!payload.required_role) {
    return NextResponse.json({ success: false, error: "Required role is required." }, { status: 400 });
  }

  if (!payload.location) {
    return NextResponse.json({ success: false, error: "Location is required." }, { status: 400 });
  }

  if (payload.headcount_required < 1) {
    return NextResponse.json(
      { success: false, error: "Headcount required must be at least 1." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    const currentUser = await getAppSessionUser();
    const existingSelect =
      "id, provider_id, area, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_resolved, location_precision, latitude, longitude";
    const fallbackExistingSelect = "id, provider_id, area, postcode, location_display, location_query, location_precision, latitude, longitude";
    let { data: existingJob, error: existingError } = await supabase
      .from("jobs")
      .select(existingSelect)
      .eq("id", jobId)
      .maybeSingle();

    if (existingError && isSchemaColumnMissing(existingError.message, "jobs")) {
      ({ data: existingJob, error: existingError } = await supabase
        .from("jobs")
        .select(fallbackExistingSelect)
        .eq("id", jobId)
        .maybeSingle());
    }

    if (existingError) {
      console.error("[jobs:update] failed to load existing job", existingError);
      return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
    }

    if (!existingJob) {
      return NextResponse.json({ success: false, error: "Job not found." }, { status: 404 });
    }

    if (
      currentUser?.role === "job_provider" &&
      currentUser.providerId &&
      String((existingJob as { provider_id?: string | null }).provider_id ?? "") !== currentUser.providerId
    ) {
      return NextResponse.json({ success: false, error: "You can only edit your own jobs." }, { status: 403 });
    }

    const normalizedExisting = normalizeJobLocationRecord(existingJob as Record<string, unknown>);
    const preserveResolvedMetadata =
      payload.location_resolved &&
      normalizedExisting.place_id &&
      payload.place_id &&
      normalizedExisting.place_id === payload.place_id;

    const locationResult = buildResolvedLocationPayload({
      input: {
        location_text: payload.location,
        location_display: payload.location,
        location_query: payload.location,
        formatted_address: preserveResolvedMetadata ? normalizedExisting.formatted_address : null,
        place_id: payload.place_id,
        postcode: preserveResolvedMetadata ? normalizedExisting.postcode : null,
        locality: preserveResolvedMetadata ? normalizedExisting.locality : null,
        administrative_area: preserveResolvedMetadata ? normalizedExisting.administrative_area : null,
        country: preserveResolvedMetadata ? normalizedExisting.country : null,
        latitude: payload.latitude,
        longitude: payload.longitude,
      },
      rawText: payload.location,
      existing: normalizedExisting,
    });
    const location = locationResult.location;
    const resolvedCoordinates = locationResult.shouldResolveCoordinates
      ? await resolveSavedCoordinates({
          placeId: location.place_id,
          formattedAddress: location.formatted_address,
          manualLatitude: location.latitude,
          manualLongitude: location.longitude,
        })
      : hasValidCoordinates(location)
        ? {
            latitude: location.latitude as number,
            longitude: location.longitude as number,
          }
        : null;
    const locationWarning =
      !locationResult.isConfirmed
        ? "Location needs confirmation before this job can appear on the map."
        : null;
    const compatibilityLocation = buildJobCompatibilityLocation(location);
    const fullPayload = {
      provider_id: payload.provider_id,
      title: payload.title,
      required_role: payload.required_role,
      area: compatibilityLocation.area,
      postcode: compatibilityLocation.postcode,
      location_text: location.location_text,
      location_display: location.location_display,
      location_query: location.location_query,
      formatted_address: location.formatted_address,
      place_id: location.place_id,
      locality: location.locality,
      administrative_area: location.administrative_area,
      country: location.country,
      location_resolved: locationResult.isConfirmed,
      location_precision: "custom_address",
      latitude: resolvedCoordinates?.latitude ?? location.latitude ?? null,
      longitude: resolvedCoordinates?.longitude ?? location.longitude ?? null,
      job_status: payload.job_status ?? "open",
      fill_status:
        payload.headcount_confirmed >= payload.headcount_required
          ? "filled"
          : payload.headcount_confirmed > 0
            ? "part_filled"
            : "unfilled",
      payment_status: payload.payment_status ?? "unpaid",
      headcount_required: payload.headcount_required,
      headcount_confirmed: payload.headcount_confirmed,
      starts_at: payload.starts_at,
      alert_type: payload.alert_type,
      core_role: payload.core_role,
      selected_role: payload.selected_role,
      trade: payload.trade,
      location_label: payload.location_label || location.location_display,
      location_confirmed: payload.location_confirmed || locationResult.isConfirmed,
      start_time: payload.start_time,
      end_time: payload.end_time,
      time_window: payload.time_window,
      duration: payload.duration,
      end_date: payload.end_date,
      pay_rate: payload.pay_rate,
      pay_rate_amount: payload.pay_rate_amount,
      pay_rate_unit: payload.pay_rate_unit,
      duties: payload.duties,
      dbs_required: payload.dbs_required,
      dbs_requirement: payload.dbs_requirement,
      enhanced_dbs_required: payload.enhanced_dbs_required,
      cscs_required: payload.cscs_required,
      ipaf_required: payload.ipaf_required,
      own_tools_required: payload.own_tools_required,
      tools_required: payload.tools_required,
      ppe_required: payload.ppe_required,
      ppe_detail: payload.ppe_detail,
      skills_required: payload.skills_required,
      requirements: payload.requirements,
      shift_pattern: payload.shift_pattern,
      tickets_required: payload.tickets_required,
      certificates_required: payload.certificates_required,
      optional_supporting_notes: payload.supporting_notes,
      selected_keywords: payload.selected_keywords,
      payment_type: payload.payment_type,
      notes: payload.notes || null,
      platform_backed_job: payload.platform_backed_job,
      platform_backed_status: payload.platform_backed_status,
      platform_backed_note: payload.platform_backed_note,
      platform_backed_approved_by_admin: payload.platform_backed_approved_by_admin,
      platform_backed_payment_terms: payload.platform_backed_payment_terms,
      walk_off_clause_enabled: payload.walk_off_clause_enabled,
      worker_payment_protected: payload.worker_payment_protected,
      payment_terms_days: payload.payment_terms_days,
      provider_agreed_terms_verified: payload.provider_agreed_terms_verified,
      worker_agreed_terms_verified: payload.worker_agreed_terms_verified,
    };
    const legacyPayload = {
      provider_id: fullPayload.provider_id,
      title: fullPayload.title,
      required_role: fullPayload.required_role,
      area: fullPayload.area,
      postcode: fullPayload.postcode,
      location_display: fullPayload.location_display,
      location_query: fullPayload.location_query,
      location_resolved: fullPayload.location_resolved,
      location_precision: fullPayload.location_precision,
      latitude: fullPayload.latitude,
      longitude: fullPayload.longitude,
      job_status: fullPayload.job_status,
      fill_status: fullPayload.fill_status,
      payment_status: fullPayload.payment_status,
      headcount_required: fullPayload.headcount_required,
      headcount_confirmed: fullPayload.headcount_confirmed,
      starts_at: fullPayload.starts_at,
      alert_type: fullPayload.alert_type,
      core_role: fullPayload.core_role,
      selected_role: fullPayload.selected_role,
      trade: fullPayload.trade,
      location_label: fullPayload.location_label,
      location_confirmed: fullPayload.location_confirmed,
      start_time: fullPayload.start_time,
      end_time: fullPayload.end_time,
      time_window: fullPayload.time_window,
      duration: fullPayload.duration,
      end_date: fullPayload.end_date,
      pay_rate: fullPayload.pay_rate,
      pay_rate_amount: fullPayload.pay_rate_amount,
      pay_rate_unit: fullPayload.pay_rate_unit,
      duties: fullPayload.duties,
      dbs_required: fullPayload.dbs_required,
      dbs_requirement: fullPayload.dbs_requirement,
      enhanced_dbs_required: fullPayload.enhanced_dbs_required,
      cscs_required: fullPayload.cscs_required,
      ipaf_required: fullPayload.ipaf_required,
      own_tools_required: fullPayload.own_tools_required,
      tools_required: fullPayload.tools_required,
      ppe_required: fullPayload.ppe_required,
      ppe_detail: fullPayload.ppe_detail,
      skills_required: fullPayload.skills_required,
      requirements: fullPayload.requirements,
      shift_pattern: fullPayload.shift_pattern,
      tickets_required: fullPayload.tickets_required,
      certificates_required: fullPayload.certificates_required,
      optional_supporting_notes: fullPayload.optional_supporting_notes,
      selected_keywords: fullPayload.selected_keywords,
      payment_type: fullPayload.payment_type,
      notes: fullPayload.notes,
    };
    const compactPayload = {
      provider_id: fullPayload.provider_id,
      title: fullPayload.title,
      required_role: fullPayload.required_role,
      area: fullPayload.area,
      postcode: fullPayload.postcode,
      job_status: fullPayload.job_status,
      fill_status: fullPayload.fill_status,
      payment_status: fullPayload.payment_status,
      headcount_required: fullPayload.headcount_required,
      headcount_confirmed: fullPayload.headcount_confirmed,
      starts_at: fullPayload.starts_at,
      notes: fullPayload.notes,
    };
    const compactSelect =
      "id, title, required_role, area, postcode, provider_id, job_status, fill_status, payment_status, headcount_required, headcount_confirmed, starts_at, notes, created_at";
    const fullSelect =
      "id, title, required_role, area, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_resolved, location_precision, latitude, longitude, provider_id, job_status, fill_status, payment_status, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, selected_role, trade, location_label, location_confirmed, start_time, end_time, time_window, duration, end_date, pay_rate, pay_rate_amount, pay_rate_unit, duties, dbs_required, dbs_requirement, enhanced_dbs_required, cscs_required, ipaf_required, own_tools_required, tools_required, ppe_required, ppe_detail, skills_required, requirements, shift_pattern, tickets_required, certificates_required, optional_supporting_notes, selected_keywords, payment_type, notes, platform_backed_job, platform_backed_status, platform_backed_note, platform_backed_approved_by_admin, platform_backed_payment_terms, walk_off_clause_enabled, worker_payment_protected, payment_terms_days, provider_agreed_terms_verified, worker_agreed_terms_verified, created_at";
    const fallbackSelect =
      "id, title, required_role, area, postcode, location_display, location_query, location_resolved, location_precision, latitude, longitude, provider_id, job_status, fill_status, payment_status, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, selected_role, trade, location_label, location_confirmed, start_time, end_time, time_window, duration, end_date, pay_rate, pay_rate_amount, pay_rate_unit, duties, dbs_required, dbs_requirement, enhanced_dbs_required, cscs_required, ipaf_required, own_tools_required, tools_required, ppe_required, ppe_detail, skills_required, requirements, shift_pattern, tickets_required, certificates_required, optional_supporting_notes, selected_keywords, payment_type, notes, created_at";

    let { data, error } = await supabase.from("jobs").update(fullPayload).eq("id", jobId).select(fullSelect).single();

    if (error && isSchemaColumnMissing(error.message, "jobs")) {
      ({ data, error } = await supabase
        .from("jobs")
        .update(legacyPayload)
        .eq("id", jobId)
        .select(fallbackSelect)
        .single());
    }

    if (error && isSchemaColumnMissing(error.message, "jobs")) {
      ({ data, error } = await supabase
        .from("jobs")
        .update(compactPayload)
        .eq("id", jobId)
        .select(compactSelect)
        .single());
    }

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Job not found." }, { status: 404 });
      }

      console.error("[jobs:update] update failed", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const responsePayload = {
      success: true,
      job: data
        ? {
            ...data,
            pay_rate_display: formatPayRate(data.pay_rate, data.payment_type),
          }
        : data,
      warning: locationWarning,
    };

    if (payload.platform_backed_job) {
      await supabase.from("provider_audit_events").insert({
        provider_id: payload.provider_id,
        event_type:
          payload.platform_backed_status === "revoked"
            ? "platform_backed_job_revoked"
            : "platform_backed_job_approved",
        metadata: {
          job_id: jobId,
          platform_backed_status: payload.platform_backed_status,
          worker_payment_protected: payload.worker_payment_protected,
        },
      });
    }

    console.log("[api/jobs/:jobId] updated row", responsePayload.job ?? data);
    console.log("[jobs:update] SUCCESS:", responsePayload.job ?? data);
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("[jobs:update] CRASH:", error);
    const message = error instanceof Error ? error.message : "Failed to update job";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  return updateJob(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  return updateJob(request, context);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  try {
    const supabase = createAdminSupabaseClient();
    const currentUser = await getAppSessionUser();

    if (currentUser?.role === "job_provider" && currentUser.providerId) {
      const { data: existingJob, error: loadError } = await supabase
        .from("jobs")
        .select("id, provider_id")
        .eq("id", jobId)
        .maybeSingle();

      if (loadError) {
        return NextResponse.json({ error: loadError.message }, { status: 500 });
      }

      if (!existingJob) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      if (String(existingJob.provider_id ?? "") !== currentUser.providerId) {
        return NextResponse.json({ error: "You can only delete your own jobs." }, { status: 403 });
      }
    }

    const { error, count } = await supabase.from("jobs").delete({ count: "exact" }).eq("id", jobId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({ success: false, error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete job";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
