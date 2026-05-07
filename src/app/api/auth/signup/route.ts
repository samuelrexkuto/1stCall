import { NextResponse } from "next/server";
import { serializeAppSession, APP_SESSION_COOKIE } from "@/lib/auth/session";
import type { AppSessionUser } from "@/lib/auth/types";
import { hashPassword } from "@/lib/auth/password";
import { loadProviderAccount } from "@/lib/provider-account";
import { getAccountEntitlements } from "@/lib/provider-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const companyName =
    typeof body?.companyName === "string" ? body.companyName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const town = typeof body?.town === "string" ? body.town.trim() : "";
  const postcode = typeof body?.postcode === "string" ? body.postcode.trim() : "";

  if (!name) {
    return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  if (!companyName) {
    return NextResponse.json(
      { success: false, error: "Company or account name is required." },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("project_management_accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingAccountError) {
    return NextResponse.json(
      { success: false, error: `Unable to check existing account. ${existingAccountError.message}` },
      { status: 500 },
    );
  }

  if (existingAccount) {
    return NextResponse.json(
      { success: false, error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  const { data: provider, error: providerError } = await supabase
    .from("job_providers")
    .insert({
      name: companyName,
      email,
      phone: phone || null,
      town: town || null,
      postcode: postcode || null,
      account_tier: "free_preview",
      access_tier: "free_preview",
      access_status: "active",
      billing_status: "trial",
      payg_pack_type: null,
      payg_pack: "None",
      payg_dispatch_allowance_total: 0,
      payg_dispatch_allowance_remaining: 0,
      payg_allowance_total: 0,
      payg_allowance_remaining: 0,
      dispatch_allowance_remaining: 0,
      dispatch_access_source: "free_preview",
      usage_today: 0,
      monthly_renewal_date: null,
      monthly_active: false,
      is_trial_month: false,
      trial_start_date: null,
      trial_end_date: null,
      trial_status: "none",
      trial_access: false,
      trial_granted_by_admin: false,
      trial_access_level: null,
      internal_billing_note: null,
      success_fee_status: null,
    })
    .select("id, name")
    .single();

  let createdProvider: Record<string, unknown> | null = (provider as Record<string, unknown> | null) ?? null;
  let createError = providerError;

  if (createError) {
    const fallback = await supabase
      .from("job_providers")
      .insert({
        name: companyName,
        email,
        phone: phone || null,
        town: town || null,
        postcode: postcode || null,
      })
      .select("id, name")
      .single();
    createdProvider = (fallback.data as Record<string, unknown> | null) ?? null;
    createError = fallback.error;
  }

  if (createError) {
    return NextResponse.json(
      { success: false, error: `Unable to create project management record. ${createError.message}` },
      { status: 500 },
    );
  }

  if (!createdProvider) {
    return NextResponse.json(
      { success: false, error: "Unable to create project management record." },
      { status: 500 },
    );
  }

  const providerId = String(createdProvider.id);
  const providerAccount = await loadProviderAccount(providerId);
  const providerEntitlements = getAccountEntitlements(providerAccount);

  const { error: accountError } = await supabase
    .from("project_management_accounts")
    .insert({
      provider_id: providerId,
      account_tier: "free_preview",
      access_tier: "free_preview",
      access_status: "active",
      trial_access: false,
      trial_status: "none",
      dispatch_allowance_remaining: 0,
      dispatch_access_source: "free_preview",
      name,
      email,
      password_hash: passwordHash,
    });

  if (accountError) {
    await supabase.from("job_providers").delete().eq("id", providerId);
    return NextResponse.json(
      { success: false, error: `Unable to create login account. ${accountError.message}` },
      { status: 500 },
    );
  }

  const user: AppSessionUser = {
    id: `job_provider:${providerId}`,
    email,
    name,
    role: "job_provider",
    providerId,
    providerName: typeof createdProvider.name === "string" ? createdProvider.name : undefined,
    avatarUrl: providerAccount?.avatarUrl ?? null,
    accessBadgeLabel: providerEntitlements.accountBadgeLabel,
    accountGroup: "project_management",
    accountTier: providerAccount?.accountTier ?? "free_preview",
    billingStatus: providerAccount?.billingStatus ?? "trial",
    paygPackType: providerAccount?.paygPackType ?? null,
    paygDispatchAllowanceTotal: providerAccount?.paygDispatchAllowanceTotal ?? 0,
    paygDispatchAllowanceRemaining: providerAccount?.paygDispatchAllowanceRemaining ?? 0,
    monthlyRenewalDate: providerAccount?.monthlyRenewalDate ?? null,
    monthlyActive: providerAccount?.monthlyActive ?? false,
    trialAccess: providerAccount?.trialAccess ?? false,
    isTrialMonth: providerAccount?.isTrialMonth ?? false,
    trialGrantedByAdmin: providerAccount?.trialGrantedByAdmin ?? false,
    trialStartDate: providerAccount?.trialStartDate ?? null,
    trialEndDate: providerAccount?.trialEndDate ?? null,
    trialStatus: providerAccount?.trialStatus ?? "none",
    trialAccessLevel: providerAccount?.trialAccessLevel ?? null,
    profileOpensThisMonth: providerAccount?.profileOpensThisMonth ?? 0,
    compareActionsThisMonth: providerAccount?.compareActionsThisMonth ?? 0,
    manualDraftsUsed: providerAccount?.manualDraftsUsed ?? 0,
  };

  const response = NextResponse.json({ success: true, user });
  response.cookies.set(APP_SESSION_COOKIE, serializeAppSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
