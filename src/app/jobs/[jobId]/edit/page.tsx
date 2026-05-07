import Link from "next/link";
import { notFound } from "next/navigation";
import { JobForm } from "@/components/forms/JobForm";
import { isSchemaColumnMissing, normalizeJobLocationRecord } from "@/lib/location-records";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CreateJobInput } from "@/lib/validation/schemas";

interface ProviderOption {
  provider_id: string;
  company_name: string;
}

interface JobRow extends CreateJobInput {}

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = createAdminSupabaseClient();

  const [providersResult, jobResult] = await Promise.all([
    supabase.from("job_providers").select("id, name").order("name", { ascending: true }),
    supabase
      .from("jobs")
      .select(
        "provider_id, title, required_role, area, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_resolved, location_precision, latitude, longitude, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, duration, end_date, pay_rate, duties, dbs_requirement, ipaf_required, own_tools_required, ppe_required, skills_required, shift_pattern, tickets_required, optional_supporting_notes, payment_type, notes, payment_status, job_status, fill_status, platform_backed_job, platform_backed_status, platform_backed_note, platform_backed_approved_by_admin, platform_backed_payment_terms, walk_off_clause_enabled, worker_payment_protected, payment_terms_days, provider_agreed_terms_verified, worker_agreed_terms_verified",
      )
      .eq("id", jobId)
      .maybeSingle(),
  ]);

  let jobData: Record<string, unknown> | null = (jobResult.data as Record<string, unknown> | null) ?? null;

  if (jobResult.error && isSchemaColumnMissing(jobResult.error.message, "jobs")) {
    const fallbackResult = await supabase
      .from("jobs")
      .select(
        "provider_id, title, required_role, area, postcode, location_display, location_query, location_precision, latitude, longitude, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, duration, end_date, pay_rate, duties, dbs_requirement, ipaf_required, own_tools_required, ppe_required, skills_required, shift_pattern, tickets_required, optional_supporting_notes, payment_type, notes, payment_status, job_status, fill_status",
      )
      .eq("id", jobId)
      .maybeSingle();
    jobData = (fallbackResult.data as Record<string, unknown> | null) ?? null;
  }

  const providers = (providersResult.data ?? []).map((provider) => ({
    provider_id: String(provider.id),
    company_name: provider.name,
  })) as ProviderOption[];
  const job = jobData
    ? (() => {
        const normalizedLocation = normalizeJobLocationRecord(jobData as Record<string, unknown>);
        return {
        ...jobData,
        provider_id: jobData.provider_id ?? "",
        required_role: jobData.required_role ?? "",
        area: normalizedLocation.area ?? "",
        postcode: normalizedLocation.postcode ?? "",
        location_text: normalizedLocation.location_text ?? "",
        location_display: normalizedLocation.location_display ?? "",
        location_query: normalizedLocation.location_query ?? "",
        formatted_address: normalizedLocation.formatted_address ?? "",
        place_id: normalizedLocation.place_id ?? "",
        locality: normalizedLocation.locality ?? "",
        administrative_area: normalizedLocation.administrative_area ?? "",
        country: normalizedLocation.country ?? "",
        location_resolved:
          Boolean((jobData as { location_resolved?: boolean | null }).location_resolved) ||
          Boolean(normalizedLocation.place_id && normalizedLocation.latitude != null && normalizedLocation.longitude != null),
        location_precision: (normalizedLocation.location_precision as JobRow["location_precision"]) ?? "custom_address",
        latitude: normalizedLocation.latitude ?? null,
        longitude: normalizedLocation.longitude ?? null,
        starts_at: jobData.starts_at ? String(jobData.starts_at).slice(0, 16) : "",
        end_date: jobData.end_date ? String(jobData.end_date).slice(0, 10) : "",
        notes: jobData.notes ?? "",
      } as JobRow;
      })()
    : null;

  if (!job) {
    notFound();
  }

  return (
    <main>
      <p>
        <Link href="/jobs">Back to jobs</Link>
      </p>
      <h1>Edit Job</h1>
      <JobForm
        providers={providers}
        initialData={job}
        submitUrl={`/api/jobs/${jobId}`}
        method="PUT"
        successRedirect="/jobs"
        submitLabel="Update Job"
      />
    </main>
  );
}
