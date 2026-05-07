"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { type ResolvedLocation } from "@/components/LocationAutocomplete";
import { formatZodErrors } from "@/lib/forms";
import { STANDARD_ROLES } from "@/lib/constants/roles";
import { emitMapRefresh, notifyJobCreated } from "@/lib/jobs/client-events";
import { createJobSchema, type CreateJobInput } from "@/lib/validation/schemas";
import { hasValidCoordinates } from "@/lib/location";

const initialState: CreateJobInput = {
  provider_id: "",
  title: "",
  required_role: "",
  area: "",
  postcode: "",
  location_text: "",
  location_display: "",
  location_query: "",
  formatted_address: "",
  place_id: "",
  locality: "",
  administrative_area: "",
  country: "",
  location_resolved: false,
  location_precision: "postcode_area",
  latitude: null,
  longitude: null,
  headcount_required: 1,
  headcount_confirmed: 0,
  starts_at: "",
  alert_type: "Job Alert",
  core_role: "",
  selected_role: "",
  trade: "",
  location_label: "",
  location_confirmed: false,
  start_time: "",
  end_time: "",
  time_window: "",
  duration: "",
  end_date: "",
  pay_rate: "",
  pay_rate_amount: null,
  pay_rate_unit: null,
  duties: "",
  dbs_required: false,
  dbs_requirement: "None",
  enhanced_dbs_required: false,
  cscs_required: false,
  ipaf_required: false,
  own_tools_required: false,
  tools_required: "",
  ppe_required: false,
  ppe_detail: "",
  skills_required: [],
  requirements: [],
  shift_pattern: "",
  tickets_required: [],
  certificates_required: "",
  optional_supporting_notes: "",
  selected_keywords: [],
  payment_type: "",
  notes: "",
  job_status: "open",
  payment_status: "unpaid",
  skill_tags: [],
  fill_status: "unfilled",
  platform_backed_job: false,
  platform_backed_status: "none",
  platform_backed_note: "",
  platform_backed_approved_by_admin: false,
  platform_backed_payment_terms: "",
  walk_off_clause_enabled: false,
  worker_payment_protected: false,
  payment_terms_days: null,
  provider_agreed_terms_verified: false,
  worker_agreed_terms_verified: false,
};

interface JobFormProps {
  providers: Array<{ provider_id: string; company_name: string }>;
  initialData?: Partial<CreateJobInput>;
  submitUrl?: string;
  method?: "POST" | "PATCH" | "PUT";
  successRedirect?: string;
  applyPatch?: Partial<CreateJobInput>;
  applyVersion?: number;
  applyMode?: "fill-empty" | "overwrite";
  submitLabel?: string;
  onJobCreated?: (savedJob: Record<string, unknown>) => void;
  requireConfirmedLocation?: boolean;
}

type JobFormErrors = Partial<Record<
  | "provider_id"
  | "title"
  | "required_role"
  | "location"
  | "starts_at"
  | "end_date"
  | "headcount_required"
  | "pay_rate"
  | "payment_type"
  | "job_status",
  string
>>;

function hasSavedCoordinates(
  form: Pick<CreateJobInput, "latitude" | "longitude">,
  locationState: Pick<ResolvedLocation, "latitude" | "longitude">,
) {
  return (
    hasValidCoordinates({
      latitude: locationState.latitude ?? form.latitude ?? null,
      longitude: locationState.longitude ?? form.longitude ?? null,
    })
  );
}

function validateJobForm(form: CreateJobInput, locationState: ResolvedLocation): JobFormErrors {
  const fieldErrors: JobFormErrors = {};
  const hasResolvedCoordinates = hasSavedCoordinates(form, locationState);

  if (!form.provider_id) fieldErrors.provider_id = "Provider is required.";
  if (!form.title.trim()) fieldErrors.title = "Job title is required.";
  if (!(form.required_role ?? "").trim()) fieldErrors.required_role = "Required role is required.";
  if (!locationState.locationText.trim()) {
    fieldErrors.location = "Location is required.";
  } else if (!locationState.resolved && !hasResolvedCoordinates) {
    fieldErrors.location = "Please select a valid place suggestion.";
  }
  if (!form.starts_at) fieldErrors.starts_at = "Start date/time is required.";
  if (!form.end_date) fieldErrors.end_date = "End date is required.";
  if (!form.headcount_required || Number(form.headcount_required) < 1) {
    fieldErrors.headcount_required = "Headcount required must be at least 1.";
  }
  if (!(form.pay_rate ?? "").trim()) fieldErrors.pay_rate = "Pay rate is required.";
  if (!(form.payment_type ?? "").trim()) fieldErrors.payment_type = "Payment type is required.";
  if (!(form.job_status ?? "").trim()) fieldErrors.job_status = "Job status is required.";

  return fieldErrors;
}

