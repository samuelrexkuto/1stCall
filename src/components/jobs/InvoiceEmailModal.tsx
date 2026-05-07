"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/invoices/buildInvoiceEmailHtml";

interface InvoiceTarget {
  job_id: string;
  job_title: string;
  company_name: string;
  provider_email?: string | null;
  area: string | null;
  postcode: string;
  start_date: string;
  end_date?: string | null;
  pay_rate_display?: string | null;
  invoice_status?: string | null;
  invoice_send_date?: string | null;
  invoice_due_date?: string | null;
  invoice_notes?: string | null;
}

interface InvoicePreview {
  providerName: string;
  providerEmail: string;
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceSendDate: string;
  invoiceDueDate: string;
  subject: string;
  amountDue: string;
  amountDueDisplay: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string;
  notes: string;
  html: string;
  text: string;
}

export function InvoiceEmailModal({
  job,
  open,
  onClose,
  onSaved,
}: {
  job: InvoiceTarget | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<InvoicePreview | null>(null);

  useEffect(() => {
    if (!open || !job) {
      return;
    }

    const activeJob = job;
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/jobs/${activeJob.job_id}/invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preview" }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load invoice email preview.");
        }

        if (!cancelled) {
          setPreview({
            providerName: payload.provider_name ?? activeJob.company_name,
            providerEmail: payload.provider_email ?? "",
            invoiceNumber: payload.invoice_number ?? "",
            invoiceStatus: payload.invoice_status ?? "not_ready",
            invoiceSendDate: payload.invoice_send_date ?? "",
            invoiceDueDate: payload.invoice_due_date ?? "",
            subject: payload.subject ?? "",
            amountDue: payload.amount_due ?? activeJob.pay_rate_display ?? "",
            amountDueDisplay: payload.amount_due_display ?? "",
            jobTitle: payload.job_title ?? activeJob.job_title,
            location: payload.location ?? [activeJob.area, activeJob.postcode].filter(Boolean).join(" / "),
            startDate: payload.start_date ?? activeJob.start_date,
            endDate: payload.end_date ?? activeJob.end_date ?? "",
            notes: payload.notes ?? "",
            html: payload.html ?? "",
            text: payload.text ?? "",
          });
        }
      } catch (previewError) {
        if (!cancelled) {
          setError(previewError instanceof Error ? previewError.message : "Unable to load invoice email preview.");
          setPreview(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [job, open]);

  async function handleAction(action: "save_draft" | "send") {
    if (!job || !preview) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/jobs/${job.job_id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          invoice_send_date: preview.invoiceSendDate,
          invoice_due_date: preview.invoiceDueDate,
          amount_due: preview.amountDue,
          notes: preview.notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? `Unable to ${action === "send" ? "send invoice" : "save invoice draft"}.`);
      }

      onSaved?.();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Invoice action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const providerEmailMissing = !preview?.providerEmail?.trim();

  return (
    <Modal
      open={open}
      title={job ? `Invoice Email - ${job.job_title}` : "Invoice Email"}
      onClose={onClose}
    >
      {loading ? <p>Loading invoice draft...</p> : null}
      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, padding: "0.8rem" }}>
          {error}
        </div>
      ) : null}
      {preview ? (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          <label>
            Provider
            <input value={preview.providerName} readOnly />
          </label>
          <label>
            Provider email
            <input value={preview.providerEmail} readOnly style={providerEmailMissing ? { border: "1px solid #dc2626", background: "#fef2f2" } : undefined} />
            {providerEmailMissing ? (
              <p style={{ margin: "0.35rem 0 0", color: "#dc2626" }}>
                Provider email is required before an invoice can be sent.
              </p>
            ) : null}
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label>
              Invoice number
              <input value={preview.invoiceNumber} readOnly />
            </label>
            <label>
              Invoice status
              <input value={preview.invoiceStatus} readOnly />
            </label>
            <label>
              Invoice send date
              <input
                type="date"
                value={preview.invoiceSendDate}
                onChange={(event) =>
                  setPreview((current) => (current ? { ...current, invoiceSendDate: event.target.value } : current))
                }
              />
            </label>
            <label>
              Invoice due date
              <input
                type="date"
                value={preview.invoiceDueDate}
                onChange={(event) =>
                  setPreview((current) => (current ? { ...current, invoiceDueDate: event.target.value } : current))
                }
              />
            </label>
            <label>
              Amount due
              <input
                value={preview.amountDue}
                onChange={(event) =>
                  setPreview((current) =>
                    current
                      ? {
                          ...current,
                          amountDue: event.target.value,
                          amountDueDisplay: formatCurrency(event.target.value),
                        }
                      : current,
                  )
                }
              />
            </label>
          </div>
          <label>
            Subject
            <input value={preview.subject} readOnly />
          </label>
          <label>
            Additional notes
            <textarea
              value={preview.notes}
              onChange={(event) =>
                setPreview((current) => (current ? { ...current, notes: event.target.value } : current))
              }
              rows={4}
              placeholder="Optional notes to appear below the invoice breakdown"
            />
          </label>
          <div
            style={{
              border: "1px solid #dbe4ee",
              borderRadius: 18,
              background: "#ffffff",
              padding: "1rem",
              display: "grid",
              gap: "0.9rem",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                Invoice preview
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>Invoice</div>
                  <div style={{ marginTop: 4, color: "#475569" }}>Recruited Dispatch</div>
                </div>
                <div style={{ textAlign: "right", color: "#334155", fontSize: 14 }}>
                  <div><strong>Invoice #:</strong> {preview.invoiceNumber}</div>
                  <div><strong>Issue Date:</strong> {formatDate(preview.invoiceSendDate)}</div>
                  <div><strong>Due Date:</strong> {formatDate(preview.invoiceDueDate)}</div>
                  <div><strong>Status:</strong> {preview.invoiceStatus}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div style={{ padding: "0.85rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>Billed to</div>
                <div style={{ marginTop: 8, fontWeight: 700, color: "#0f172a" }}>{preview.providerName}</div>
                <div style={{ marginTop: 4, color: "#475569", fontSize: 14 }}>{preview.providerEmail || "—"}</div>
              </div>
              <div style={{ padding: "0.85rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>Booking summary</div>
                <div style={{ marginTop: 8, color: "#334155", fontSize: 14, lineHeight: 1.7 }}>
                  <div><strong>Job:</strong> {preview.jobTitle}</div>
                  <div><strong>Location:</strong> {preview.location || "—"}</div>
                  <div><strong>Start:</strong> {formatDate(preview.startDate)}</div>
                  <div><strong>End:</strong> {formatDate(preview.endDate)}</div>
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th align="left" style={{ padding: "12px 10px", borderBottom: "2px solid #cbd5e1", color: "#0f172a" }}>Description</th>
                    <th align="left" style={{ padding: "12px 10px", borderBottom: "2px solid #cbd5e1", color: "#0f172a" }}>Qty</th>
                    <th align="right" style={{ padding: "12px 10px", borderBottom: "2px solid #cbd5e1", color: "#0f172a" }}>Unit Price</th>
                    <th align="right" style={{ padding: "12px 10px", borderBottom: "2px solid #cbd5e1", color: "#0f172a" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "14px 10px", borderBottom: "1px solid #e2e8f0", color: "#334155" }}>{preview.jobTitle} booking</td>
                    <td style={{ padding: "14px 10px", borderBottom: "1px solid #e2e8f0", color: "#334155" }}>1</td>
                    <td align="right" style={{ padding: "14px 10px", borderBottom: "1px solid #e2e8f0", color: "#334155" }}>{preview.amountDueDisplay || formatCurrency(preview.amountDue)}</td>
                    <td align="right" style={{ padding: "14px 10px", borderBottom: "1px solid #e2e8f0", color: "#334155" }}>{preview.amountDueDisplay || formatCurrency(preview.amountDue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#334155" }}>
                  <span>Subtotal:</span>
                  <strong>{preview.amountDueDisplay || formatCurrency(preview.amountDue)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#0f172a", fontSize: 18, fontWeight: 700 }}>
                  <span>Total:</span>
                  <span>{preview.amountDueDisplay || formatCurrency(preview.amountDue)}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleAction("save_draft")} disabled={submitting}>
              {submitting ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" onClick={() => handleAction("send")} disabled={submitting || providerEmailMissing}>
              {submitting ? "Sending..." : "Send Invoice"}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
