"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { PromptActionMenu } from "@/components/dashboard/PromptActionMenu";
import WorkerAlertSimulator from "@/components/worker-alert-simulator/WorkerAlertSimulator";
import {
  GooglePlacesAutocomplete,
  type GooglePlaceSuggestion,
  type GooglePlacesStatus,
} from "@/components/forms/GooglePlacesAutocomplete";
import { JobForm } from "@/components/forms/JobForm";
import {
  createEmptyEditableLocation,
  mapGooglePlaceToEditableLocation,
  type EditableResolvedLocation,
} from "@/components/forms/LocationAutocompleteInput";
import { writeBroadcastContextPreference, type BroadcastContextPreference } from "@/lib/broadcast-context";
import { notifyJobCreated } from "@/lib/jobs/client-events";
import {
  mapStructuredJobToJobForm,
  structuredJobIntakeSchema,
  type StructuredJobIntake,
} from "@/lib/job-intake/schema";
import {
  createJobDraftFromStructuredJob,
  jobDraftToCreateJobInput,
  jobDraftToWorkerAlertDraft,
} from "@/lib/job-draft";
import type { ResolvedLocationPayload } from "@/lib/location";
import type { CreateJobInput } from "@/lib/validation/schemas";
import { writeWorkforceDispatchAIState } from "@/lib/workforce-dispatch-ai-state";

interface ProviderOption {
  provider_id: string;
  company_name: string;
}

const KEYWORD_CHIPS = [
  "Labourer",
  "Sparky / Electrician",
  "Chippy / Carpenter",
  "Dryliner",
  "Painter",
  "Plumber",
  "CSCS",
  "Price Work",
] as const;

const previewRows: Array<{ key: keyof StructuredJobIntake; label: string }> = [
  { key: "alert_type", label: "Alert Type" },
  { key: "core_role", label: "Core Role" },
  { key: "headcount_required", label: "Workers Needed" },
  { key: "location", label: "Location" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "duration", label: "Duration" },
  { key: "pay_rate", label: "Pay" },
  { key: "duties", label: "Duties" },
  { key: "dbs_requirement", label: "DBS Requirement" },
];

function createAudioFile(blob: Blob) {
  const extension = blob.type.includes("ogg")
    ? "ogg"
    : blob.type.includes("mp4") || blob.type.includes("m4a")
      ? "m4a"
      : blob.type.includes("wav")
        ? "wav"
        : "webm";

  return new File([blob], `voice-note-${Date.now()}.${extension}`, {
    type: blob.type || "audio/webm",
  });
}

