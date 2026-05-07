import { NextResponse } from "next/server";
import { APP_SESSION_COOKIE, getAppSessionUser, serializeAppSession } from "@/lib/auth/session";
import { getAccountEntitlements } from "@/lib/provider-access";
import { loadProviderAccount } from "@/lib/provider-account";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function updateProviderAccountRecord(
  providerId: string,
  values: {
    name: string;
    email: string | null;
    avatarUrl?: string | null;
    phone: string | null;
    town: string | null;
    postcode: string | null;
  },
) {
  const supabase = createAdminSupabaseClient();
  const payload = {
    name: values.name,
    email: values.email,
    avatar_url: values.avatarUrl ?? null,
    phone: values.phone,
    town: values.town,
    postcode: values.postcode,
  };

  const primary = await supabase
    .from("job_providers")
    .update(payload)
    .eq("id", providerId)
    .select("id, name, email, phone, town, postcode")
    .maybeSingle();

  if (!primary.error && primary.data) {
    return primary;
  }

  return supabase
    .from("job_providers")
    .update(payload)
    .eq("provider_id", providerId)
    .select("id, name, email, phone, town, postcode")
    .maybeSingle();
}

export async function GET() {
  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const provider = await loadProviderAccount(currentUser.providerId);
  if (!provider) {
    return NextResponse.json({ success: false, error: "Provider account not found." }, { status: 404 });
  }
  const entitlements = getAccountEntitlements({
    accessTier: provider.accessTier,
    accessStatus: provider.accessStatus,
    accountTier: provider.accountTier,
    billingStatus: provider.billingStatus,
    paygDispatchAllowanceRemaining: provider.paygDispatchAllowanceRemaining,
    monthlyActive: provider.monthlyActive,
    activeSubscription: provider.activeSubscription,
    trialAccess: provider.trialAccess,
    trialStatus: provider.trialStatus,
    trialAccessLevel: provider.trialAccessLevel,
    trialStartDate: provider.trialStartDate,
    trialEndDate: provider.trialEndDate,
    adminFullAccess: provider.adminFullAccess,
    fullAccess: provider.fullAccess,
    accessLevel: provider.accessLevel,
  });

  const nextUser = {
    ...currentUser,
    providerName: provider.name,
    avatarUrl: provider.avatarUrl,
    accessBadgeLabel: entitlements.accountBadgeLabel,
    accountTier: provider.accountTier,
    billingStatus: provider.billingStatus,
    paygPackType: provider.paygPackType,
    paygDispatchAllowanceTotal: provider.paygDispatchAllowanceTotal,
    paygDispatchAllowanceRemaining: provider.paygDispatchAllowanceRemaining,
    monthlyRenewalDate: provider.monthlyRenewalDate,
    monthlyActive: provider.monthlyActive,
        trialAccess: provider.trialAccess,
    isTrialMonth: provider.isTrialMonth,
    trialGrantedByAdmin: provider.trialGrantedByAdmin,
    trialStartDate: provider.trialStartDate,
    trialEndDate: provider.trialEndDate,
    trialStatus: provider.trialStatus,
        trialAccessLevel: provider.trialAccessLevel,
        profileOpensThisMonth: provider.profileOpensThisMonth,
        compareActionsThisMonth: provider.compareActionsThisMonth,
        manualDraftsUsed: provider.manualDraftsUsed,
  };

  const response = NextResponse.json({ success: true, provider, user: nextUser });
  response.cookies.set(APP_SESSION_COOKIE, serializeAppSession(nextUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

export async function PATCH(request: Request) {
  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const payload = {
    name: typeof body?.name === "string" ? body.name.trim() : "",
    email: typeof body?.email === "string" ? body.email.trim() : "",
    phone: typeof body?.phone === "string" ? body.phone.trim() : "",
    town: typeof body?.town === "string" ? body.town.trim() : "",
    postcode: typeof body?.postcode === "string" ? body.postcode.trim() : "",
    avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : null,
  };

  if (!payload.name) {
    return NextResponse.json({ success: false, error: "Company / account name is required." }, { status: 400 });
  }

  const primary = await updateProviderAccountRecord(currentUser.providerId, {
    name: payload.name,
    email: payload.email || null,
    avatarUrl: payload.avatarUrl || null,
    phone: payload.phone || null,
    town: payload.town || null,
    postcode: payload.postcode || null,
  });

  if (primary.error || !primary.data) {
    return NextResponse.json(
      { success: false, error: primary.error?.message ?? "Unable to update account details." },
      { status: 500 },
    );
  }

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("project_management_accounts")
    .update({
      name: currentUser.name ?? payload.name,
      email: payload.email || currentUser.email,
      avatar_url: payload.avatarUrl || null,
    })
    .eq("provider_id", currentUser.providerId);

  const updatedProvider = await loadProviderAccount(currentUser.providerId);
  if (!updatedProvider) {
    return NextResponse.json({ success: false, error: "Provider account not found after update." }, { status: 404 });
  }
  const entitlements = getAccountEntitlements({
    accessTier: updatedProvider.accessTier,
    accessStatus: updatedProvider.accessStatus,
    accountTier: updatedProvider.accountTier,
    billingStatus: updatedProvider.billingStatus,
    paygDispatchAllowanceRemaining: updatedProvider.paygDispatchAllowanceRemaining,
    monthlyActive: updatedProvider.monthlyActive,
    activeSubscription: updatedProvider.activeSubscription,
    trialAccess: updatedProvider.trialAccess,
    trialStatus: updatedProvider.trialStatus,
    trialAccessLevel: updatedProvider.trialAccessLevel,
    trialStartDate: updatedProvider.trialStartDate,
    trialEndDate: updatedProvider.trialEndDate,
    adminFullAccess: updatedProvider.adminFullAccess,
    fullAccess: updatedProvider.fullAccess,
    accessLevel: updatedProvider.accessLevel,
  });

  const nextUser = {
    ...currentUser,
    providerName: updatedProvider.name,
    avatarUrl: updatedProvider.avatarUrl,
    accessBadgeLabel: entitlements.accountBadgeLabel,
    email: payload.email || currentUser.email,
    accountTier: updatedProvider.accountTier,
    billingStatus: updatedProvider.billingStatus,
    paygPackType: updatedProvider.paygPackType,
    paygDispatchAllowanceTotal: updatedProvider.paygDispatchAllowanceTotal,
    paygDispatchAllowanceRemaining: updatedProvider.paygDispatchAllowanceRemaining,
    monthlyRenewalDate: updatedProvider.monthlyRenewalDate,
    monthlyActive: updatedProvider.monthlyActive,
    trialAccess: updatedProvider.trialAccess,
    isTrialMonth: updatedProvider.isTrialMonth,
    trialGrantedByAdmin: updatedProvider.trialGrantedByAdmin,
    trialStartDate: updatedProvider.trialStartDate,
    trialEndDate: updatedProvider.trialEndDate,
    trialStatus: updatedProvider.trialStatus,
    trialAccessLevel: updatedProvider.trialAccessLevel,
    profileOpensThisMonth: updatedProvider.profileOpensThisMonth,
    compareActionsThisMonth: updatedProvider.compareActionsThisMonth,
    manualDraftsUsed: updatedProvider.manualDraftsUsed,
  };

  const response = NextResponse.json({ success: true, provider: updatedProvider, user: nextUser });
  response.cookies.set(APP_SESSION_COOKIE, serializeAppSession(nextUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
