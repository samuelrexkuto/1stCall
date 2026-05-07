import type { InvoiceEmailTemplateInput } from "@/lib/invoices/buildInvoiceEmailHtml";
import { formatCurrency, formatDate } from "@/lib/invoices/buildInvoiceEmailHtml";

export function buildInvoiceEmailText(input: InvoiceEmailTemplateInput) {
  return `Invoice ${input.invoiceNumber}

Provider: ${input.providerName}
Provider email: ${input.providerEmail}
Invoice status: ${input.invoiceStatus}
Issue date: ${formatDate(input.sendDate)}
Due date: ${formatDate(input.dueDate)}
Job: ${input.jobTitle}
Location: ${input.location}
Start: ${formatDate(input.startDate)}
End: ${formatDate(input.endDate)}
Amount due: ${formatCurrency(input.amountDue)}

${input.notes ? `Notes: ${input.notes}` : ""}`.trim();
}