function toResolvedLocationPayload(location: EditableResolvedLocation): ResolvedLocationPayload {
  return {
    location_text: location.location_text || null,
    location_display: location.location_display || null,
    location_query: location.location_query || null,
    formatted_address: location.formatted_address || null,
    place_id: location.place_id || null,
    postcode: location.postcode || null,
    locality: location.locality || null,
    administrative_area: location.administrative_area || null,
    country: location.country || null,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className="ai-input-action-button ai-compose-icon-button dispatch-ai-composer__icon-button dispatch-ai-composer__icon-button--audio"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        border: "1px solid var(--composer-button-border, var(--rd-border))",
        background: active ? "var(--rd-primary)" : "var(--composer-button-bg, var(--rd-control-bg))",
        color: active ? "var(--rd-primary-text)" : "var(--rd-control-text)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SendButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ai-input-submit-button ai-compose-submit dispatch-ai-composer__submit"
      onClick={onClick}
      disabled={disabled}
      aria-label="Generate job brief"
      style={{
        width: 46,
        height: 46,
        borderRadius: 999,
        border: "none",
        background: disabled
          ? "var(--composer-submit-disabled-bg, var(--rd-control-active-bg))"
          : "var(--composer-submit-bg, var(--rd-primary))",
        color: disabled
          ? "var(--rd-text-muted)"
          : "var(--composer-submit-color, var(--rd-primary-text))",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : "var(--rd-shadow)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M3 10H15M15 10L10 5M15 10L10 15"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function JobAlertPreviewCard({
  draft,
  selectedKeywords,
  onConfirm,
  onEdit,
  onRegenerate,
  onLocationChange,
  onLocationSelect,
  onLocationStatusChange,
  locationState,
  locationStatus,
  providerName,
  busy,
}: {
  draft: StructuredJobIntake;
  selectedKeywords: string[];
  onConfirm: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onLocationChange: (value: string) => void;
  onLocationSelect: (location: GooglePlaceSuggestion) => void;
  onLocationStatusChange: (status: GooglePlacesStatus) => void;
  locationState: EditableResolvedLocation;
  locationStatus: GooglePlacesStatus;
  providerName?: string;
  busy: boolean;
}) {
  const requirements = draft.tickets_required.length
    ? draft.tickets_required
    : [];
  const locationLinked = Boolean(locationState.place_id);
  const placesReady = locationStatus.state === "ready";
  const placesLoading = locationStatus.state === "loading";
  const placesError =
    locationStatus.state === "error" || locationStatus.state === "missing_key";

  return (
    <section
      style={{
        marginTop: 0,
        padding: "0.95rem",
        borderRadius: 22,
        border: "1px solid var(--rd-border)",
        background: "var(--rd-bg-elevated)",
        color: "var(--rd-text)",
        boxShadow: "var(--rd-shadow-soft)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--rd-text-muted)",
            }}
          >
            Drafted Job Alert
          </p>
          <h3 style={{ margin: "0.3rem 0 0.4rem", fontSize: "1.15rem", lineHeight: 1.15 }}>
            {draft.job_title ?? draft.core_role ?? "Untitled job alert"}
          </h3>
          <p style={{ margin: 0, color: "var(--rd-text-muted)", lineHeight: 1.45, fontSize: "0.88rem" }}>
            Here&apos;s the drafted job alert based on your request. Please review before submitting.
          </p>
          {providerName ? (
            <p style={{ margin: "0.45rem 0 0", color: "var(--rd-text-muted)", lineHeight: 1.45, fontSize: "0.88rem" }}>
              Provider account: <strong style={{ color: "var(--rd-text)" }}>{providerName}</strong>
            </p>
          ) : null}
        </div>
        {draft.missing_fields.length ? (
          <div
            style={{
              padding: "0.75rem 0.9rem",
              borderRadius: 18,
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.2)",
              minWidth: 220,
            }}
          >
            <strong style={{ display: "block", marginBottom: "0.35rem", color: "#92400e" }}>
              Missing details
            </strong>
            <span style={{ color: "#92400e" }}>{draft.missing_fields.join(", ")}</span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.65rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          marginTop: "0.9rem",
        }}
      >
        {previewRows.map((row) => {
          const value = draft[row.key];
          const displayValue =
            typeof value === "number"
              ? String(value)
              : typeof value === "string"
                ? value
                : null;
          const locationInputValue =
            row.key === "location"
              ? locationLinked
                ? locationState.formatted_address ||
                  locationState.location_display ||
                  locationState.location_text ||
                  displayValue ||
                  ""
                : locationState.location_text || displayValue || ""
              : "";

          return (
            <div
              key={row.key}
              style={{
                padding: "0.65rem 0.75rem",
                borderRadius: 16,
                background: "var(--rd-surface-soft)",
                border: "1px solid var(--rd-border)",
              }}
            >
              <div style={{ fontSize: "0.76rem", color: "var(--rd-text-muted)" }}>{row.label}</div>
              {row.key === "location" ? (
                <>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.25rem 0.6rem",
                      borderRadius: 999,
                      background: locationLinked
                        ? "rgba(22, 163, 74, 0.1)"
                        : placesReady
                          ? "rgba(37, 99, 235, 0.08)"
                          : placesLoading
                            ? "rgba(148, 163, 184, 0.12)"
                            : placesError
                              ? "rgba(239, 68, 68, 0.08)"
                              : "rgba(148, 163, 184, 0.12)",
                      color: locationLinked
                        ? "#166534"
                        : placesReady
                          ? "#1d4ed8"
                        : placesLoading
                            ? "var(--rd-text-muted)"
                            : placesError
                              ? "#b91c1c"
                              : "var(--rd-text-muted)",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                    }}
                  >
                    {locationLinked
                      ? "Google Places linked"
                      : placesReady
                        ? "Autocomplete ready"
                        : placesLoading
                          ? "Connecting to Google Places"
                          : placesError
                            ? "Google Places unavailable"
                            : "Manual text only"}
                  </div>
                  <div style={{ marginTop: "0.45rem" }}>
                    <GooglePlacesAutocomplete
                      label="Location"
                      hideLabel
                      value={locationInputValue}
                      onChange={onLocationChange}
                      onSelect={onLocationSelect}
                      onStatusChange={onLocationStatusChange}
                      placeholder="Enter or adjust the location"
                      inputStyle={{
                        width: "100%",
                        minWidth: 0,
                        border: locationLinked
                          ? "1px solid rgba(34, 197, 94, 0.35)"
                          : "1px solid var(--rd-border)",
                        borderRadius: 12,
                        padding: "0.6rem 0.75rem",
                        fontSize: "0.92rem",
                        lineHeight: 1.35,
                        boxSizing: "border-box",
                        background: locationLinked ? "rgba(34, 197, 94, 0.1)" : "var(--rd-input-bg)",
                        color: "var(--rd-input-text)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: "0.45rem",
                      fontSize: "0.8rem",
                      color: locationLinked ? "#166534" : placesError ? "#b91c1c" : "#9a3412",
                      lineHeight: 1.4,
                    }}
                  >
                    {locationLinked
                      ? `Linked to Google Places: ${locationState.formatted_address || locationState.location_display || locationState.location_text}.`
                      : placesError
                        ? locationStatus.message
                        : placesReady
                          ? "Search and select a Google Places suggestion so this card switches from free text to a confirmed map-linked location."
                          : placesLoading
                            ? "Loading Google Places suggestions for this location field."
                            : "Search and select a Google Places suggestion here so the saved job can carry the correct map-linked location data."}
                  </div>
                  {locationLinked && (locationState.latitude != null || locationState.longitude != null) ? (
                    <div style={{ marginTop: "0.3rem", fontSize: "0.78rem", color: "var(--rd-text-muted)" }}>
                      Coordinates captured: {locationState.latitude?.toFixed(5)}, {locationState.longitude?.toFixed(5)}
                    </div>
                  ) : null}
                  {locationLinked && locationState.place_id ? (
                    <div style={{ marginTop: "0.2rem", fontSize: "0.74rem", color: "var(--rd-text-muted)" }}>
                      Place ID saved: {locationState.place_id}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ marginTop: "0.2rem", fontWeight: 650, color: "var(--rd-text)", fontSize: "0.9rem" }}>
                  {displayValue || "-"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(requirements.length || draft.skills_required.length) ? (
        <div style={{ marginTop: "0.8rem" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)", marginBottom: "0.45rem" }}>
            Requirements
          </div>
          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            {requirements.map((item) => (
              <span
                key={item}
                style={{
                  padding: "0.45rem 0.8rem",
                  borderRadius: 999,
                  background: "var(--rd-control-bg)",
                  border: "1px solid var(--rd-border)",
                  color: "var(--rd-text)",
                }}
              >
                {item}
              </span>
            ))}
            {draft.skills_required.map((item) => (
              <span
                key={item}
                style={{
                  padding: "0.45rem 0.8rem",
                  borderRadius: 999,
                  background: "var(--rd-control-bg)",
                  border: "1px solid var(--rd-border)",
                  color: "var(--rd-text)",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: "0.8rem" }}>
        <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)", marginBottom: "0.45rem" }}>
          Operational Checks
        </div>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          {draft.dbs_requirement ? (
            <span style={{ padding: "0.45rem 0.8rem", borderRadius: 999, background: "var(--rd-control-bg)", border: "1px solid var(--rd-border)", color: "var(--rd-text)" }}>
              DBS: {draft.dbs_requirement}
            </span>
          ) : null}
          {draft.ipaf_required !== null ? (
            <span style={{ padding: "0.45rem 0.8rem", borderRadius: 999, background: "var(--rd-control-bg)", border: "1px solid var(--rd-border)", color: "var(--rd-text)" }}>
              IPAF: {draft.ipaf_required ? "Yes" : "No"}
            </span>
          ) : null}
          {draft.own_tools_required !== null ? (
            <span style={{ padding: "0.45rem 0.8rem", borderRadius: 999, background: "var(--rd-control-bg)", border: "1px solid var(--rd-border)", color: "var(--rd-text)" }}>
              Own Tools: {draft.own_tools_required ? "Yes" : "No"}
            </span>
          ) : null}
          {draft.ppe_required !== null ? (
            <span style={{ padding: "0.45rem 0.8rem", borderRadius: 999, background: "var(--rd-control-bg)", border: "1px solid var(--rd-border)", color: "var(--rd-text)" }}>
              PPE: {draft.ppe_required ? "Yes" : "No"}
            </span>
          ) : null}
        </div>
      </div>

      {selectedKeywords.length ? (
        <div style={{ marginTop: "0.8rem" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)", marginBottom: "0.45rem" }}>
            Selected Keywords
          </div>
          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            {selectedKeywords.map((keyword) => (
              <span
                key={keyword}
                style={{
                  padding: "0.45rem 0.8rem",
                  borderRadius: 999,
                  background: "var(--rd-primary)",
                  color: "var(--rd-primary-text)",
                  fontSize: "0.92rem",
                }}
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {draft.optional_supporting_notes ? (
        <div
          style={{
            marginTop: "0.8rem",
            padding: "0.75rem 0.85rem",
            borderRadius: 18,
            background: "linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.9))",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            color: "#334155",
            lineHeight: 1.7,
          }}
        >
          {draft.optional_supporting_notes}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
        <button type="button" onClick={onConfirm} disabled={busy}>
          Confirm Job Alert
        </button>
        <button type="button" onClick={onEdit} disabled={busy}>
          Edit Details
        </button>
        <button type="button" onClick={onRegenerate} disabled={busy}>
          Regenerate
        </button>
      </div>
    </section>
  );
}

export function AIJobIntakeWorkspace({
  providers,
  currentProviderId,
  currentProviderName,
  detailHref,
  detailLabel = "Open Detailed AI Hiring Assistance",
}: {
  providers: ProviderOption[];
  currentProviderId?: string;
  currentProviderName?: string;
  detailHref?: string;
  detailLabel?: string;
}) {
  const [rawText, setRawText] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [rawAudioUrl, setRawAudioUrl] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [structuredPreview, setStructuredPreview] = useState<StructuredJobIntake | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("Ready when you are.");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [customKeyword, setCustomKeyword] = useState("");
  const [applyVersion, setApplyVersion] = useState(0);
  const [applyMode, setApplyMode] = useState<"fill-empty" | "overwrite">("fill-empty");
  const [applyPatch, setApplyPatch] = useState<Partial<CreateJobInput>>({});
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [promptContext, setPromptContext] = useState<BroadcastContextPreference>("standard");
  const [previewLocation, setPreviewLocation] = useState<EditableResolvedLocation>(
    createEmptyEditableLocation(),
  );
  const [previewLocationStatus, setPreviewLocationStatus] = useState<GooglePlacesStatus>({
    state: "idle",
    message: "",
  });
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const dispatchCardRef = useRef<HTMLElement | null>(null);

  const audioPreviewUrl = useMemo(
    () => (audioFile ? URL.createObjectURL(audioFile) : ""),
    [audioFile],
  );

  const busy = transcribing || extracting;
  const canSend = Boolean(rawText.trim() || audioFile) && !busy;
  const heroStatus = isRecording
    ? "Listening..."
    : transcribing
      ? "Transcribing voice note..."
      : extracting
        ? "Generating preview..."
        : statusMessage;

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioPreviewUrl]);

  function autoResizeTextarea(element: HTMLTextAreaElement | null) {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  useEffect(() => {
    autoResizeTextarea(textareaRef.current);
  }, [rawText]);

  async function transcribeCurrentAudio() {
    if (!audioFile) return { transcriptText: "", rawAudioUrl: null };

    setTranscribing(true);
    setStatusMessage("Transcribing voice note...");

    try {
      const formData = new FormData();
      formData.append("audio", audioFile);

      const response = await fetch("/api/job-intake/transcribe", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Audio transcription failed.");
      }

      setTranscriptText(payload.transcript_text ?? "");
      setRawAudioUrl(payload.raw_audio_url ?? null);
      return {
        transcriptText: payload.transcript_text ?? "",
        rawAudioUrl: payload.raw_audio_url ?? null,
      };
    } finally {
      setTranscribing(false);
    }
  }

  async function generatePreview() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let transcript = transcriptText;
      let audioUrl = rawAudioUrl;

      if (audioFile) {
        const transcribed = await transcribeCurrentAudio();
        transcript = transcribed.transcriptText;
        audioUrl = transcribed.rawAudioUrl;
      }

      if (!rawText.trim() && !transcript.trim()) {
        setErrorMessage("Add a typed brief or voice note before sending.");
        return;
      }

      setRawAudioUrl(audioUrl);
      setExtracting(true);
      setStatusMessage("Generating preview...");

      const response = await fetch("/api/job-intake/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text_input: rawText.trim(),
          transcript_text: transcript.trim(),
          selected_keywords: selectedKeywords,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Job extraction failed.");
      }

      const parsed = structuredJobIntakeSchema.parse({
        ...payload.structured_job,
        selected_keywords:
          payload.structured_job?.selected_keywords?.length
            ? payload.structured_job.selected_keywords
            : selectedKeywords,
      });

      setStructuredPreview(parsed);
      setPreviewLocation(createEmptyEditableLocation(parsed.location ?? ""));
      setPreviewLocationStatus({ state: "idle", message: "" });
      writeWorkforceDispatchAIState({
        promptText: rawText.trim() || transcript.trim(),
        structuredJob: parsed,
        resolvedLocation: toResolvedLocationPayload(createEmptyEditableLocation(parsed.location ?? "")),
        updatedAt: new Date().toISOString(),
      });
      setStatusMessage("Preview ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to generate preview.");
      setStatusMessage("Generation failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleConfirmJobAlert() {
    if (!structuredPreview) {
      setErrorMessage("Generate a preview before confirming the job alert.");
      return;
    }

    const resolvedLocation =
      previewLocation.location_text.trim() || previewLocation.place_id
        ? previewLocation
        : createEmptyEditableLocation(structuredPreview.location ?? "");
    const canonicalDraft = createJobDraftFromStructuredJob(structuredPreview, resolvedLocation);
    const payload: CreateJobInput = jobDraftToCreateJobInput(
      canonicalDraft,
      currentProviderId || (providers.length === 1 ? providers[0]?.provider_id ?? "" : ""),
    );

    setErrorMessage("");
    setSuccessMessage("");
    setExtracting(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        const message =
          typeof result.error === "string" &&
          /schema|column|cache|database/i.test(result.error)
            ? "Job fields could not be saved because the database schema is out of date. Run the latest migration and reload schema cache."
            : result.error ?? "Unable to save job alert.";
        throw new Error(message);
      }

      notifyJobCreated(result.job);
      setSuccessMessage("Job alert saved. Operations Map and alerts are updating.");
      setStatusMessage("Job alert saved.");
      setRawText("");
      setAudioFile(null);
      setRawAudioUrl(null);
      setTranscriptText("");
      setStructuredPreview(null);
      setSelectedKeywords([]);
      setPreviewLocation(createEmptyEditableLocation());
      setPreviewLocationStatus({ state: "idle", message: "" });
      setShowDispatchForm(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save job alert.");
      setStatusMessage("Save failed.");
    } finally {
      setExtracting(false);
    }
  }

  function applyToDispatchForm(mode: "fill-empty" | "overwrite") {
    if (!structuredPreview) {
      setErrorMessage("Generate a preview before applying it to the dispatch form.");
      return;
    }

    const mapped = mapStructuredJobToJobForm(structuredPreview);
    const hasResolvedLocation =
      Boolean(previewLocation.place_id) ||
      (previewLocation.latitude != null && previewLocation.longitude != null);

    setApplyPatch({
      ...mapped,
      location_text: previewLocation.location_text || mapped.location_text || "",
      location_display:
        previewLocation.location_display ||
        previewLocation.formatted_address ||
        mapped.location_display ||
        "",
      location_query:
        previewLocation.formatted_address ||
        previewLocation.location_text ||
        mapped.location_query ||
        "",
      formatted_address: previewLocation.formatted_address || mapped.formatted_address || "",
      place_id: previewLocation.place_id || mapped.place_id || "",
      postcode: previewLocation.postcode || mapped.postcode || "",
      area: previewLocation.locality || mapped.area || previewLocation.location_display || "",
      locality: previewLocation.locality || mapped.locality || "",
      administrative_area:
        previewLocation.administrative_area || mapped.administrative_area || "",
      country: previewLocation.country || mapped.country || "",
      latitude: hasResolvedLocation ? previewLocation.latitude : null,
      longitude: hasResolvedLocation ? previewLocation.longitude : null,
      location_resolved: hasResolvedLocation,
      location_precision: mapped.location_precision ?? "custom_address",
    });
    setApplyMode(mode);
    setApplyVersion((current) => current + 1);
    setShowDispatchForm(true);
    setStatusMessage(
      mode === "overwrite" ? "Dispatch form updated from preview." : "Dispatch form prefilled.",
    );

    requestAnimationFrame(() => {
      dispatchCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleKeyword(keyword: string) {
    setSelectedKeywords((current) =>
      current.includes(keyword)
        ? current.filter((item) => item !== keyword)
        : [...current, keyword],
    );
  }

  function addCustomKeyword() {
    const keyword = customKeyword.trim();
    if (!keyword) {
      setAddingKeyword(false);
      return;
    }

    setSelectedKeywords((current) =>
      current.some((item) => item.toLowerCase() === keyword.toLowerCase())
        ? current
        : [...current, keyword],
    );
    setCustomKeyword("");
    setAddingKeyword(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorderRef.current = recorder;
      streamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = createAudioFile(blob);
        setAudioFile(file);
        setTranscriptText("");
        setRawAudioUrl(null);
        setStatusMessage("Voice note added.");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
      setStatusMessage("Listening...");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to access microphone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function handleAudioPicked(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setAudioFile(selectedFile);
    setTranscriptText("");
    setRawAudioUrl(null);
    setStatusMessage(selectedFile ? "Audio attached." : "Ready when you are.");
  }

  function enableOnboardingContext() {
    setPromptContext("onboarding");
    writeBroadcastContextPreference("onboarding");
    setStatusMessage("Onboarding context added. Broadcast flows will preload onboarding messaging.");
  }

  function clearPromptContext() {
    setPromptContext("standard");
    writeBroadcastContextPreference("standard");
    setStatusMessage("Ready when you are.");
  }

  function handlePreviewLocationChange(value: string) {
    const nextLocation = value.trim();
    setPreviewLocation(createEmptyEditableLocation(value));
    setPreviewLocationStatus((current) =>
      current.state === "ready" || current.state === "loading" || current.state === "error" || current.state === "missing_key"
        ? current
        : { state: "idle", message: "" },
    );
    setStructuredPreview((current) =>
      current
        ? {
            ...current,
            location: nextLocation || null,
          }
        : current,
    );
    writeWorkforceDispatchAIState({
      promptText: rawText.trim() || transcriptText.trim(),
      structuredJob: structuredPreview
        ? {
            ...structuredPreview,
            location: nextLocation || null,
          }
        : null,
      resolvedLocation: toResolvedLocationPayload(createEmptyEditableLocation(value)),
      updatedAt: new Date().toISOString(),
    });
  }

  function handlePreviewLocationSelect(suggestion: GooglePlaceSuggestion) {
    const nextLocation = mapGooglePlaceToEditableLocation(suggestion);
    const displayLocation =
      nextLocation.location_display ||
      nextLocation.formatted_address ||
      nextLocation.location_text;

    setPreviewLocation(nextLocation);
    setPreviewLocationStatus({
      state: "ready",
      message: "Google Places location confirmed.",
    });
    setStructuredPreview((current) =>
      current
        ? {
            ...current,
            location: displayLocation || null,
          }
        : current,
    );
    writeWorkforceDispatchAIState({
      promptText: rawText.trim() || transcriptText.trim(),
      structuredJob: structuredPreview
        ? {
            ...structuredPreview,
            location: displayLocation || null,
          }
        : null,
      resolvedLocation: toResolvedLocationPayload(nextLocation),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <>
      <section
        className="dispatch-ai-section"
        style={{
          marginTop: 0,
          padding: "0.45rem 0.75rem 0.9rem",
          borderRadius: 32,
          background: "transparent",
        }}
      >
        <div className="dispatch-ai-section__content" style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              textAlign: "center",
              maxWidth: 760,
              margin: "0 auto",
            }}
          >
            <p
              className="workforce-dispatch-kicker ai-kicker"
              style={{
                margin: 0,
                color: "var(--rd-text-muted)",
                fontSize: "0.85rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Workforce Dispatch AI
            </p>
            <h2
              className="describe-job-title ai-title"
              style={{
                margin: "0.75rem 0 1.15rem",
                fontSize: "0.85rem",
                lineHeight: 1.12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: "var(--rd-text)",
              }}
            >
              Describe the job requirement
            </h2>
          </div>

          <div
            className="dispatch-ai-composer ai-compose-panel workforce-dispatch-ai-box"
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "0.75rem",
              borderRadius: 28,
              border: "1px solid var(--composer-border, var(--rd-border))",
              background: "var(--composer-shell-bg, var(--rd-input-bg))",
              boxShadow: "var(--rd-shadow)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="dispatch-ai-composer__shell dispatch-ai-composer__inner ai-compose-controls workforce-dispatch-ai-actions"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <label style={{ display: "block", width: "100%", minWidth: 0 }}>
                <span
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                >
                  Job requirement
                </span>
                <textarea
                  ref={textareaRef}
                  className="dispatch-ai-composer__textarea ai-compose-textarea workforce-dispatch-ai-textarea"
                  value={rawText}
                  onChange={(event) => {
                    setRawText(event.target.value);
                    autoResizeTextarea(event.currentTarget);
                  }}
                  placeholder="Type the job requirement, role brief, or task request here..."
                  style={{
                    width: "100%",
                    minHeight: 28,
                    resize: "none",
                    overflow: "hidden",
                    border: "none",
                    borderRadius: 22,
                    background: "var(--composer-input-bg, transparent)",
                    boxShadow: "none",
                    boxSizing: "border-box",
                    padding: "0.8rem 0.9rem",
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                    color: "var(--rd-input-text)",
                  }}
                />
              </label>

              <div className="dispatch-ai-composer__toolbar">
                <div className="dispatch-ai-composer__toolbar-left">
                  <PromptActionMenu
                    activeContext={promptContext}
                    actions={[
                      {
                        id: "upload-attachment",
                        label: "Upload attachment",
                        description: "Attach an audio file to the prompt.",
                        onSelect: () => audioInputRef.current?.click(),
                      },
                      {
                        id: "voice-note",
                        label: isRecording ? "Stop voice note" : "Voice note",
                        description: isRecording ? "Finish recording the current voice note." : "Record a voice note now.",
                        onSelect: () => {
                          if (isRecording) {
                            stopRecording();
                            return;
                          }

                          void startRecording();
                        },
                      },
                      {
                        id: "onboarding-context",
                        label: "Onboarding Context",
                        description: "Prefill staff broadcast flows for onboarding-oriented outreach.",
                        onSelect: enableOnboardingContext,
                      },
                    ]}
                  />
                </div>

                <div className="dispatch-ai-composer__toolbar-right">
                  <IconButton
                    label={isRecording ? "Stop recording" : "Record voice note"}
                    onClick={isRecording ? stopRecording : startRecording}
                    active={isRecording}
                    disabled={busy && !isRecording}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path
                        d="M3.2 10.3V7.7M6.1 12.6V5.4M9 14V4M11.9 12.6V5.4M14.8 10.3V7.7"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconButton>

                  <SendButton disabled={!canSend} onClick={generatePreview} />
                </div>
              </div>
            </div>

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioPicked}
              hidden
            />

            <div
              className="ai-compose-meta-row"
              style={{
                marginTop: "0.55rem",
                display: "flex",
                justifyContent: "space-between",
                gap: "0.75rem",
                flexWrap: "wrap",
                alignItems: "center",
                color: "var(--rd-text)",
                fontSize: "0.95rem",
              }}
            >
              {heroStatus === "Ready when you are." ? null : (
                <span className="ai-compose-status">{heroStatus}</span>
              )}
              <div className="ai-compose-attachment-row" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                {promptContext === "onboarding" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.35rem 0.7rem",
                      borderRadius: 999,
                      background: "var(--rd-accent-soft)",
                      color: "var(--rd-accent-text)",
                    }}
                  >
                    Onboarding Context
                    <button
                      type="button"
                      onClick={clearPromptContext}
                      style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "inherit" }}
                    >
                      Clear
                    </button>
                  </span>
                ) : null}
                {audioFile ? <span>Attached: {audioFile.name}</span> : null}
                {audioPreviewUrl ? <audio controls src={audioPreviewUrl} style={{ height: 32 }} /> : null}
              </div>
            </div>
          </div>

          <div className="ai-keyword-chip-shell" style={{ maxWidth: 780, margin: "0.9rem auto 0" }}>
            <div className="ai-keyword-chip-row" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
              {KEYWORD_CHIPS.map((keyword) => {
                const selected = selectedKeywords.includes(keyword);

                return (
                  <button
                    key={keyword}
                    type="button"
                    className="ai-keyword-chip"
                    onClick={() => toggleKeyword(keyword)}
                    style={{
                      padding: "0.48rem 0.78rem",
                      borderRadius: 999,
                      border: selected
                        ? "1px solid var(--rd-accent)"
                        : "1px solid var(--rd-border)",
                      background: selected ? "var(--rd-accent-soft)" : "var(--rd-control-bg)",
                      color: selected ? "var(--rd-accent-text)" : "var(--rd-control-text)",
                      cursor: "pointer",
                    }}
                  >
                    {keyword}
                  </button>
                );
              })}
              {addingKeyword ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    addCustomKeyword();
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <input
                    className="ai-keyword-chip-input"
                    type="text"
                    value={customKeyword}
                    onChange={(event) => setCustomKeyword(event.target.value)}
                    onBlur={addCustomKeyword}
                    autoFocus
                    aria-label="New keyword"
                    placeholder="Keyword"
                    style={{
                      width: "8.5rem",
                      padding: "0.48rem 0.78rem",
                      borderRadius: 999,
                      border: "1px solid var(--rd-border)",
                      background: "var(--rd-input-bg)",
                      color: "var(--rd-input-text)",
                      font: "inherit",
                    }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="ai-keyword-chip"
                  aria-label="Add keyword"
                  title="Add keyword"
                  onClick={() => setAddingKeyword(true)}
                  style={{
                    padding: "0.48rem 0.8rem",
                    borderRadius: 999,
                    border: "1px solid var(--rd-border)",
                    background: "var(--rd-control-bg)",
                    color: "var(--rd-control-text)",
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              )}
            </div>
          </div>

          {errorMessage ? (
            <p style={{ maxWidth: 860, margin: "1rem auto 0", color: "#b91c1c", textAlign: "center" }}>
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p style={{ maxWidth: 860, margin: "1rem auto 0", color: "#166534", textAlign: "center" }}>
              {successMessage}
            </p>
          ) : null}

          {structuredPreview ? (
            <section
              className="draft-alert-simulator-section"
            >
              <div
                className="draft-alert-simulator-grid"
              >
                <JobAlertPreviewCard
                  draft={structuredPreview}
                  selectedKeywords={structuredPreview.selected_keywords.length ? structuredPreview.selected_keywords : selectedKeywords}
                  onConfirm={handleConfirmJobAlert}
                  onEdit={() => applyToDispatchForm("fill-empty")}
                  onRegenerate={generatePreview}
                  onLocationChange={handlePreviewLocationChange}
                  onLocationSelect={handlePreviewLocationSelect}
                  onLocationStatusChange={setPreviewLocationStatus}
                  locationState={previewLocation}
                  locationStatus={previewLocationStatus}
                  providerName={currentProviderName}
                  busy={busy}
                />
                <WorkerAlertSimulator
                  job={jobDraftToWorkerAlertDraft(
                    createJobDraftFromStructuredJob(structuredPreview, previewLocation),
                  )}
                />
              </div>
            </section>
          ) : null}

          {detailHref ? (
            <div
              className="detailed-ai-assistant-link-wrap"
              style={{
                maxWidth: 960,
                margin: structuredPreview ? "1rem auto 0" : "1.1rem auto 0",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Link
                href={detailHref}
                className="detailed-ai-assistant-button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.75rem 1rem",
                  borderRadius: 999,
                  border: "1px solid var(--rd-border)",
                  background: "var(--rd-control-bg)",
                  color: "var(--rd-control-text)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {detailLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {showDispatchForm ? (
        <section
          ref={dispatchCardRef}
          style={{
            marginTop: "1.2rem",
            padding: "1rem",
            border: "1px solid var(--rd-border)",
            borderRadius: 22,
            background: "var(--rd-bg-elevated)",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Dispatch Form</h3>
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
              The AI draft has been mapped into the existing job save flow. Review and save when ready.
            </p>
          </div>
          <JobForm
            providers={providers}
            applyPatch={applyPatch}
            applyVersion={applyVersion}
            applyMode={applyMode}
            submitLabel="Save Dispatch Job"
            requireConfirmedLocation
          />
        </section>
      ) : null}
    </>
  );
}
