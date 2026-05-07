import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildInvoiceEmailHtml,
  formatCurrency,
  type InvoiceEmailTemplateInput,
} from "@/lib/invoices/buildInvoiceEmailHtml";
import { buildInvoiceEmailText } from "@/lib/invoices/buildInvoiceEmailText";
import { isSchemaColumnMissing } from "@/lib/location-records";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function buildInvoiceNumber(jobId: string) {
  return `INV-${jobId.slice(0, 8).toUpperCase()}`;
}

function buildInvoiceSubject(invoiceNumber: string, jobTitle: string) {
  return `Invoice ${invoiceNumber} - ${jobTitle}`;
}

function parseInvoiceMetadata(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { amount: "", notes: "" };
  }

  try {
    const parsed = JSON.parse(value) as { amount?: unknown; notes?: unknown };
    return {
      amount: typeof parsed.amount === "string" ? parsed.amount : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return { amount: value.trim(), notes: "" };
  }
}

function buildInvoiceMetadata(amount: string, notes: string) {
  return JSON.stringify({
    amount: amount.trim(),
    notes: notes.trim(),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { jobId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "preview";

  try {
    const supabase = createAdminSupabaseClient();
    const jobSelect =
      "id, title, area, postcode, starts_at, end_date, pay_rate, provider_id, invoice_status, invoice_send_date, invoice_due_date, invoice_last_sent_at, invoice_notes";
    const providerSelect = "id, name, email";

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(jobSelect)
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      if (isSchemaColumnMissing(jobError.message, "jobs")) {
        return NextResponse.json(
          {
            error:
              "Invoice features are unavailable until the latest jobs invoice migration is applied and the PostgREST schema cache is reloaded.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { data: provider, error: providerError } = await supabase
      .from("job_providers")
      .select(providerSelect)
      .eq("id", job.provider_id)
      .maybeSingle();

    if (providerError) {
      if (
        providerError.message.toLowerCase().includes("column job_providers.email does not exist") ||
        providerError.message.toLowerCase().includes("column public.job_providers.email does not exist") ||
        (providerError.message.toLowerCase().includes("'job_providers'") &&
          providerError.message.toLowerCase().includes("schema cache") &&
          providerError.message.toLowerCase().includes("email"))
      ) {
        return NextResponse.json(
          {
            error:
              "Invoice features are unavailable until provider email support is added to the database and the PostgREST schema cache is reloaded.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: providerError.message }, { status: 500 });
    }

    const providerName = provider?.name ?? "Provider";
    const providerEmail = provider?.email ?? "";
    const invoiceNumber = buildInvoiceNumber(jobId);
    const invoiceSendDate =
      typeof body.invoice_send_date === "string"
        ? body.invoice_send_date
        : job.invoice_send_date ?? "";
    const invoiceDueDate =
      typeof body.invoice_due_date === "string"
        ? body.invoice_due_date
        : job.invoice_due_date ?? "";
    const storedMetadata = parseInvoiceMetadata(job.invoice_notes);
    const amount =
      typeof body.amount_due === "string" && body.amount_due.trim()
        ? body.amount_due.trim()
        : storedMetadata.amount || String(job.pay_rate ?? "");
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : storedMetadata.notes;
    const templateInput: InvoiceEmailTemplateInput = {
      invoiceNumber,
      providerName,
      providerEmail,
      invoiceStatus: job.invoice_status ?? "not_ready",
      sendDate: invoiceSendDate || null,
      dueDate: invoiceDueDate || null,
      amountDue: amount,
      jobTitle: job.title ?? "Job",
      location: [job.area, job.postcode].filter(Boolean).join(" / "),
      startDate: job.starts_at ?? "",
      endDate: job.end_date ?? "",
      notes,
    };
    const subject = buildInvoiceSubject(invoiceNumber, templateInput.jobTitle);
    const html = buildInvoiceEmailHtml(templateInput);
    const text = buildInvoiceEmailText(templateInput);

    if (action === "preview") {
      return NextResponse.json({
        provider_name: providerName,
        provider_email: providerEmail,
        invoice_number: invoiceNumber,
        invoice_status: templateInput.invoiceStatus,
        invoice_send_date: invoiceSendDate,
        invoice_due_date: invoiceDueDate,
        subject,
        html,
        text,
        amount_due: amount,
        amount_due_display: formatCurrency(amount),
        notes,
        job_title: templateInput.jobTitle,
        location: templateInput.location,
        start_date: templateInput.startDate,
        end_date: templateInput.endDate,
      });
    }

    if (action === "save_draft") {
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          invoice_status: "ready_to_send",
          invoice_send_date: invoiceSendDate || null,
          invoice_due_date: invoiceDueDate || null,
          invoice_notes: buildInvoiceMetadata(amount, notes),
        })
        .eq("id", jobId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "ready_to_send" });
    }

    if (action === "send") {
      if (!providerEmail) {
        return NextResponse.json({ error: "Provider email is required before an invoice can be sent." }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Invoice email sending is disabled because the Resend integration has been removed." },
        { status: 501 },
      );
    }

    return NextResponse.json({ error: "Unsupported invoice action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invoice request failed." },
      { status: 500 },
    );
  }
}
