import Link from "next/link";
import { notFound } from "next/navigation";
import { JobProviderForm } from "@/components/forms/JobProviderForm";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CreateJobProviderInput } from "@/lib/validation/schemas";

interface ProviderRow extends CreateJobProviderInput {}

export default async function EditProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const supabase = createAdminSupabaseClient();

  const primary = await supabase
    .from("job_providers")
    .select("name, email, phone, town, postcode, account_tier, billing_status, payg_pack_type, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, is_trial_month, trial_granted_by_admin, trial_start_date, trial_end_date, trial_status, internal_billing_note, success_fee_status, payment_reliability_status, invoices_issued_count, invoices_paid_on_time_count, invoices_paid_late_count, unpaid_invoices_count, part_paid_invoices_count, average_days_to_pay, longest_payment_delay_days, current_overdue_count, payment_disputes_count, contractor_payout_delay_incidents_count, last_payment_received_date, payment_reliability_note, payment_reliability_last_reviewed_at")
    .eq("id", providerId)
    .single();
  const fallback = primary.data
    ? null
    : await supabase
        .from("job_providers")
        .select("name, email, phone, town, postcode")
        .eq("id", providerId)
        .single();
  const provider = primary.data ?? fallback?.data ?? null;

  if (!provider) {
    notFound();
  }

  return (
    <main>
      <p>
        <Link href="/providers">Back to providers</Link>
      </p>
      <h1>Edit Provider</h1>
      <JobProviderForm
        initialData={provider as ProviderRow}
        submitUrl={`/api/providers/${providerId}`}
        method="PATCH"
        successRedirect="/providers"
      />
    </main>
  );
}