function getFieldStyle(hasError: boolean) {
  return hasError
    ? {
        border: "1px solid #dc2626",
        background: "#fef2f2",
      }
    : undefined;
}

function RequiredLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <>
      {children}
      {required ? <span style={{ marginLeft: 4, color: "#dc2626" }}>*</span> : null}
    </>
  );
}

function buildInitialResolvedLocation(initialData?: Partial<CreateJobInput>): ResolvedLocation {
  const locationText =
    initialData?.location_text ??
    initialData?.formatted_address ??
    initialData?.location_display ??
    [initialData?.postcode, initialData?.area].filter(Boolean).join(", ") ??
    "";
  const resolved = Boolean(
    initialData?.location_resolved ||
      ((initialData?.place_id || initialData?.formatted_address || locationText) &&
        initialData?.latitude != null &&
        initialData?.longitude != null),
  );

  return {
    locationText,
    formattedAddress: initialData?.formatted_address ?? null,
    placeId: initialData?.place_id ?? null,
    latitude: initialData?.latitude ?? null,
    longitude: initialData?.longitude ?? null,
    postcode: initialData?.postcode ?? null,
    locality: initialData?.locality ?? initialData?.area ?? null,
    administrativeArea: initialData?.administrative_area ?? null,
    country: initialData?.country ?? null,
    resolved,
  };
}

function toNumberOrNull(value: string | number | null | undefined) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
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

