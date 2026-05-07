export function getInvoiceReminder(job: {
  invoice_status?: string | null;
  invoice_send_date?: string | null;
  invoice_due_date?: string | null;
  end_date?: string | null;
}) {
  const now = new Date();

  if (job.invoice_status === "paid") return null;

  if (job.invoice_due_date) {
    const due = new Date(job.invoice_due_date);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);

    if (diffDays < 0) {
      return { tone: "red" as const, text: "Invoice overdue" };
    }
    if (diffDays <= 3) {
      return { tone: "red" as const, text: "Invoice due soon" };
    }
  }

  if (job.invoice_send_date) {
    const send = new Date(job.invoice_send_date);
    const diffDays = Math.ceil((send.getTime() - now.getTime()) / 86400000);

    if (diffDays <= 2 && job.invoice_status !== "sent") {
      return { tone: "red" as const, text: "Invoice send date approaching" };
    }
  }

  if (job.end_date && job.invoice_status === "not_ready") {
    const endDate = new Date(job.end_date);
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
    if (diffDays <= 2) {
      return { tone: "red" as const, text: "Invoice review needed" };
    }
  }

  return null;
}
