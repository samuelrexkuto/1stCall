export type InvoiceEmailTemplateInput = {
  invoiceNumber: string;
  providerName: string;
  providerEmail: string;
  invoiceStatus: string;
  sendDate: string | null;
  dueDate: string | null;
  amountDue: number | string;
  jobTitle: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  notes?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatCurrency(value: number | string) {
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^\d.-]/g, "") || 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function buildInvoiceEmailHtml(input: InvoiceEmailTemplateInput) {
  const amount = formatCurrency(input.amountDue);
  const providerName = escapeHtml(input.providerName || "Provider");
  const providerEmail = escapeHtml(input.providerEmail || "—");
  const invoiceStatus = escapeHtml(input.invoiceStatus || "not_ready");
  const invoiceNumber = escapeHtml(input.invoiceNumber);
  const jobTitle = escapeHtml(input.jobTitle || "Job booking");
  const location = escapeHtml(input.location || "—");
  const notes = input.notes?.trim() ? escapeHtml(input.notes.trim()) : "";

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#f8fafc; padding:32px; color:#0f172a;">
    <div style="max-width:800px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
      <div style="padding:24px 32px; background:#0f172a; color:#ffffff;">
        <h1 style="margin:0; font-size:28px; line-height:1.2;">Invoice</h1>
        <p style="margin:8px 0 0; font-size:14px; color:#cbd5e1;">
          Recruited Dispatch
        </p>
      </div>
      <div style="padding:32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
          <tr>
            <td style="vertical-align:top; padding-right:16px;">
              <div style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin-bottom:8px;">Billed To</div>
              <div style="font-size:18px; font-weight:700; color:#0f172a;">${providerName}</div>
              <div style="font-size:14px; color:#475569; margin-top:4px;">${providerEmail}</div>
            </td>
            <td style="vertical-align:top; text-align:right;">
              <div style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin-bottom:8px;">Invoice Details</div>
              <div style="font-size:14px; color:#0f172a;"><strong>Invoice #:</strong> ${invoiceNumber}</div>
              <div style="font-size:14px; color:#0f172a; margin-top:4px;"><strong>Issue Date:</strong> ${escapeHtml(formatDate(input.sendDate))}</div>
              <div style="font-size:14px; color:#0f172a; margin-top:4px;"><strong>Due Date:</strong> ${escapeHtml(formatDate(input.dueDate))}</div>
              <div style="font-size:14px; color:#0f172a; margin-top:4px;"><strong>Status:</strong> ${invoiceStatus}</div>
            </td>
          </tr>
        </table>
        <div style="margin-bottom:20px;">
          <div style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin-bottom:8px;">Booking Summary</div>
          <div style="font-size:15px; color:#0f172a; line-height:1.7;">
            <div><strong>Job:</strong> ${jobTitle}</div>
            <div><strong>Location:</strong> ${location}</div>
            <div><strong>Start:</strong> ${escapeHtml(formatDate(input.startDate))}</div>
            <div><strong>End:</strong> ${escapeHtml(formatDate(input.endDate))}</div>
          </div>
        </div>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin-top:20px; margin-bottom:24px;">
          <thead>
            <tr>
              <th align="left" style="padding:14px 12px; border-bottom:2px solid #cbd5e1; font-size:14px; color:#0f172a;">Description</th>
              <th align="left" style="padding:14px 12px; border-bottom:2px solid #cbd5e1; font-size:14px; color:#0f172a;">Qty</th>
              <th align="right" style="padding:14px 12px; border-bottom:2px solid #cbd5e1; font-size:14px; color:#0f172a;">Unit Price</th>
              <th align="right" style="padding:14px 12px; border-bottom:2px solid #cbd5e1; font-size:14px; color:#0f172a;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:16px 12px; border-bottom:1px solid #e2e8f0; font-size:14px; color:#334155;">
                ${jobTitle} booking
              </td>
              <td style="padding:16px 12px; border-bottom:1px solid #e2e8f0; font-size:14px; color:#334155;">
                1
              </td>
              <td align="right" style="padding:16px 12px; border-bottom:1px solid #e2e8f0; font-size:14px; color:#334155;">
                ${escapeHtml(amount)}
              </td>
              <td align="right" style="padding:16px 12px; border-bottom:1px solid #e2e8f0; font-size:14px; color:#334155;">
                ${escapeHtml(amount)}
              </td>
            </tr>
          </tbody>
        </table>
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
          <tr>
            <td></td>
            <td width="260">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:6px 0; font-size:15px; color:#334155;">Subtotal:</td>
                  <td align="right" style="padding:6px 0; font-size:15px; color:#334155;">${escapeHtml(amount)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-size:15px; color:#334155; font-weight:700;">Total:</td>
                  <td align="right" style="padding:6px 0; font-size:18px; color:#0f172a; font-weight:700;">${escapeHtml(amount)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${
          notes
            ? `
          <div style="margin-top:24px;">
            <div style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin-bottom:8px;">Additional Notes</div>
            <div style="font-size:14px; color:#475569; line-height:1.7;">${notes}</div>
          </div>
        `
            : ""
        }
        <div style="margin-top:32px; font-size:14px; color:#475569; line-height:1.7;">
          Please arrange payment by the due date shown above.
        </div>
      </div>
    </div>
  </div>
  `;
}
