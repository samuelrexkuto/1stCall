import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadJobsOverview, normalizeJobsSchemaError } from "@/lib/jobs";
import {
  resolveSavedCoordinates,
} from "@/lib/maps/geocode";
import { formatPayRate } from "@/lib/jobs/formatPayRate";
import { buildJobCompatibilityLocation, buildResolvedLocationPayload, hasValidCoordinates } from "@/lib/location";
import { isSchemaColumnMissing } from "@/lib/location-records";
import { createJobSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    console.log("[api/jobs] start");
    const data = await loadJobsOverview({
      title: searchParams.get("title")?.trim() ?? "",
      role: searchParams.get("role")?.trim() ?? "",
      area: searchParams.get("area")?.trim() ?? "",
      postcode: searchParams.get("postcode")?.trim() ?? "",
      provider: searchParams.get("provider")?.trim() ?? "",
      job_status: searchParams.get("job_status")?.trim() ?? "",
      fill_status: searchParams.get("fill_status")?.trim() ?? searchParams.get("status")?.trim() ?? "",
      payment_status: searchParams.get("payment_status")?.trim() ?? "",
      broadcast_status: searchParams.get("broadcast_status")?.trim() ?? "",
    });
    console.log("[api/jobs] success", { count: data.jobs.length });
    return NextResponse.json({
      ok: true,
      success: true,
      data,
      jobs: data.jobs,
      providers: data.providers,
      warning: data.warning,
      capabilities: data.capabilities,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("[api/jobs] failed", error);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: "Jobs query failed",
        details:
          error instanceof Error
            ? error.message
            : "Missing required database column or schema mismatch",
        data: null,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  }
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = createJobSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid job payload." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
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
        ? "Location needs confirmation before this job can appear on the map."
        : null;
    const compatibilityLocation = buildJobCompatibilityLocation(location);
    const fullPayload = {
      provider_id: parsed.data.provider_id,
      title: parsed.data.title,
      required_role: parsed.data.required_role,
      area: compatibilityLocation.area,
      postcode: compatibilityLocation.postcode,
      location_text: location.location_text,
      location_display: location.location_display,
      location_query: location.location_query,
      formatted_address: location.formatted_address,
      place_id: location.place_id,
      locality: location.locality,
      administrative_area: location.administrative_area,
      country: location.country,
      location_resolved: locationResult.isConfirmed,
      location_precision: "custom_address",
      latitude: resolvedCoordinates?.latitude ?? location.latitude ?? null,
      longitude: resolvedCoordinates?.longitude ?? location.longitude ?? null,
      job_status: parsed.data.job_status,
      broadcast_status: "broadcast ready",
      fill_status: parsed.data.fill_status,
      payment_status: parsed.data.payment_status,
      headcount_required: parsed.data.headcount_required,
      headcount_confirmed: parsed.data.headcount_confirmed,
      starts_at: parsed.data.starts_at,
      alert_type: parsed.data.alert_type,
      core_role: parsed.data.core_role,
      selected_role: parsed.data.selected_role,
      trade: parsed.data.trade,
      location_label: parsed.data.location_label,
      location_confirmed: parsed.data.location_confirmed,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      time_window: parsed.data.time_window,
      duration: parsed.data.duration,
      end_date: parsed.data.end_date,
      pay_rate: parsed.data.pay_rate,
      pay_rate_amount: parsed.data.pay_rate_amount,
      pay_rate_unit: parsed.data.pay_rate_unit,
      duties: parsed.data.duties,
      dbs_required: parsed.data.dbs_required,
      dbs_requirement: parsed.data.dbs_requirement,
      enhanced_dbs_required: parsed.data.enhanced_dbs_required,
      cscs_required: parsed.data.cscs_required,
      ipaf_required: parsed.data.ipaf_required,
      own_tools_required: parsed.data.own_tools_required,
      tools_required: parsed.data.tools_required,
      ppe_required: parsed.data.ppe_required,
      ppe_detail: parsed.data.ppe_detail,
      skills_required: parsed.data.skills_required,
      requirements: parsed.data.requirements,
      shift_pattern: parsed.data.shift_pattern,
      tickets_required: parsed.data.tickets_required,
      certificates_required: parsed.data.certificates_required,
      optional_supporting_notes: parsed.data.optional_supporting_notes,
      selected_keywords: parsed.data.selected_keywords,
      payment_type: parsed.data.payment_type,
      notes: parsed.data.notes || null,
      platform_backed_job: parsed.data.platform_backed_job,
      platform_backed_status: parsed.data.platform_backed_status,
      platform_backed_note: parsed.data.platform_backed_note,
      platform_backed_approved_by_admin: parsed.data.platform_backed_approved_by_admin,
      platform_backed_payment_terms: parsed.data.platform_backed_payment_terms,
      walk_off_clause_enabled: parsed.data.walk_off_clause_enabled,
      worker_payment_protected: parsed.data.worker_payment_protected,
      payment_terms_days: parsed.data.payment_terms_days,
      provider_agreed_terms_verified: parsed.data.provider_agreed_terms_verified,
      worker_agreed_terms_verified: parsed.data.worker_agreed_terms_verified,
    };
    const legacyPayload = {
      provider_id: fullPayload.provider_id,
      title: fullPayload.title,
      required_role: fullPayload.required_role,
      area: fullPayload.area,
      postcode: fullPayload.postcode,
      location_display: fullPayload.location_display,
      location_query: fullPayload.location_query,
      location_resolved: fullPayload.location_resolved,
      location_precision: fullPayload.location_precision,
      latitude: fullPayload.latitude,
      longitude: fullPayload.longitude,
      job_status: fullPayload.job_status,
      broadcast_status: fullPayload.broadcast_status,
      fill_status: fullPayload.fill_status,
      payment_status: fullPayload.payment_status,
      headcount_required: fullPayload.headcount_required,
      headcount_confirmed: fullPayload.headcount_confirmed,
      starts_at: fullPayload.starts_at,
      alert_type: fullPayload.alert_type,
      core_role: fullPayload.core_role,
      selected_role: fullPayload.selected_role,
      trade: fullPayload.trade,
      location_label: fullPayload.location_label,
      location_confirmed: fullPayload.location_confirmed,
      start_time: fullPayload.start_time,
      end_time: fullPayload.end_time,
      time_window: fullPayload.time_window,
      duration: fullPayload.duration,
      end_date: fullPayload.end_date,
      pay_rate: fullPayload.pay_rate,
      pay_rate_amount: fullPayload.pay_rate_amount,
      pay_rate_unit: fullPayload.pay_rate_unit,
      duties: fullPayload.duties,
      dbs_required: fullPayload.dbs_required,
      dbs_requirement: fullPayload.dbs_requirement,
      enhanced_dbs_required: fullPayload.enhanced_dbs_required,
      cscs_required: fullPayload.cscs_required,
      ipaf_required: fullPayload.ipaf_required,
      own_tools_required: fullPayload.own_tools_required,
      tools_required: fullPayload.tools_required,
      ppe_required: fullPayload.ppe_required,
      ppe_detail: fullPayload.ppe_detail,
      skills_required: fullPayload.skills_required,
      requirements: fullPayload.requirements,
      shift_pattern: fullPayload.shift_pattern,
      tickets_required: fullPayload.tickets_required,
      certificates_required: fullPayload.certificates_required,
      optional_supporting_notes: fullPayload.optional_supporting_notes,
      selected_keywords: fullPayload.selected_keywords,
      payment_type: fullPayload.payment_type,
      notes: fullPayload.notes,
    };
    const fullSelect =
      "id, title, required_role, area, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_resolved, location_precision, latitude, longitude, provider_id, job_status, fill_status, payment_status, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, selected_role, trade, location_label, location_confirmed, start_time, end_time, time_window, duration, end_date, pay_rate, pay_rate_amount, pay_rate_unit, duties, dbs_required, dbs_requirement, enhanced_dbs_required, cscs_required, ipaf_required, own_tools_required, tools_required, ppe_required, ppe_detail, skills_required, requirements, shift_pattern, tickets_required, certificates_required, optional_supporting_notes, selected_keywords, payment_type, notes, platform_backed_job, platform_backed_status, platform_backed_note, platform_backed_approved_by_admin, platform_backed_payment_terms, walk_off_clause_enabled, worker_payment_protected, payment_terms_days, provider_agreed_terms_verified, worker_agreed_terms_verified, created_at";
    const fallbackSelect =
      "id, title, required_role, area, postcode, location_display, location_query, location_resolved, location_precision, latitude, longitude, provider_id, job_status, fill_status, payment_status, headcount_required, headcount_confirmed, starts_at, alert_type, core_role, selected_role, trade, location_label, location_confirmed, start_time, end_time, time_window, duration, end_date, pay_rate, pay_rate_amount, pay_rate_unit, duties, dbs_required, dbs_requirement, enhanced_dbs_required, cscs_required, ipaf_required, own_tools_required, tools_required, ppe_required, ppe_detail, skills_required, requirements, shift_pattern, tickets_required, certificates_required, optional_supporting_notes, selected_keywords, payment_type, notes, created_at";
    const compactPayload = {
      provider_id: fullPayload.provider_id,
      title: fullPayload.title,
      required_role: fullPayload.required_role,
      area: fullPayload.area,
      postcode: fullPayload.postcode,
      job_status: fullPayload.job_status,
      fill_status: fullPayload.fill_status,
      payment_status: fullPayload.payment_status,
      headcount_required: fullPayload.headcount_required,
      headcount_confirmed: fullPayload.headcount_confirmed,
      starts_at: fullPayload.starts_at,
      notes: fullPayload.notes,
    };
    const compactSelect =
      "id, title, required_role, area, postcode, provider_id, job_status, fill_status, payment_status, headcount_required, headcount_confirmed, starts_at, notes, created_at";

    // Try inserting with full payload first
    let { data, error } = await supabase.from("jobs").insert(fullPayload).select(fullSelect).single();

    // If schema error, try legacy payload
    if (error && isSchemaColumnMissing(error.message, "jobs")) {
      console.warn("[jobs:create] full payload failed due to schema, trying legacy payload");
      ({ data, error } = await supabase.from("jobs").insert(legacyPayload).select(fallbackSelect).single());
    }

    // If still schema error, try compact payload
    if (error && isSchemaColumnMissing(error.message, "jobs")) {
      console.warn("[jobs:create] legacy payload failed due to schema, trying compact payload");
      ({ data, error } = await supabase.from("jobs").insert(compactPayload).select(compactSelect).single());
    }

    // If still schema error, return the error message
    if (error && isSchemaColumnMissing(error.message, "jobs")) {
      console.error("[jobs:create] all payloads failed due to schema", error);
      return NextResponse.json(
        {
          success: false,
          error:
            "Job fields could not be saved because the database schema is out of date. Run the latest migration and reload schema cache.",
        },
        { status: 500 },
      );
    }

    if (error) {
      console.error("[jobs:create] insert failed", error);
      return NextResponse.json(
        { success: false, error: normalizeJobsSchemaError(error.message) },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        job: data
          ? {
              ...data,
              pay_rate_display: formatPayRate(data.pay_rate, data.payment_type),
            }
          : data,
        warning: locationWarning,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create job";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
