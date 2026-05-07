"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEmptyEditableLocation,
  LocationAutocompleteInput,
  type LocationInputState,
} from "@/components/forms/LocationAutocompleteInput";
import { formatZodErrors } from "@/lib/forms";
import { STANDARD_ROLES } from "@/lib/constants/roles";
import { notifyMapDataChanged } from "@/lib/jobs/client-events";
import { hasValidCoordinates } from "@/lib/location";
import { createWorkerSchema, type CreateWorkerInput } from "@/lib/validation/schemas";
import {
  getWorkerDocumentSectionsForRole,
  getWorkerDocumentLabel,
  supportsMultipleFiles,
  type WorkerDocument,
  type WorkerDocumentType,
} from "@/lib/worker-documents";

const initialState: CreateWorkerInput = {
  full_name: "",
  phone: "",
  email: "",
  primary_role: "",
  status: "active",
  available_today: false,
  right_to_work: false,
  contract_signed: false,
  town: "",
  postcode: "",
  location_text: "",
  location_display: "",
  location_query: "",
  formatted_address: "",
  place_id: "",
  locality: "",
  administrative_area: "",
  country: "",
  location_precision: "postcode_district",
  latitude: null,
  longitude: null,
  whatsapp_opt_in: false,
  priority_tier: "standard",
};

interface WorkerFormProps {
  initialData?: Partial<CreateWorkerInput>;
  initialDocuments?: WorkerDocument[];
  submitUrl?: string;
  method?: "POST" | "PATCH";
  successRedirect?: string;
}

function buildInitialState(initialData?: Partial<CreateWorkerInput>): CreateWorkerInput {
  return {
    ...initialState,
    ...initialData,
    primary_role: initialData?.primary_role ?? initialState.primary_role,
    status: initialData?.status ?? initialState.status,
    priority_tier: initialData?.priority_tier ?? initialState.priority_tier,
    location_display:
      initialData?.location_display ??
      ([initialData?.postcode, initialData?.town].filter(Boolean).join(", ") ||
        initialState.location_display),
    location_query: initialData?.location_query ?? initialState.location_query,
    location_precision: initialData?.location_precision ?? initialState.location_precision,
  };
}

