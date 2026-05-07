import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  resolveSavedCoordinates,
} from "@/lib/maps/geocode";
import { buildResolvedLocationPayload, buildWorkerCompatibilityLocation, hasValidCoordinates } from "@/lib/location";
import { isSchemaColumnMissing, normalizeWorkerLocationRecord } from "@/lib/location-records";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deriveWhatsappNumber, normalizeUkPhoneNumber } from "@/lib/phone";
import { createWorkerSchema } from "@/lib/validation/schemas";
import { WORKER_DOCUMENT_BUCKET } from "@/lib/worker-documents";
import { getWorkerReadiness } from "@/lib/workers/getWorkerReadiness";

function mapWorker(worker: Record<string, unknown>) {
  const location = normalizeWorkerLocationRecord(worker);
  const phone = typeof worker.phone === "string" ? worker.phone : null;
  const whatsappOptIn = Boolean(worker.whatsapp_opt_in);

  return {
    id: String(worker.id),
    worker_id: String(worker.id),
    full_name: String(worker.full_name ?? ""),
    phone,
    email: typeof worker.email === "string" ? worker.email : null,
    primary_role: typeof worker.primary_role === "string" ? worker.primary_role : null,
    town: location.town,
    postcode: location.postcode ?? "",
    location_text: location.location_text,
    location_display: location.location_display,
    location_query: location.location_query,
    formatted_address: location.formatted_address,
    place_id: location.place_id,
    locality: location.locality,
    administrative_area: location.administrative_area,
    country: location.country,
    location_precision: location.location_precision,
    latitude: location.latitude,
    longitude: location.longitude,
    status: typeof worker.status === "string" ? worker.status : "active",
    available_today: Boolean(worker.available_today),
    right_to_work: Boolean(worker.right_to_work),
    contract_signed: Boolean(worker.contract_signed),
    contract_status: typeof worker.contract_status === "string" ? worker.contract_status : null,
    contract_signed_at: typeof worker.contract_signed_at === "string" ? worker.contract_signed_at : null,
    onboarding_status: typeof worker.onboarding_status === "string" ? worker.onboarding_status : null,
    id_document_uploaded: Boolean(worker.id_document_uploaded),
    cscs_uploaded: Boolean(worker.cscs_uploaded),
    portfolio_uploaded: Boolean(worker.portfolio_uploaded),
    certificates_uploaded: Boolean(worker.certificates_uploaded),
    work_readiness: getWorkerReadiness(worker),
    whatsapp_opt_in: whatsappOptIn,
    whatsapp_number: deriveWhatsappNumber(phone, whatsappOptIn),
    priority_tier: typeof worker.priority_tier === "string" ? worker.priority_tier : "standard",
    skill_tags: [],
    expected_rate: 0,
    reliability_score: 0,
    created_at: String(worker.created_at ?? ""),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workerId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { workerId } = await params;
  const json = await request.json();
  const parsed = createWorkerSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid worker payload." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    const normalizedPhone = normalizeUkPhoneNumber(parsed.data.phone);
    const existingSelect =
      "id, town, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_precision, latitude, longitude";
    const fallbackExistingSelect = "id, town, postcode, location_display, location_query, location_precision, latitude, longitude";
    let { data: existingWorker, error: existingError } = await supabase
      .from("workers")
      .select(existingSelect)
      .eq("id", workerId)
      .maybeSingle();

    if (existingError && isSchemaColumnMissing(existingError.message, "workers")) {
      ({ data: existingWorker, error: existingError } = await supabase
        .from("workers")
        .select(fallbackExistingSelect)
        .eq("id", workerId)
        .maybeSingle());
    }

    if (existingError) {
      console.error("[workers:update] failed to load existing worker", existingError);
      return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
    }

    if (!existingWorker) {
      return NextResponse.json({ success: false, error: "Worker not found." }, { status: 404 });
    }

    const locationResult = buildResolvedLocationPayload({
      input: {
        location_text: parsed.data.location_text,
        location_display: parsed.data.location_display,
        location_query: parsed.data.location_query,
        formatted_address: parsed.data.formatted_address,
        place_id: parsed.data.place_id,
        postcode: parsed.data.postcode,
        locality: parsed.data.locality,
        administrative_area: parsed.data.administrative_area,
        country: parsed.data.country,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      },
      rawText: parsed.data.location_text,
      existing: normalizeWorkerLocationRecord(existingWorker as Record<string, unknown>),
    });
    const location = locationResult.location;
    const resolvedCoordinates = locationResult.shouldResolveCoordinates
      ? await resolveSavedCoordinates({
          placeId: location.place_id,
          formattedAddress: location.formatted_address,
          manualLatitude: location.latitude,
          manualLongitude: location.longitude,
        })
      : hasValidCoordinates(location)
        ? {
            latitude: location.latitude as number,
            longitude: location.longitude as number,
          }
        : null;
    const locationWarning =
      !locationResult.isConfirmed
        ? "Location needs confirmation before this worker can appear on the map."
        : null;
    const compatibilityLocation = buildWorkerCompatibilityLocation(location);
    const fullPayload = {
      full_name: parsed.data.full_name,
      phone: normalizedPhone,
      email: parsed.data.email || null,
      primary_role: parsed.data.primary_role || null,
      status: parsed.data.status,
      town: compatibilityLocation.town,
      postcode: compatibilityLocation.postcode,
      location_text: location.location_text,
      location_display: location.location_display,
      location_query: location.location_query,
      formatted_address: location.formatted_address,
      place_id: location.place_id,
      locality: location.locality,
      administrative_area: location.administrative_area,
      country: location.country,
      location_precision: "full_postcode",
      latitude: resolvedCoordinates?.latitude ?? location.latitude ?? null,
      longitude: resolvedCoordinates?.longitude ?? location.longitude ?? null,
      available_today: parsed.data.available_today,
      right_to_work: parsed.data.right_to_work,
      contract_signed: parsed.data.contract_signed,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in,
      priority_tier: parsed.data.priority_tier,
    };
    const legacyPayload = {
      full_name: fullPayload.full_name,
      phone: fullPayload.phone,
      email: fullPayload.email,
      primary_role: fullPayload.primary_role,
      status: fullPayload.status,
      town: fullPayload.town,
      postcode: fullPayload.postcode,
      location_display: fullPayload.location_display,
      location_query: fullPayload.location_query,
      location_precision: fullPayload.location_precision,
      latitude: fullPayload.latitude,
      longitude: fullPayload.longitude,
      available_today: fullPayload.available_today,
      right_to_work: fullPayload.right_to_work,
      contract_signed: fullPayload.contract_signed,
      whatsapp_opt_in: fullPayload.whatsapp_opt_in,
      priority_tier: fullPayload.priority_tier,
    };
    const fullSelect =
      "id, full_name, phone, email, primary_role, town, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_precision, latitude, longitude, status, available_today, right_to_work, contract_signed, contract_status, contract_signed_at, onboarding_status, id_document_uploaded, cscs_uploaded, portfolio_uploaded, certificates_uploaded, whatsapp_opt_in, priority_tier, created_at";
    const fallbackSelect =
      "id, full_name, phone, email, primary_role, town, postcode, location_display, location_query, location_precision, latitude, longitude, status, available_today, right_to_work, contract_signed, whatsapp_opt_in, priority_tier, created_at";

    let { data, error } = await supabase.from("workers").update(fullPayload).eq("id", workerId).select(fullSelect).single();

    if (error && isSchemaColumnMissing(error.message, "workers")) {
      ({ data, error } = await supabase
        .from("workers")
        .update(legacyPayload)
        .eq("id", workerId)
        .select(fallbackSelect)
        .single());
    }

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Worker not found." }, { status: 404 });
      }

      console.error("[workers:update] update failed", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      worker: data ? mapWorker(data as Record<string, unknown>) : null,
      warning: locationWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update worker";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workerId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { workerId } = await params;

  try {
    const supabase = createAdminSupabaseClient();
    const { data: documents, error: documentsError } = await supabase
      .from("worker_documents")
      .select("file_path")
      .eq("worker_id", workerId);

    if (documentsError && documentsError.code !== "PGRST205") {
      return NextResponse.json({ success: false, error: documentsError.message }, { status: 500 });
    }

    const filePaths = (documents ?? [])
      .map((document) => document.file_path)
      .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);

    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(WORKER_DOCUMENT_BUCKET)
        .remove(filePaths);

      if (storageError) {
        return NextResponse.json({ success: false, error: storageError.message }, { status: 500 });
      }
    }

    const { error, count } = await supabase
      .from("workers")
      .delete({ count: "exact" })
      .eq("id", workerId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({ success: false, error: "Worker not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete worker";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
