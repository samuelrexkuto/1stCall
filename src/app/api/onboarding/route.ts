import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeUkPhoneNumber } from "@/lib/phone";
import { uploadWorkerDocuments } from "@/lib/worker-documents-server";
import { getWorkerReadiness } from "@/lib/workers/getWorkerReadiness";

function parseBoolean(value: FormDataEntryValue | null) {
  return typeof value === "string" && value === "true";
}

function parseNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonStringArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [] as string[];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getSingleFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function getMultipleFiles(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

async function mirrorStaffSub(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  workerId: string,
  input: {
    full_name: string;
    mobile_number: string;
    email: string;
    primary_role: string;
    worker_type: string;
    skill_tags: string[];
    location: string;
    available_today: boolean;
    right_to_work: boolean;
    whatsapp_opt_in: boolean;
    priority_tier: string;
    onboarding_source: string;
    onboarding_status: string;
  },
) {
  const { error } = await supabase.from("staff_subs").upsert({
    worker_id: workerId,
    full_name: input.full_name,
    mobile: input.mobile_number,
    whatsapp: input.whatsapp_opt_in ? input.mobile_number : null,
    email: input.email || null,
    postcode: input.location,
    town: input.location,
    worker_type: input.worker_type || input.primary_role || null,
    status: "active",
    available_today: input.available_today,
    primary_role: input.primary_role || null,
    skill_tags: input.skill_tags,
    right_to_work: input.right_to_work,
    contract_signed: false,
    priority_tier: input.priority_tier,
    whatsapp_opt_in: input.whatsapp_opt_in,
    onboarding_source: input.onboarding_source,
    onboarding_status: input.onboarding_status,
  });

  if (error && error.code !== "PGRST205") {
    console.warn("[onboarding] staff_subs mirror failed", error.message);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const fullName = String(formData.get("full_name") ?? "").trim();
    const rawMobileNumber = String(formData.get("mobile_number") ?? "").trim();
    const mobileNumber = normalizeUkPhoneNumber(rawMobileNumber) ?? rawMobileNumber;
    const email = String(formData.get("email") ?? "").trim();
    const primaryRole = String(formData.get("primary_role") ?? "").trim();
    const rawWorkerType = String(formData.get("worker_type") ?? "tradesman").trim().toLowerCase();
    const workerType = rawWorkerType === "contractor" ? "contractor" : "tradesman";
    const contractorType = String(formData.get("contractor_type") ?? "").trim() || null;
    const specialistArea = String(formData.get("specialist_area") ?? "").trim() || null;
    const skillTag = String(formData.get("skill_tag") ?? "").trim();
    const languagesSpoken = parseJsonStringArray(formData.get("languages_spoken"));
    const location = String(formData.get("location") ?? "").trim();
    const placeId = String(formData.get("place_id") ?? "").trim() || null;
    const latitude = parseNumber(formData.get("latitude"));
    const longitude = parseNumber(formData.get("longitude"));
    const locationResolved = parseBoolean(formData.get("location_resolved"));
    const availableToday = parseBoolean(formData.get("available_today"));
    const rightToWork = parseBoolean(formData.get("right_to_work"));
    const whatsappOptIn = parseBoolean(formData.get("whatsapp_opt_in"));
    const priorityTier = String(formData.get("priority_tier") ?? "standard").trim() || "standard";
    const insuranceVerified = parseBoolean(formData.get("insurance_verified"));
    const insuranceTypes = parseJsonStringArray(formData.get("insurance_types"));
    const enhancedDbs = parseBoolean(formData.get("enhanced_dbs"));
    const firstAidCertified = parseBoolean(formData.get("first_aid_certified"));
    const companiesHouseVerified = parseBoolean(formData.get("companies_house_verified"));
    const companiesHouseNumber = String(formData.get("companies_house_number") ?? "").trim() || null;
    const constructionlineMember = parseBoolean(formData.get("constructionline_member"));
    const qualificationLabel = String(formData.get("qualification_label") ?? "").trim() || null;
    const accreditations = parseJsonStringArray(formData.get("accreditations"));
    const cscsCard = getSingleFile(formData, "cscs_card");
    const idDocument = getSingleFile(formData, "id_document");
    const portfolioFiles = getMultipleFiles(formData, "portfolio_files");
    const certificateFiles = getMultipleFiles(formData, "certificate_files");

    if (!fullName || !rawMobileNumber || !email || !location) {
      return NextResponse.json(
        { success: false, error: "Name, mobile, email, and location are required." },
        { status: 400 },
      );
    }

    if (workerType !== "contractor" && (!primaryRole || !skillTag)) {
      return NextResponse.json(
        { success: false, error: "Primary role and skill tag are required for tradesmen." },
        { status: 400 },
      );
    }

    if ((!cscsCard && workerType !== "contractor") || !idDocument) {
      return NextResponse.json(
        { success: false, error: workerType === "contractor" ? "ID upload is required." : "CSCS card and ID uploads are required." },
        { status: 400 },
      );
    }

    if (workerType === "contractor" && !contractorType) {
      return NextResponse.json(
        { success: false, error: "Contractor type is required for contractor registrations." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    if (workerType === "contractor" && contractorType === "specialist" && !specialistArea) {
      return NextResponse.json(
        { success: false, error: "Specialty is required for specialist contractors." },
        { status: 400 },
      );
    }

    const skillTags = workerType === "contractor" ? [] : Array.from(new Set([skillTag])).filter(Boolean);
    const contractorPrimaryRole =
      contractorType === "specialist"
        ? specialistArea ?? "Specialist"
        : contractorType === "multi_discipline"
          ? "Multi-Discipline"
          : "Contractor";
    const displayPrimaryRole = workerType === "contractor" ? contractorPrimaryRole : primaryRole || skillTag;
    const workerPayload = {
      full_name: fullName,
      phone: mobileNumber,
      email,
      primary_role: displayPrimaryRole,
      worker_type: workerType,
      contractor_type: contractorType,
      specialist_area: workerType === "contractor" && contractorType === "specialist" ? specialistArea : null,
      skill_tags: skillTags,
      languages_spoken: languagesSpoken,
      status: "active",
      town: location,
      postcode: location,
      location_text: location,
      location_display: location,
      location_query: location,
      formatted_address: location,
      place_id: placeId,
      locality: location,
      administrative_area: null,
      country: null,
      location_precision: "full_postcode",
      latitude,
      longitude,
      available_today: availableToday,
      right_to_work: rightToWork,
      contract_signed: false,
      whatsapp_opt_in: whatsappOptIn,
      priority_tier: priorityTier,
      insurance_verified: insuranceVerified,
      insurance_types: insuranceTypes,
      enhanced_dbs: enhancedDbs,
      first_aid_certified: firstAidCertified,
      companies_house_verified: companiesHouseVerified,
      companies_house_number: companiesHouseNumber,
      constructionline_member: constructionlineMember,
      qualification_label: qualificationLabel,
      accreditations,
      contract_status: "not_sent",
      onboarding_source: "public_form",
      onboarding_status: "documents_pending",
      cscs_uploaded: false,
      id_document_uploaded: false,
      portfolio_uploaded: false,
      certificates_uploaded: false,
    };
    const workerFallbackPayload = {
      full_name: fullName,
      phone: mobileNumber,
      email,
      primary_role: displayPrimaryRole,
      status: "active",
      town: location,
      postcode: location,
      location_display: location,
      location_query: location,
      latitude,
      longitude,
      available_today: availableToday,
      right_to_work: rightToWork,
      contract_signed: false,
      whatsapp_opt_in: whatsappOptIn,
      priority_tier: priorityTier,
    };
    const workerSelect =
      "id, full_name, phone, email, primary_role, worker_type, contractor_type, specialist_area, skill_tags, languages_spoken, insurance_verified, insurance_types, enhanced_dbs, first_aid_certified, companies_house_verified, companies_house_number, constructionline_member, qualification_label, accreditations, location_display, town, postcode, status, available_today, right_to_work, contract_signed, whatsapp_opt_in, priority_tier, contract_status, contract_signed_at, onboarding_status, id_document_uploaded, cscs_uploaded, portfolio_uploaded, certificates_uploaded";
    const workerFallbackSelect =
      "id, full_name, phone, email, primary_role, location_display, town, postcode, status, available_today, right_to_work, contract_signed, whatsapp_opt_in, priority_tier";

    let worker: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;
    const primaryInsertResult = await supabase
      .from("workers")
      .insert(workerPayload)
      .select(workerSelect)
      .single();
    worker = (primaryInsertResult.data as Record<string, unknown> | null) ?? null;
    error = primaryInsertResult.error;

    if (error) {
      const fallbackResult = await supabase
        .from("workers")
        .insert(workerFallbackPayload)
        .select(workerFallbackSelect)
        .single();
      worker = (fallbackResult.data as Record<string, unknown> | null) ?? null;
      error = fallbackResult.error;
    }

    if (error || !worker) {
      return NextResponse.json(
        { success: false, error: error?.message ?? "Unable to create worker." },
        { status: 500 },
      );
    }

    const workerId = String(worker.id);

    if (cscsCard) {
      await uploadWorkerDocuments(supabase, workerId, "cscs_card", [cscsCard]);
    }
    await uploadWorkerDocuments(supabase, workerId, "id_document", [idDocument]);

    if (portfolioFiles.length > 0) {
      await uploadWorkerDocuments(supabase, workerId, "portfolio", portfolioFiles);
    }

    if (certificateFiles.length > 0) {
      await uploadWorkerDocuments(supabase, workerId, "certificate", certificateFiles);
    }

    const uploadedFlags = {
      cscs_uploaded: Boolean(cscsCard),
      id_document_uploaded: true,
      portfolio_uploaded: portfolioFiles.length > 0,
      certificates_uploaded: certificateFiles.length > 0,
    };

    const readiness = getWorkerReadiness({
      ...worker,
      ...uploadedFlags,
      contract_status: "not_sent",
      contract_signed: false,
      contract_signed_at: null,
    });
    const onboardingStatus = readiness === "contract_pending" ? "contract_pending" : readiness;

    await supabase
      .from("workers")
      .update({
        ...uploadedFlags,
        onboarding_status: onboardingStatus,
      })
      .eq("id", workerId);

    await mirrorStaffSub(supabase, workerId, {
      full_name: fullName,
      mobile_number: mobileNumber,
      email,
      primary_role: displayPrimaryRole,
      worker_type: workerType,
      skill_tags: skillTags,
      location,
      available_today: availableToday,
      right_to_work: rightToWork,
      whatsapp_opt_in: whatsappOptIn,
      priority_tier: priorityTier,
      onboarding_source: "public_form",
      onboarding_status: onboardingStatus,
    });

    return NextResponse.json({
      success: true,
      workerId,
      onboarding_status: onboardingStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to submit onboarding." },
      { status: 500 },
    );
  }
}
