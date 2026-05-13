"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getWorkerDocumentLabel,
  isPreviewableImage,
  WORKER_DOCUMENT_TYPES,
  type WorkerDocument,
  type WorkerDocumentType,
} from "@/lib/worker-documents";

export function WorkerDocumentsCarousel({
  documents,
}: {
  documents: WorkerDocument[];
}) {
  const [selectedType, setSelectedType] = useState<WorkerDocumentType | "all">("all");
  const [index, setIndex] = useState(0);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const filteredDocuments = useMemo(
    () =>
      selectedType === "all"
        ? documents
        : documents.filter((document) => document.document_type === selectedType),
    [documents, selectedType],
  );

  useEffect(() => {
    setIndex(0);
  }, [selectedType, documents.length]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [index, selectedType, documents]);

  const activeDocument = filteredDocuments[index] ?? null;
  const documentsByType = new Map<WorkerDocumentType, WorkerDocument[]>();
  for (const document of documents) {
    documentsByType.set(document.document_type, [
      ...(documentsByType.get(document.document_type) ?? []),
      document,
    ]);
  }

  const documentSections = [
    {
      title: "Insurance",
      body: "Option/display area to store/list insurance types and related documents.",
      // TODO: add an insurance document type when the validation schema supports insurance uploads.
      documents: [] as WorkerDocument[],
    },
    {
      title: "CSCS",
      body: "Verification code required. Related document/status area.",
      documents: documentsByType.get("cscs_card") ?? [],
    },
    {
      title: "Enhanced DBS",
      body: "Option to store/show DBS Update Service proof or Enhanced DBS paperwork.",
      documents: [...(documentsByType.get("enhanced_dbs") ?? []), ...(documentsByType.get("dbs") ?? [])],
    },
    {
      title: "Qualifications / NVQ / Certification",
      body: "Option to store/list credentials. Documents must be available for verification.",
      documents: documentsByType.get("certificate") ?? [],
    },
    {
      title: "Accreditations / Memberships",
      body: "Option to store/list accreditations, e.g. SafeContractor. Documents must be available for verification.",
      documents: [] as WorkerDocument[],
    },
  ];

  return (
    <section
      style={{
        marginTop: "1rem",
        paddingTop: "1rem",
        borderTop: "1px solid var(--rd-border)",
      }}
    >
      <div style={{ display: "grid", gap: "0.75rem", marginBottom: "0.9rem" }}>
        <h3 style={{ margin: 0 }}>Documents</h3>
        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
          Verification data will be collected through the contractor validation form before dispatching details to clients.
        </p>
        <div style={{ display: "grid", gap: "0.65rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {documentSections.map((section) => (
            <section
              key={section.title}
              style={{
                border: "1px solid var(--rd-border)",
                borderRadius: 8,
                padding: "0.8rem",
                background: "var(--rd-surface-soft)",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "0.92rem" }}>{section.title}</h4>
              <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>{section.body}</p>
              <p style={{ margin: "0.35rem 0 0", fontWeight: 700 }}>
                {section.documents.length > 0
                  ? `${section.documents.length} document(s) stored`
                  : "No verification documents stored yet."}
              </p>
            </section>
          ))}
        </div>
        {/* TODO: connect these verification document buckets to the contractor validation form when that form is introduced. */}
      </div>

      {documents.length === 0 ? (
        <p style={{ margin: 0 }}>No documents uploaded yet.</p>
      ) : (
        <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <label>
          Document type
          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as WorkerDocumentType | "all")}
            style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
          >
            <option value="all">All</option>
            {WORKER_DOCUMENT_TYPES.map((documentType) => (
              <option key={documentType} value={documentType}>
                {getWorkerDocumentLabel(documentType)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredDocuments.length === 0 ? (
        <p style={{ margin: 0 }}>No documents in this category.</p>
      ) : activeDocument ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.25rem 0.5rem",
                  borderRadius: 999,
                  background: "var(--rd-accent-soft)",
                  border: "1px solid var(--rd-border)",
                  color: "var(--rd-text)",
                  fontSize: "0.875rem",
                }}
              >
                {getWorkerDocumentLabel(activeDocument.document_type)}
              </span>
              <span style={{ fontSize: "0.875rem", color: "var(--rd-text-muted)" }}>
                {index + 1} of {filteredDocuments.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setIndex((current) => (current === 0 ? filteredDocuments.length - 1 : current - 1))}
                aria-label="Previous document"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setIndex((current) => (current === filteredDocuments.length - 1 ? 0 : current + 1))}
                aria-label="Next document"
              >
                Next
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--rd-border)",
              borderRadius: 8,
              padding: "1rem",
              background: "var(--rd-surface-soft)",
            }}
          >
            {activeDocument.file_url &&
            isPreviewableImage(activeDocument.mime_type, activeDocument.file_name) &&
            !imageLoadFailed ? (
              <img
                src={activeDocument.file_url}
                alt={activeDocument.file_name}
                onError={() => setImageLoadFailed(true)}
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "contain",
                  borderRadius: 6,
                  border: "1px solid var(--rd-border)",
                  background: "var(--rd-bg-elevated)",
                }}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "0.5rem",
                  justifyItems: "start",
                  padding: "1rem",
                  background: "var(--rd-bg-elevated)",
                  borderRadius: 6,
                  border: "1px solid var(--rd-border)",
                }}
              >
                <strong>{activeDocument.file_name}</strong>
                <span style={{ color: "var(--rd-text-muted)" }}>
                  {activeDocument.mime_type ?? "Unknown file type"}
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              <span style={{ color: "var(--rd-text-muted)" }}>{activeDocument.file_name}</span>
              {activeDocument.file_url ? (
                <a href={activeDocument.file_url} target="_blank" rel="noreferrer">
                  Open / Download
                </a>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            }}
          >
            {filteredDocuments.map((document, documentIndex) => (
              <button
                key={document.id}
                type="button"
                onClick={() => setIndex(documentIndex)}
                aria-label={`Open ${document.file_name}`}
                style={{
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: documentIndex === index ? "1px solid var(--rd-accent)" : "1px solid var(--rd-border)",
                  background: documentIndex === index ? "var(--rd-accent-soft)" : "var(--rd-bg-elevated)",
                  color: "var(--rd-text)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--rd-text-muted)", marginBottom: "0.25rem" }}>
                  {getWorkerDocumentLabel(document.document_type)}
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {document.file_name}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
