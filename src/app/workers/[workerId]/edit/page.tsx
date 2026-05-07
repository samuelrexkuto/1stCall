import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkerForm } from "@/components/forms/WorkerForm";
import { isSchemaColumnMissing, normalizeWorkerLocationRecord } from "@/lib/location-records";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CreateWorkerInput } from "@/lib/validation/schemas";
import type { WorkerDocument } from "@/lib/worker-documents";

interface WorkerRow extends CreateWorkerInput {}

export default async function EditWorkerPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;
  const supabase = createAdminSupabaseClient();

  const [workerResult, documentsResult] = await Promise.all([
    supabase
      .from("workers")
      .select(
        "full_name, phone, email, primary_role, status, available_today, right_to_work, contract_signed, town, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_precision, latitude, longitude, whatsapp_opt_in, priority_tier",
      )
      .eq("id", workerId)
      .maybeSingle(),
    supabase
      .from("worker_documents")
      .select("id, worker_id, document_type, file_name, file_path, file_url, mime_type, created_at")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false }),
  ]);

  let worker: Record<string, unknown> | null = (workerResult.data as Record<string, unknown> | null) ?? null;

  if (workerResult.error && isSchemaColumnMissing(workerResult.error.message, "workers")) {
    const fallbackResult = await supabase
      .from("workers")
      .select(
        "full_name, phone, email, primary_role, status, available_today, right_to_work, contract_signed, town, postcode, location_display, location_query, location_precision, latitude, longitude, whatsapp_opt_in, priority_tier",
      )
      .eq("id", workerId)
      .maybeSingle();
    worker = (fallbackResult.data as Record<string, unknown> | null) ?? null;
  }

  const documents = documentsResult.data;

  if (!worker) {
    notFound();
  }

  const normalizedLocation = normalizeWorkerLocationRecord(worker as Record<string, unknown>);
  const initialData: WorkerRow = {
    ...(worker as WorkerRow),
    town: normalizedLocation.town ?? "",
    postcode: normalizedLocation.postcode ?? "",
    location_text: normalizedLocation.location_text ?? "",
    location_display: normalizedLocation.location_display ?? "",
    location_query: normalizedLocation.location_query ?? "",
    formatted_address: normalizedLocation.formatted_address ?? "",
    place_id: normalizedLocation.place_id ?? "",
    locality: normalizedLocation.locality ?? "",
    administrative_area: normalizedLocation.administrative_area ?? "",
    country: normalizedLocation.country ?? "",
    location_precision: (normalizedLocation.location_precision as WorkerRow["location_precision"]) ?? "full_postcode",
    latitude: normalizedLocation.latitude ?? null,
    longitude: normalizedLocation.longitude ?? null,
  };

  return (
    <main>
      <p>
        <Link href="/workers">Back to staff</Link>
      </p>
      <h1>Edit Worker</h1>
      <WorkerForm
        initialData={initialData}
        initialDocuments={(documents ?? []) as WorkerDocument[]}
        submitUrl={`/api/workers/${workerId}`}
        method="PATCH"
        successRedirect="/workers"
      />
    </main>
  );
}