function buildJobPayload(form: CreateJobInput, locationState: ResolvedLocation) {
  const currentLocationText = locationState.locationText.trim();
  const hasResolvedCoordinates = hasSavedCoordinates(form, locationState);
  const preserveSavedCoordinates =
    !locationState.resolved &&
    hasResolvedCoordinates &&
    currentLocationText.length > 0 &&
    currentLocationText === (form.location_text ?? form.location_display ?? "").trim();
  const latitude = locationState.resolved
    ? locationState.latitude
    : preserveSavedCoordinates
      ? (form.latitude ?? null)
      : null;
  const longitude = locationState.resolved
    ? locationState.longitude
    : preserveSavedCoordinates
      ? (form.longitude ?? null)
      : null;
  const locationResolved = Boolean(locationState.resolved || (latitude != null && longitude != null));

  return {
    provider_id: form.provider_id,
    title: form.title.trim(),
    required_role: form.required_role?.trim() || "",
    location: currentLocationText,
    location_text: currentLocationText,
    location_display: currentLocationText,
    location_query:
      locationState.resolved
        ? (locationState.formattedAddress ?? currentLocationText)
        : preserveSavedCoordinates
          ? (form.location_query ?? "")
          : "",
    formatted_address:
      locationState.resolved
        ? (locationState.formattedAddress ?? "")
        : preserveSavedCoordinates
          ? (form.formatted_address ?? "")
          : "",
    place_id:
      locationState.resolved
        ? (locationState.placeId ?? "")
        : preserveSavedCoordinates
          ? (form.place_id ?? "")
          : "",
    postcode:
      locationState.resolved
        ? (locationState.postcode ?? "")
        : preserveSavedCoordinates
          ? (form.postcode ?? "")
          : "",
    locality:
      locationState.resolved
        ? (locationState.locality ?? "")
        : preserveSavedCoordinates
          ? (form.locality ?? "")
          : "",
    administrative_area:
      locationState.resolved
        ? (locationState.administrativeArea ?? "")
        : preserveSavedCoordinates
          ? (form.administrative_area ?? "")
          : "",
    country:
      locationState.resolved
        ? (locationState.country ?? "")
        : preserveSavedCoordinates
          ? (form.country ?? "")
          : "",
    latitude,
    longitude,
    location_resolved: locationResolved,
    location_precision: "custom_address" as const,
    area:
      locationState.resolved
        ? (locationState.locality ?? locationState.administrativeArea ?? "")
        : preserveSavedCoordinates
          ? (form.area ?? "")
          : "",
    headcount_required: toNumberOrNull(form.headcount_required) ?? 1,
    headcount_confirmed: toNumberOrNull(form.headcount_confirmed) ?? 0,
    alert_type: form.alert_type?.trim() || "",
    core_role: form.core_role?.trim() || "",
    starts_at: form.starts_at || null,
    end_date: form.end_date || null,
    duration: form.duration?.trim() || "",
    pay_rate: form.pay_rate?.trim() || "",
    duties: form.duties?.trim() || "",
    dbs_requirement: form.dbs_requirement,
    ipaf_required: Boolean(form.ipaf_required),
    own_tools_required: Boolean(form.own_tools_required),
    ppe_required: Boolean(form.ppe_required),
    skills_required: Array.isArray(form.skills_required) ? form.skills_required : [],
    shift_pattern: form.shift_pattern?.trim() || "",
    tickets_required: Array.isArray(form.tickets_required) ? form.tickets_required : [],
    optional_supporting_notes: form.optional_supporting_notes?.trim() || "",
    payment_type: form.payment_type?.trim() || "",
    notes: form.notes?.trim() || "",
    job_status: form.job_status?.trim() || "open",
    payment_status: form.payment_status?.trim() || "unpaid",
    fill_status: form.fill_status,
    skill_tags: Array.isArray(form.skill_tags) ? form.skill_tags : [],
    platform_backed_job: Boolean(form.platform_backed_job),
    platform_backed_status: form.platform_backed_status,
    platform_backed_note: form.platform_backed_note?.trim() || "",
    platform_backed_approved_by_admin: Boolean(form.platform_backed_approved_by_admin),
    platform_backed_payment_terms: form.platform_backed_payment_terms?.trim() || "",
    walk_off_clause_enabled: Boolean(form.walk_off_clause_enabled),
    worker_payment_protected: Boolean(form.worker_payment_protected),
    payment_terms_days: toNumberOrNull(form.payment_terms_days),
    provider_agreed_terms_verified: Boolean(form.provider_agreed_terms_verified),
    worker_agreed_terms_verified: Boolean(form.worker_agreed_terms_verified),
  };
}

function buildEditJobPayload(form: CreateJobInput, locationState: ResolvedLocation) {
  const currentLocationText = locationState.locationText.trim();
  const preservedLatitude =
    locationState.latitude ?? (hasSavedCoordinates(form, locationState) ? form.latitude ?? null : null);
  const preservedLongitude =
    locationState.longitude ?? (hasSavedCoordinates(form, locationState) ? form.longitude ?? null : null);

  return {
    provider_id: toNullableString(form.provider_id),
    title: String(form.title ?? "").trim(),
    required_role: String(form.required_role ?? "").trim(),
    location: currentLocationText,
    place_id: toNullableString(locationState.placeId ?? form.place_id),
    latitude: toNullableNumber(preservedLatitude),
    longitude: toNullableNumber(preservedLongitude),
    location_resolved:
      Boolean(locationState.resolved || form.location_resolved) ||
      (toNullableNumber(preservedLatitude) != null && toNullableNumber(preservedLongitude) != null),
    headcount_required: Number(form.headcount_required ?? 0) || 0,
    headcount_confirmed: Number(form.headcount_confirmed ?? 0) || 0,
    starts_at: toNullableString(form.starts_at),
    alert_type: toNullableString(form.alert_type),
    core_role: toNullableString(form.core_role),
    duration: toNullableNumber(form.duration),
    end_date: toNullableString(form.end_date),
    pay_rate: toNullableNumber(form.pay_rate),
    duties: toNullableString(form.duties),
    dbs_requirement: toNullableString(form.dbs_requirement),
    ipaf_required: Boolean(form.ipaf_required),
    own_tools_required: Boolean(form.own_tools_required),
    ppe_required: Boolean(form.ppe_required),
    skills_required: normaliseStringArray(form.skills_required),
    shift_pattern: toNullableString(form.shift_pattern),
    tickets_required: normaliseStringArray(form.tickets_required),
    payment_type: toNullableString(form.payment_type),
    notes: toNullableString(form.notes),
    job_status: toNullableString(form.job_status),
    payment_status: toNullableString(form.payment_status),
    supporting_notes: toNullableString(form.optional_supporting_notes),
    platform_backed_job: Boolean(form.platform_backed_job),
    platform_backed_status: toNullableString(form.platform_backed_status) ?? "none",
    platform_backed_note: toNullableString(form.platform_backed_note),
    platform_backed_approved_by_admin: Boolean(form.platform_backed_approved_by_admin),
    platform_backed_payment_terms: toNullableString(form.platform_backed_payment_terms),
    walk_off_clause_enabled: Boolean(form.walk_off_clause_enabled),
    worker_payment_protected: Boolean(form.worker_payment_protected),
    payment_terms_days: toNullableNumber(form.payment_terms_days),
    provider_agreed_terms_verified: Boolean(form.provider_agreed_terms_verified),
    worker_agreed_terms_verified: Boolean(form.worker_agreed_terms_verified),
  };
}