export function WorkerForm({
  initialData,
  initialDocuments = [],
  submitUrl = "/api/workers",
  method = "POST",
  successRedirect,
}: WorkerFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<CreateWorkerInput>(() => buildInitialState(initialData));
  const [documents, setDocuments] = useState<WorkerDocument[]>(initialDocuments);
  const [pendingFiles, setPendingFiles] = useState<Record<WorkerDocumentType, File[]>>({
    cscs_card: [],
    id_document: [],
    portfolio: [],
    certificate: [],
    sia_badge: [],
    enhanced_dbs: [],
    dbs: [],
  });
  const [fileInputKeys, setFileInputKeys] = useState<Record<WorkerDocumentType, number>>({
    cscs_card: 0,
    id_document: 0,
    portfolio: 0,
    certificate: 0,
    sia_badge: 0,
    enhanced_dbs: 0,
    dbs: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [activeUploadType, setActiveUploadType] = useState<WorkerDocumentType | null>(null);
  const [locationInput, setLocationInput] = useState(
    initialData?.location_text ??
    initialData?.location_display ?? [initialData?.postcode, initialData?.town].filter(Boolean).join(", "),
  );
  const [locationState, setLocationState] = useState<LocationInputState>(() =>
    initialData &&
    (Boolean(initialData.place_id) ||
      hasValidCoordinates({
        latitude: initialData.latitude ?? null,
        longitude: initialData.longitude ?? null,
      }))
      ? "saved"
      : locationInput?.trim()
        ? "typing"
        : "empty",
  );
  const [saveNotice, setSaveNotice] = useState("");

  const visibleDocumentTypes = getWorkerDocumentSectionsForRole(form.primary_role);

  useEffect(() => {
    setLocationInput(
      initialData?.location_text ??
        initialData?.location_display ??
        [initialData?.postcode, initialData?.town].filter(Boolean).join(", "),
    );
    setLocationState(
      initialData &&
      (Boolean(initialData.place_id) ||
        hasValidCoordinates({
          latitude: initialData.latitude ?? null,
          longitude: initialData.longitude ?? null,
        }))
        ? "saved"
        : (
            initialData?.location_text ??
            initialData?.location_display ??
            [initialData?.postcode, initialData?.town].filter(Boolean).join(", ")
          )?.trim()
          ? "typing"
          : "empty",
    );
  }, [
    initialData?.latitude,
    initialData?.location_display,
    initialData?.location_text,
    initialData?.longitude,
    initialData?.place_id,
    initialData?.postcode,
    initialData?.town,
  ]);

  function handleLocationSelect(next: ReturnType<typeof createEmptyEditableLocation>) {
    setForm((current) => ({
      ...current,
      ...next,
      town: next.locality || next.administrative_area,
      postcode: next.postcode,
      location_precision: "full_postcode",
    }));
    setLocationInput(next.location_display || next.formatted_address || next.location_text);
    setLocationState("resolved");
  }

  function replacePendingFiles(documentType: WorkerDocumentType, files: FileList | null) {
    setPendingFiles((current) => ({
      ...current,
      [documentType]: files ? Array.from(files) : [],
    }));
  }

  async function uploadDocuments(workerId: string) {
    const entries = Object.entries(pendingFiles) as Array<[WorkerDocumentType, File[]]>;
    const nextDocuments = [...documents];

    for (const [documentType, files] of entries) {
      if (files.length === 0) {
        continue;
      }

      setActiveUploadType(documentType);
      setUploadStatus(`Uploading ${getWorkerDocumentLabel(documentType)} file${files.length > 1 ? "s" : ""}...`);

      const formData = new FormData();
      formData.append("document_type", documentType);
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(`/api/workers/${workerId}/documents`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? `Unable to upload ${getWorkerDocumentLabel(documentType)} files.`);
      }

      if (Array.isArray(payload.documents)) {
        nextDocuments.unshift(...payload.documents);
      }
    }

    setDocuments(nextDocuments);
    setPendingFiles({
      cscs_card: [],
      id_document: [],
      portfolio: [],
      certificate: [],
      sia_badge: [],
      enhanced_dbs: [],
      dbs: [],
    });
    setFileInputKeys((current) => ({
      cscs_card: current.cscs_card + 1,
      id_document: current.id_document + 1,
      portfolio: current.portfolio + 1,
      certificate: current.certificate + 1,
      sia_badge: current.sia_badge + 1,
      enhanced_dbs: current.enhanced_dbs + 1,
      dbs: current.dbs + 1,
    }));
    setActiveUploadType(null);
  }

  async function handleDeleteDocument(documentId: string) {
    if (method !== "PATCH") {
      return;
    }

    const response = await fetch(`${submitUrl}/documents/${documentId}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.success) {
      setErrors({ form: payload.error ?? "Unable to delete document." });
      return;
    }

    setDocuments((current) => current.filter((document) => document.id !== documentId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createWorkerSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(formatZodErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setSubmitting(true);
    setUploadingDocuments(false);
    setUploadStatus("");
    setActiveUploadType(null);
    setSaveNotice("");

    try {
      const response = await fetch(submitUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          location_text: parsed.data.location_text || locationInput.trim() || "",
          location_display:
            parsed.data.location_display || parsed.data.formatted_address || parsed.data.location_text || "",
          town: parsed.data.locality || parsed.data.administrative_area || parsed.data.town || "",
          postcode: parsed.data.postcode || "",
          location_precision: "full_postcode",
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors({ form: payload.error ?? "Unable to create worker" });
        return;
      }

      const workerId =
        typeof payload?.worker?.worker_id === "string"
          ? payload.worker.worker_id
          : typeof payload?.worker?.id === "string"
            ? payload.worker.id
            : null;

      if (!workerId) {
        setErrors({ form: "Worker saved, but the worker ID was missing from the response." });
        return;
      }

      const hasPendingUploads = Object.values(pendingFiles).some((files) => files.length > 0);

      if (hasPendingUploads) {
        setUploadingDocuments(true);
        await uploadDocuments(workerId);
      }

      notifyMapDataChanged(payload?.worker);

      if (successRedirect) {
        router.push(successRedirect);
        router.refresh();
        return;
      }

      setForm(initialState);
      setLocationInput("");
      setDocuments([]);
      setUploadStatus("");
      setSaveNotice(payload?.warning ?? "Worker saved successfully.");
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "Unable to save worker.",
      });
    } finally {
      setActiveUploadType(null);
      setUploadingDocuments(false);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <label>
        Full Name
        <input
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        {errors.full_name && <span>{errors.full_name}</span>}
      </label>

      <label>
        Mobile
        <input
          type="tel"
          value={form.phone ?? ""}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        {errors.phone && <span>{errors.phone}</span>}
      </label>

      <label>
        Email
        <input
          type="email"
          value={form.email ?? ""}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        {errors.email && <span>{errors.email}</span>}
      </label>

      <label>
        Primary Role
        <select
          value={form.primary_role ?? ""}
          onChange={(event) => setForm({ ...form, primary_role: event.target.value })}
        >
          <option value="">Select role</option>
          {STANDARD_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>

      <LocationAutocompleteInput
        label="Location"
        value={locationInput}
        location={{
          ...createEmptyEditableLocation(locationInput),
          location_text: form.location_text ?? "",
          location_display: form.location_display ?? "",
          location_query: form.location_query ?? "",
          formatted_address: form.formatted_address ?? "",
          place_id: form.place_id ?? "",
          postcode: form.postcode ?? "",
          locality: form.locality ?? "",
          administrative_area: form.administrative_area ?? "",
          country: form.country ?? "",
          latitude: form.latitude,
          longitude: form.longitude,
        }}
        onInputChange={(value) => {
          setLocationInput(value);
          setLocationState(value.trim() ? "typing" : "empty");
          setForm((current) => ({
            ...current,
            ...createEmptyEditableLocation(value),
            town: "",
            postcode: "",
            location_precision: "full_postcode",
          }));
        }}
        onLocationSelect={handleLocationSelect}
        error={errors.location_display}
        helperText="Search and select a real place suggestion. The selected place becomes the saved map location for this worker."
        state={locationState}
      />

      {!form.place_id && !hasValidCoordinates(form) && locationInput.trim() ? (
        <p className="md:col-span-2" style={{ margin: 0, color: "#9a3412" }}>
          This record can still be saved, but it will not appear on the map until location is confirmed.
        </p>
      ) : null}

      <label>
        Status
        <select
          value={form.status}
          onChange={(event) =>
            setForm({
              ...form,
              status: event.target.value as CreateWorkerInput["status"],
            })
          }
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="suspended">suspended</option>
          <option value="archived">archived</option>
        </select>
      </label>

      <label>
        Available Today
        <input
          type="checkbox"
          checked={form.available_today}
          onChange={(event) => setForm({ ...form, available_today: event.target.checked })}
        />
      </label>

      <label>
        Right To Work
        <input
          type="checkbox"
          checked={form.right_to_work}
          onChange={(event) => setForm({ ...form, right_to_work: event.target.checked })}
        />
      </label>

      <label>
        Contract Signed
        <input
          type="checkbox"
          checked={form.contract_signed}
          onChange={(event) => setForm({ ...form, contract_signed: event.target.checked })}
        />
      </label>

      <label>
        WhatsApp Opt-In
        <input
          type="checkbox"
          checked={form.whatsapp_opt_in}
          onChange={(event) => setForm({ ...form, whatsapp_opt_in: event.target.checked })}
        />
      </label>

      <label>
        Priority Tier
        <select
          value={form.priority_tier}
          onChange={(event) =>
            setForm({
              ...form,
              priority_tier: event.target.value as CreateWorkerInput["priority_tier"],
            })
          }
        >
          <option value="standard">standard</option>
          <option value="preferred">preferred</option>
          <option value="vip">vip</option>
          <option value="restricted">restricted</option>
        </select>
      </label>

      <section
        className="md:col-span-2"
        style={{
          padding: "1rem",
          background: "var(--rd-bg-elevated)",
          border: "1px solid var(--rd-border)",
          borderRadius: 8,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1rem" }}>Documents</h2>
        <p style={{ marginTop: 0, marginBottom: "0.75rem", color: "var(--rd-text-muted)" }}>
          Construction roles require CSCS plus DBS uploads. Security roles require SIA and DBS uploads.
          Other roles can upload certificates and portfolio documents.
        </p>
        <div style={{ display: "grid", gap: "1rem" }}>
          {visibleDocumentTypes.map((documentType) => {
            const existingDocuments = documents.filter(
              (document) => document.document_type === documentType,
            );

            return (
              <div key={documentType} style={{ display: "grid", gap: "0.5rem" }}>
                <label>
                  {getWorkerDocumentLabel(documentType)}
                  <input
                    key={`${documentType}-${fileInputKeys[documentType]}`}
                    type="file"
                    multiple={supportsMultipleFiles(documentType)}
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx"
                    onChange={(event) => replacePendingFiles(documentType, event.target.files)}
                    style={{ display: "block", marginTop: "0.25rem" }}
                  />
                </label>

                {pendingFiles[documentType].length > 0 ? (
                  <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
                    Ready to upload: {pendingFiles[documentType].map((file) => file.name).join(", ")}
                  </p>
                ) : null}

                {uploadingDocuments && activeUploadType === documentType ? (
                  <p style={{ margin: 0, color: "#1d4ed8" }}>{uploadStatus}</p>
                ) : null}

                {existingDocuments.length > 0 ? (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {existingDocuments.map((document) => (
                      <div
                        key={document.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          flexWrap: "wrap",
                          padding: "0.75rem",
                          border: "1px solid var(--rd-border)",
                          borderRadius: 8,
                          background: "var(--rd-surface-soft)",
                        }}
                      >
                        <div>
                          <div>{document.file_name}</div>
                          <div style={{ fontSize: "0.875rem", color: "var(--rd-text-muted)" }}>
                            {document.mime_type ?? "Unknown type"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                          {document.file_url ? (
                            <a href={document.file_url} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          ) : null}
                          {method === "PATCH" ? (
                            <button type="button" onClick={() => handleDeleteDocument(document.id)}>
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>No uploaded {getWorkerDocumentLabel(documentType).toLowerCase()} files yet.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {errors.form && <p className="md:col-span-2">{errors.form}</p>}
      {saveNotice ? <p className="md:col-span-2">{saveNotice}</p> : null}
      {uploadingDocuments || uploadStatus ? (
        <p className="md:col-span-2">{uploadingDocuments ? uploadStatus || "Uploading documents..." : uploadStatus}</p>
      ) : null}

      <button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting || uploadingDocuments
          ? uploadingDocuments
            ? "Uploading Documents..."
            : "Saving..."
          : method === "PATCH"
            ? "Update Worker"
            : "Create Worker"}
      </button>
    </form>
  );
}
