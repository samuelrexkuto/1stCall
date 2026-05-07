import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeAccountTier } from "@/lib/provider-access";
import { loadProvidersOverview } from "@/lib/providers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createJobProviderSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    console.log("[api/providers] start");
    const data = await loadProvidersOverview();
    console.log("[api/providers] success", { count: data.providers.length });
    return NextResponse.json({ ok: true, success: true, data, providers: data.providers });
  } catch (error) {
    console.error("[api/providers] failed", error);
    const message = error instanceof Error ? error.message : "Failed to load providers";
    return NextResponse.json({ ok: false, success: false, error: message, data: null }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const json = await request.json();
  const parsed = createJobProviderSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid provider payload." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    const accountTier = normalizeAccountTier(parsed.data.account_tier);
    const dispatchAccessSource =
      accountTier === "trial_full_access"
        ? "trial"
        : accountTier === "monthly_full_access"
          ? "monthly"
          : accountTier === "manual_full_access"
            ? "manual_full_access"
            : accountTier === "payg"
              ? "payg"
              : "free_preview";
    const { data, error } = await supabase
      .from("job_providers")
      .insert({
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        town: parsed.data.town || null,
        postcode: parsed.data.postcode || null,
        account_tier: accountTier,
        access_tier: accountTier,
        access_status: "active",
        billing_status: parsed.data.billing_status,
        payg_pack_type: parsed.data.payg_pack_type,
        payg_pack: parsed.data.payg_pack_type ?? "None",
        payg_dispatch_allowance_total: parsed.data.payg_dispatch_allowance_total,
        payg_dispatch_allowance_remaining: parsed.data.payg_dispatch_allowance_remaining,
        payg_allowance_total: parsed.data.payg_dispatch_allowance_total,
        payg_allowance_remaining: parsed.data.payg_dispatch_allowance_remaining,
        dispatch_allowance_remaining: parsed.data.payg_dispatch_allowance_remaining,
        dispatch_access_source: dispatchAccessSource,
        usage_today: parsed.data.usage_today,
        monthly_renewal_date: parsed.data.monthly_renewal_date || null,
        monthly_active: parsed.data.monthly_active,
        is_trial_month: parsed.data.is_trial_month,
        trial_granted_by_admin: parsed.data.trial_granted_by_admin,
        trial_start_date: parsed.data.trial_start_date || null,
        trial_end_date: parsed.data.trial_end_date || null,
        trial_status: parsed.data.trial_status,
        internal_billing_note: parsed.data.internal_billing_note || null,
        success_fee_status: parsed.data.success_fee_status || null,
        payment_reliability_status: parsed.data.payment_reliability_status,
        invoices_issued_count: parsed.data.invoices_issued_count,
        invoices_paid_on_time_count: parsed.data.invoices_paid_on_time_count,
        invoices_paid_late_count: parsed.data.invoices_paid_late_count,
        unpaid_invoices_count: parsed.data.unpaid_invoices_count,
        part_paid_invoices_count: parsed.data.part_paid_invoices_count,
        average_days_to_pay: parsed.data.average_days_to_pay ?? null,
        longest_payment_delay_days: parsed.data.longest_payment_delay_days,
        current_overdue_count: parsed.data.current_overdue_count,
        payment_disputes_count: parsed.data.payment_disputes_count,
        contractor_payout_delay_incidents_count: parsed.data.contractor_payout_delay_incidents_count,
        last_payment_received_date: parsed.data.last_payment_received_date || null,
        payment_reliability_note: parsed.data.payment_reliability_note || null,
        payment_reliability_last_reviewed_at: parsed.data.payment_reliability_last_reviewed_at || null,
      })
      .select("id, name, email, phone, town, postcode, created_at, account_tier, billing_status, payg_pack_type, payg_pack, payg_dispatch_allowance_total, payg_dispatch_allowance_remaining, payg_allowance_total, payg_allowance_remaining, usage_today, monthly_renewal_date, monthly_active, is_trial_month, trial_granted_by_admin, trial_start_date, trial_end_date, trial_status, internal_billing_note, success_fee_status, payment_reliability_status, invoices_issued_count, invoices_paid_on_time_count, invoices_paid_late_count, unpaid_invoices_count, part_paid_invoices_count, average_days_to_pay, longest_payment_delay_days, current_overdue_count, payment_disputes_count, contractor_payout_delay_incidents_count, last_payment_received_date, payment_reliability_note, payment_reliability_last_reviewed_at")
      .single();

    let created: Record<string, unknown> | null = (data as Record<string, unknown> | null) ?? null;
    let createError = error;

    if (createError) {
      const fallback = await supabase
        .from("job_providers")
        .insert({
          name: parsed.data.name,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          town: parsed.data.town || null,
          postcode: parsed.data.postcode || null,
        })
        .select("id, name, email, phone, town, postcode, created_at")
        .single();

      created = (fallback.data as Record<string, unknown> | null) ?? null;
      createError = fallback.error;
    }

    if (createError) {
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    }

    if (!created) {
      return NextResponse.json({ success: false, error: "Provider was not returned after creation." }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        provider: {
          id: String(created.id),
          provider_id: String(created.id),
          name: created.name,
          company_name: created.name,
          email: created.email,
          phone: created.phone,
          town: created.town,
          postcode: created.postcode,
          created_at: created.created_at,
          account_tier:
            created && typeof created === "object" && "account_tier" in created && typeof created.account_tier === "string"
              ? created.account_tier
              : "free_preview",
          billing_status:
            created && typeof created === "object" && "billing_status" in created && typeof created.billing_status === "string"
              ? created.billing_status
              : "trial",
          payg_pack_type:
            created && typeof created === "object" && "payg_pack_type" in created && typeof created.payg_pack_type === "string"
              ? created.payg_pack_type
              : null,
          payg_dispatch_allowance_total:
            created &&
            typeof created === "object" &&
            "payg_dispatch_allowance_total" in created &&
            typeof created.payg_dispatch_allowance_total === "number"
              ? created.payg_dispatch_allowance_total
              : 0,
          payg_dispatch_allowance_remaining:
            created &&
            typeof created === "object" &&
            "payg_dispatch_allowance_remaining" in created &&
            typeof created.payg_dispatch_allowance_remaining === "number"
              ? created.payg_dispatch_allowance_remaining
              : 0,
          usage_today:
            created && typeof created === "object" && "usage_today" in created && typeof created.usage_today === "number"
              ? created.usage_today
              : 0,
          monthly_renewal_date:
            created && typeof created === "object" && "monthly_renewal_date" in created && typeof created.monthly_renewal_date === "string"
              ? created.monthly_renewal_date
              : null,
          monthly_active:
            created && typeof created === "object" && "monthly_active" in created && typeof created.monthly_active === "boolean"
              ? created.monthly_active
              : false,
          is_trial_month:
            created && typeof created === "object" && "is_trial_month" in created && typeof created.is_trial_month === "boolean"
              ? created.is_trial_month
              : false,
          trial_granted_by_admin:
            created && typeof created === "object" && "trial_granted_by_admin" in created && typeof created.trial_granted_by_admin === "boolean"
              ? created.trial_granted_by_admin
              : false,
          trial_start_date:
            created && typeof created === "object" && "trial_start_date" in created && typeof created.trial_start_date === "string"
              ? created.trial_start_date
              : null,
          trial_end_date:
            created && typeof created === "object" && "trial_end_date" in created && typeof created.trial_end_date === "string"
              ? created.trial_end_date
              : null,
          trial_status:
            created && typeof created === "object" && "trial_status" in created &&
            (created.trial_status === "none" ||
              created.trial_status === "active" ||
              created.trial_status === "expired" ||
              created.trial_status === "revoked")
              ? created.trial_status
              : "none",
          internal_billing_note:
            created && typeof created === "object" && "internal_billing_note" in created && typeof created.internal_billing_note === "string"
              ? created.internal_billing_note
              : null,
          success_fee_status:
            created && typeof created === "object" && "success_fee_status" in created && typeof created.success_fee_status === "string"
              ? created.success_fee_status
              : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create provider";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