function buildInitialState(initialData?: Partial<CreateJobInput>): CreateJobInput {
  return {
    ...initialState,
    ...initialData,
    provider_id: initialData?.provider_id ?? initialState.provider_id,
    required_role: initialData?.required_role ?? initialState.required_role,
    alert_type: initialData?.alert_type ?? initialState.alert_type,
    dbs_requirement: initialData?.dbs_requirement ?? initialState.dbs_requirement,
    payment_type: initialData?.payment_type ?? initialState.payment_type,
    job_status: initialData?.job_status ?? initialState.job_status,
    payment_status: initialData?.payment_status ?? initialState.payment_status,
    fill_status: initialData?.fill_status ?? initialState.fill_status,
    location_display:
      initialData?.location_display ??
      ([initialData?.postcode, initialData?.area].filter(Boolean).join(", ") ||
        initialState.location_display),
    location_query: initialData?.location_query ?? initialState.location_query,
    location_precision: initialData?.location_precision ?? initialState.location_precision,
  };
}

export function JobForm({
  providers,
  initialData,
  submitUrl = "/api/jobs",
  method = "POST",
  successRedirect,
  applyPatch,
  applyVersion,
  applyMode = "fill-empty",
  submitLabel,
  onJobCreated,
  requireConfirmedLocation = false,
}: JobFormProps) {
  const router = useRouter();
  const isEditMode = method !== "POST";
  const [form, setForm] = useState<CreateJobInput>(() => buildInitialState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [locationState, setLocationState] = useState<ResolvedLocation>(() =>
    buildInitialResolvedLocation(initialData),
  );
  const fieldErrors = useMemo(
    () => validateJobForm(form, locationState),
    [form, locationState],
  );

  useEffect(() => {
    if (!applyPatch || applyVersion === undefined) {
      return;
    }

    setForm((current) => {
      const next = { ...current };
      const defaults = buildInitialState(initialData);
      const entries = Object.entries(applyPatch) as Array<
        [keyof CreateJobInput, CreateJobInput[keyof CreateJobInput]]
      >;

      for (const [key, incomingValue] of entries) {
        if (incomingValue === undefined) continue;

        const currentValue = current[key];
        const defaultValue = defaults[key];
        const isBlankString =
          typeof currentValue === "string" && typeof defaultValue === "string"
            ? currentValue.trim() === defaultValue.trim()
            : false;
        const isEmptyArray = Array.isArray(currentValue) && currentValue.length === 0;
        const isDefaultNumber =
          typeof currentValue === "number" && typeof defaultValue === "number"
            ? currentValue === defaultValue
            : false;
        const canFill =
          currentValue === null ||
          currentValue === undefined ||
          isBlankString ||
          isEmptyArray ||
          isDefaultNumber;

        if (applyMode === "overwrite" || canFill) {
          (next as Record<string, unknown>)[key] = incomingValue;
        }
      }

      return next;
    });
  }, [applyMode, applyPatch, applyVersion, initialData]);

  useEffect(() => {
    if (applyPatch?.location_text || applyPatch?.location_display) {
      setLocationState(
        buildInitialResolvedLocation({
          ...form,
          ...applyPatch,
        }),
      );
    }
  }, [applyPatch, applyVersion]);

  useEffect(() => {
    setLocationState(buildInitialResolvedLocation(initialData));
  }, [initialData]);

  useEffect(() => {
    if (isEditMode && process.env.NODE_ENV !== "production") {
      console.log("[edit-job] current form state", form);
    }
  }, [form, isEditMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEditMode) {
      console.log("[edit-job] submit fired");
    }
    setSubmitAttempted(true);
    const requiredErrors = validateJobForm(form, locationState);
    if (isEditMode) {
      console.log("[edit-job] validation errors", requiredErrors);
      console.log("[edit-job] current form", form);
    }
    if (Object.keys(requiredErrors).length > 0) {
      setErrors({
        ...Object.fromEntries(
          Object.entries(requiredErrors).map(([key, value]) => [key, value ?? "Required field missing."]),
        ),
        form: "Please complete all required fields marked in red before updating this job.",
      });
      return;
    }
    const nextForm = buildJobPayload(form, locationState);
    const parsed = createJobSchema.safeParse(nextForm);

    if (!parsed.success) {
      setErrors(formatZodErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setSubmitting(true);
    setSaveNotice("");

    try {
      if (
        requireConfirmedLocation &&
        locationState.locationText.trim() &&
        !locationState.resolved
      ) {
        setErrors({
          location_display: "Select a suggested location before saving this AI-confirmed job.",
        });
        return;
      }

      const jobId =
        typeof submitUrl === "string" && submitUrl.includes("/api/jobs/")
          ? submitUrl.split("/api/jobs/")[1]?.split("/")[0] ?? null
          : null;
      const payload = isEditMode
        ? buildEditJobPayload(form, locationState)
        : {
            ...parsed.data,
            id: jobId,
            jobId,
            location: nextForm.location,
            starts_at: parsed.data.starts_at || "",
            start_date: parsed.data.starts_at || "",
            end_date: parsed.data.end_date || "",
            pay_rate: parsed.data.pay_rate || "",
            job_status: parsed.data.job_status,
            payment_status: parsed.data.payment_status,
            alert_type: parsed.data.alert_type || "Job Alert",
          };

      if (isEditMode) {
        console.log("[edit-job] clean payload", payload);
        console.log("[edit-job] submitting payload", payload);
        console.log("[jobs:update] outgoing payload:", payload);
      }

      const response = await fetch(submitUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (isEditMode) {
        console.log("[edit-job] response status", response.status);
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        setErrors({ form: errorPayload.error ?? (isEditMode ? "Unable to update job" : "Unable to create job") });
        return;
      }

      const responsePayload = await response.json().catch(() => ({}));
      if (isEditMode) {
        console.log("[edit-job] response data", responsePayload);
        console.log("[job-update] response", responsePayload);
      }
      if (responsePayload?.job) {
        onJobCreated?.(responsePayload.job);
        if (!isEditMode) {
          notifyJobCreated(responsePayload.job);
        } else {
          emitMapRefresh(responsePayload.job);
        }
      } else if (responsePayload && method !== "POST") {
        emitMapRefresh(responsePayload);
      }

      if (successRedirect) {
        router.push(successRedirect);
        router.refresh();
        return;
      }

      setForm(initialState);
      setLocationState(buildInitialResolvedLocation());
      setSaveNotice(responsePayload?.warning ?? (isEditMode ? "Job updated successfully." : "Job saved successfully."));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      {submitAttempted && Object.keys(fieldErrors).length > 0 ? (
        <div
          className="md:col-span-2"
          style={{
            marginBottom: 0,
            borderRadius: 10,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            padding: "0.9rem 1rem",
            color: "#b91c1c",
          }}
        >
          Please complete all required fields marked in red before updating this job.
        </div>
      ) : null}

      <label>
        <RequiredLabel required>Provider</RequiredLabel>
        <select
          value={form.provider_id ?? ""}
          onChange={(event) => setForm({ ...form, provider_id: event.target.value })}
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.provider_id))}
        >
          <option value="">No provider linked</option>
          {providers.map((provider) => (
            <option key={provider.provider_id} value={provider.provider_id}>
              {provider.company_name}
            </option>
          ))}
        </select>
        {submitAttempted && fieldErrors.provider_id ? <span style={{ color: "#dc2626" }}>{fieldErrors.provider_id}</span> : null}
      </label>

      <label>
        <RequiredLabel required>Job Title</RequiredLabel>
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.title))}
        />
        {submitAttempted && fieldErrors.title ? <span style={{ color: "#dc2626" }}>{fieldErrors.title}</span> : null}
      </label>

      <p className="md:col-span-2" style={{ margin: 0 }}>
        Use the standard role and optional provider link so overview filters and matching stay consistent.
      </p>

      <label>
        <RequiredLabel required>Required Role</RequiredLabel>
        <select
          value={form.required_role ?? ""}
          onChange={(event) => setForm({ ...form, required_role: event.target.value })}
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.required_role))}
        >
          <option value="">Select role</option>
          {STANDARD_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {submitAttempted && fieldErrors.required_role ? <span style={{ color: "#dc2626" }}>{fieldErrors.required_role}</span> : null}
      </label>

      <label className="md:col-span-2" style={{ display: "grid", gap: "0.5rem" }}>
        <RequiredLabel required>Location</RequiredLabel>
        <LocationAutocomplete
          value={locationState.locationText}
          onChange={(next) => {
            setLocationState(next);
            setForm((current) => ({
              ...current,
              location_text: next.locationText,
              location_display: next.locationText,
              area: next.resolved ? (next.locality ?? next.administrativeArea ?? "") : "",
              postcode: next.resolved ? (next.postcode ?? "") : "",
              formatted_address: next.resolved ? (next.formattedAddress ?? "") : "",
              place_id: next.resolved ? (next.placeId ?? "") : "",
              locality: next.resolved ? (next.locality ?? "") : "",
              administrative_area: next.resolved ? (next.administrativeArea ?? "") : "",
              country: next.resolved ? (next.country ?? "") : "",
              latitude: next.resolved ? next.latitude : null,
              longitude: next.resolved ? next.longitude : null,
              location_resolved: next.resolved,
            }));
          }}
          className="w-full rounded-md border px-3 py-2"
          inputStyle={getFieldStyle(Boolean(submitAttempted && fieldErrors.location))}
        />
        {submitAttempted && fieldErrors.location ? <span style={{ color: "#dc2626" }}>{fieldErrors.location}</span> : null}
        {locationState.resolved || hasSavedCoordinates(form, locationState) ? (
          <div style={{ color: "#166534" }}>
            Location confirmed. Coordinates captured: {(locationState.latitude ?? form.latitude)?.toFixed(5)}, {(locationState.longitude ?? form.longitude)?.toFixed(5)}
          </div>
        ) : locationState.locationText.trim() ? (
          <div style={{ color: "#9a3412" }}>
            Please select a suggested location so this job can appear on the map.
          </div>
        ) : null}
      </label>

      <label>
        <RequiredLabel required>Headcount Required</RequiredLabel>
        <input
          type="number"
          min="1"
          value={form.headcount_required}
          onChange={(event) =>
            setForm({ ...form, headcount_required: Number(event.target.value) })
          }
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.headcount_required))}
        />
        {submitAttempted && fieldErrors.headcount_required ? <span style={{ color: "#dc2626" }}>{fieldErrors.headcount_required}</span> : null}
      </label>

      <label>
        Headcount Confirmed
        <input
          type="number"
          min="0"
          value={form.headcount_confirmed}
          onChange={(event) =>
            setForm({ ...form, headcount_confirmed: Number(event.target.value) })
          }
        />
      </label>

      <label>
        Alert Type
        <input
          value={form.alert_type ?? ""}
          onChange={(event) => setForm({ ...form, alert_type: event.target.value })}
        />
      </label>

      <label>
        Core Role
        <input
          value={form.core_role ?? ""}
          onChange={(event) => setForm({ ...form, core_role: event.target.value })}
        />
      </label>

      <label>
        <RequiredLabel required>Starts At</RequiredLabel>
        <input
          type="datetime-local"
          value={form.starts_at ?? ""}
          onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.starts_at))}
        />
        {submitAttempted && fieldErrors.starts_at ? <span style={{ color: "#dc2626" }}>{fieldErrors.starts_at}</span> : null}
      </label>

      <label>
        <RequiredLabel required>End Date</RequiredLabel>
        <input
          type="date"
          value={form.end_date ?? ""}
          onChange={(event) => setForm({ ...form, end_date: event.target.value })}
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.end_date))}
        />
        {submitAttempted && fieldErrors.end_date ? <span style={{ color: "#dc2626" }}>{fieldErrors.end_date}</span> : null}
      </label>

      <label>
        Duration
        <input
          value={form.duration ?? ""}
          onChange={(event) => setForm({ ...form, duration: event.target.value })}
        />
      </label>

      <label>
        <RequiredLabel required>Pay Rate</RequiredLabel>
        <input
          value={form.pay_rate ?? ""}
          onChange={(event) => setForm({ ...form, pay_rate: event.target.value })}
          placeholder="e.g. £190/day"
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.pay_rate))}
        />
        {submitAttempted && fieldErrors.pay_rate ? <span style={{ color: "#dc2626" }}>{fieldErrors.pay_rate}</span> : null}
      </label>

      <label>
        <RequiredLabel required>Payment Type</RequiredLabel>
        <select
          value={form.payment_type ?? ""}
          onChange={(event) => setForm({ ...form, payment_type: event.target.value })}
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.payment_type))}
        >
          <option value="">Select</option>
          <option value="hourly">hourly</option>
          <option value="daily">daily</option>
          <option value="price work">price work</option>
          <option value="fixed shift rate">fixed shift rate</option>
        </select>
        {submitAttempted && fieldErrors.payment_type ? <span style={{ color: "#dc2626" }}>{fieldErrors.payment_type}</span> : null}
      </label>

      <label>
        Shift Pattern
        <input
          value={form.shift_pattern ?? ""}
          onChange={(event) => setForm({ ...form, shift_pattern: event.target.value })}
          placeholder="e.g. 8am-5pm"
        />
      </label>

      <label>
        DBS Requirement
        <select
          value={form.dbs_requirement}
          onChange={(event) =>
            setForm({ ...form, dbs_requirement: event.target.value as CreateJobInput["dbs_requirement"] })
          }
        >
          <option value="None">None</option>
          <option value="DBS Required">DBS Required</option>
          <option value="Enhanced DBS Required">Enhanced DBS Required</option>
        </select>
      </label>

      <label>
        <RequiredLabel required>Job Status</RequiredLabel>
        <select
          value={form.job_status}
          onChange={(event) =>
            setForm({
              ...form,
              job_status: event.target.value as CreateJobInput["job_status"],
            })
          }
          style={getFieldStyle(Boolean(submitAttempted && fieldErrors.job_status))}
        >
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
        {submitAttempted && fieldErrors.job_status ? <span style={{ color: "#dc2626" }}>{fieldErrors.job_status}</span> : null}
      </label>

      <label>
        Payment Status
        <select
          value={form.payment_status}
          onChange={(event) =>
            setForm({
              ...form,
              payment_status: event.target.value as CreateJobInput["payment_status"],
            })
          }
        >
          <option value="unpaid">unpaid</option>
          <option value="part_paid">part_paid</option>
          <option value="paid">paid</option>
          <option value="overdue">overdue</option>
        </select>
      </label>

      <label className="md:col-span-2">
        Duties
        <textarea
          value={form.duties ?? ""}
          onChange={(event) => setForm({ ...form, duties: event.target.value })}
          placeholder="Concise description of what the worker will actually do"
        />
      </label>

      <label className="md:col-span-2">
        Skills Required
        <textarea
          value={(form.skills_required ?? []).join("\n")}
          onChange={(event) =>
            setForm({
              ...form,
              skills_required: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
            })
          }
          placeholder="One skill per line"
        />
      </label>

      <label className="md:col-span-2">
        Tickets Required
        <textarea
          value={(form.tickets_required ?? []).join("\n")}
          onChange={(event) =>
            setForm({
              ...form,
              tickets_required: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
            })
          }
          placeholder="One ticket per line"
        />
      </label>

      <div className="md:col-span-2" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <label>
          <input
            type="checkbox"
            checked={Boolean(form.ipaf_required)}
            onChange={(event) => setForm({ ...form, ipaf_required: event.target.checked })}
          />{" "}
          IPAF Required
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(form.own_tools_required)}
            onChange={(event) => setForm({ ...form, own_tools_required: event.target.checked })}
          />{" "}
          Own Tools Required
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(form.ppe_required)}
            onChange={(event) => setForm({ ...form, ppe_required: event.target.checked })}
          />{" "}
          PPE Required
        </label>
      </div>

      <label className="md:col-span-2">
        Supporting Notes
        <textarea
          value={form.optional_supporting_notes ?? ""}
          onChange={(event) => setForm({ ...form, optional_supporting_notes: event.target.value })}
          placeholder="Extra details that reduce worker questions"
        />
      </label>

      <label className="md:col-span-2">
        Notes
        <textarea
          value={form.notes ?? ""}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Shift notes, access details, contact instructions"
        />
      </label>

      <fieldset
        className="md:col-span-2"
        style={{
          border: "1px solid var(--rd-border)",
          borderRadius: 16,
          padding: "1rem",
          display: "grid",
          gap: "1rem",
        }}
      >
        <legend style={{ padding: "0 0.4rem", fontWeight: 800 }}>Platform-Backed Job</legend>
        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
          Admin-controlled trust support for selected jobs only. This does not make every job platform-backed.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.platform_backed_job)}
              onChange={(event) => setForm({ ...form, platform_backed_job: event.target.checked })}
            />{" "}
            Platform-Backed Job
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.platform_backed_approved_by_admin)}
              onChange={(event) => setForm({ ...form, platform_backed_approved_by_admin: event.target.checked })}
            />{" "}
            Approved by Admin
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.worker_payment_protected)}
              onChange={(event) => setForm({ ...form, worker_payment_protected: event.target.checked })}
            />{" "}
            Worker Payment Protected
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.walk_off_clause_enabled)}
              onChange={(event) => setForm({ ...form, walk_off_clause_enabled: event.target.checked })}
            />{" "}
            Walk-Off Clause Enabled
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label>
            Platform-Backed Status
            <select
              value={form.platform_backed_status}
              onChange={(event) =>
                setForm({
                  ...form,
                  platform_backed_status: event.target.value as CreateJobInput["platform_backed_status"],
                })
              }
            >
              <option value="none">none</option>
              <option value="proposed">proposed</option>
              <option value="approved">approved</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="revoked">revoked</option>
            </select>
          </label>
          <label>
            Payment Terms Days
            <input
              type="number"
              min={0}
              value={form.payment_terms_days ?? ""}
              onChange={(event) =>
                setForm({ ...form, payment_terms_days: event.target.value === "" ? null : Number(event.target.value) })
              }
            />
          </label>
          <label>
            Payment Terms
            <input
              value={form.platform_backed_payment_terms ?? ""}
              onChange={(event) => setForm({ ...form, platform_backed_payment_terms: event.target.value })}
              placeholder="e.g. platform-backed 7 day terms"
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.provider_agreed_terms_verified)}
              onChange={(event) => setForm({ ...form, provider_agreed_terms_verified: event.target.checked })}
            />{" "}
            Provider Terms Verified
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.worker_agreed_terms_verified)}
              onChange={(event) => setForm({ ...form, worker_agreed_terms_verified: event.target.checked })}
            />{" "}
            Worker Terms Verified
          </label>
        </div>
        <label>
          Internal Platform-Backed Note
          <textarea
            value={form.platform_backed_note ?? ""}
            onChange={(event) => setForm({ ...form, platform_backed_note: event.target.value })}
            rows={3}
          />
        </label>
      </fieldset>

      {errors.form ? (
        <div
          className="md:col-span-2"
          style={{
            borderRadius: 10,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            padding: "0.9rem 1rem",
            color: "#b91c1c",
          }}
        >
          {errors.form}
        </div>
      ) : null}
      {saveNotice ? <p className="md:col-span-2">{saveNotice}</p> : null}

      <button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting
          ? (isEditMode ? "Updating..." : "Saving...")
          : submitLabel ?? (isEditMode ? "Update Job" : "Create Job")}
      </button>
    </form>
  );
}
