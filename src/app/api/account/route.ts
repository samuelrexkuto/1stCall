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
    profileImageUrl?: string | null;
    profileImagePath?: string | null;
    avatar_url?: string | null;
    avatar_path?: string | null;
    profile_image_url?: string | null;
    profile_image_path?: string | null;
    phone: string | null;
    town: string | null;
    postcode: string | null;
  },
) {
  const supabase = createAdminSupabaseClient();
  const nextProfileImageUrl =
    values.profileImageUrl ?? values.profile_image_url ?? values.avatarUrl ?? values.avatar_url ?? null;
  const nextProfileImagePath =
    values.profileImagePath ?? values.profile_image_path ?? values.avatar_path ?? null;
  // Keep both profile_image_* and avatar_* fields in sync.
  // avatar_* is retained for backward compatibility with existing app code.
  const providerImagePatch = {
    profile_image_url: nextProfileImageUrl,
    profile_image_path: nextProfileImagePath,
    avatar_url: nextProfileImageUrl,
    avatar_path: nextProfileImagePath,
  };
  const payload = {
    name: values.name,
    email: values.email,
    ...providerImagePatch,
    phone: values.phone,
    town: values.town,
    postcode: values.postcode,
  };

  const primary = await supabase
    .from("job_providers")
    .update(payload)
    .eq("id", providerId)
    .select("id, name, email, phone, town, postcode, profile_image_url, profile_image_path, avatar_url, avatar_path")
    .maybeSingle();

  if (!primary.error && primary.data) {
    return primary;
  }

  return supabase
    .from("job_providers")
    .update(payload)
    .eq("provider_id", providerId)
    .select("id, name, email, phone, town, postcode, profile_image_url, profile_image_path, avatar_url, avatar_path")
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

  const response = NextResponse.json({ success: true, account: provider, provider, user: nextUser });
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
    avatarUrl:
      typeof body?.avatarUrl === "string"
        ? body.avatarUrl.trim()
        : typeof body?.avatar_url === "string"
          ? body.avatar_url.trim()
          : null,
    avatarPath: typeof body?.avatar_path === "string" ? body.avatar_path.trim() : null,
    profileImageUrl:
      typeof body?.profileImageUrl === "string"
        ? body.profileImageUrl.trim()
        : typeof body?.profile_image_url === "string"
          ? body.profile_image_url.trim()
          : null,
    profileImagePath:
      typeof body?.profileImagePath === "string"
        ? body.profileImagePath.trim()
        : typeof body?.profile_image_path === "string"
          ? body.profile_image_path.trim()
          : null,
  };

  if (!payload.name) {
    return NextResponse.json({ success: false, error: "Company / account name is required." }, { status: 400 });
  }

  const primary = await updateProviderAccountRecord(currentUser.providerId, {
    name: payload.name,
    email: payload.email || null,
    avatarUrl: payload.avatarUrl || payload.profileImageUrl || null,
    profileImageUrl: payload.profileImageUrl || payload.avatarUrl || null,
    profileImagePath: payload.profileImagePath || payload.avatarPath || null,
    avatar_path: payload.avatarPath || payload.profileImagePath || null,
    profile_image_url: payload.profileImageUrl || payload.avatarUrl || null,
    profile_image_path: payload.profileImagePath || payload.avatarPath || null,
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
      name: payload.name,
      email: payload.email || currentUser.email,
      profile_image_url: payload.profileImageUrl || payload.avatarUrl || null,
      profile_image_path: payload.profileImagePath || payload.avatarPath || null,
    })
    .eq("provider_id", currentUser.providerId);

  if (payload.email || currentUser.email) {
    await supabase
      .from("project_management_accounts")
      .update({
        name: payload.name,
        email: payload.email || currentUser.email,
        profile_image_url: payload.profileImageUrl || payload.avatarUrl || null,
        profile_image_path: payload.profileImagePath || payload.avatarPath || null,
      })
      .eq("email", payload.email || currentUser.email);
  }

  const nextProfileImageUrl = payload.profileImageUrl || payload.avatarUrl || null;
  const nextProfileImagePath = payload.profileImagePath || payload.avatarPath || null;

  if (nextProfileImageUrl || nextProfileImagePath) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_url: nextProfileImageUrl,
        avatar_path: nextProfileImagePath,
      })
      .eq("id", currentUser.id);

    if (profileError) {
      console.error("[api/account PATCH] profiles avatar sync failed", {
        message: profileError.message,
      });
    }
  }

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

  console.log("[api/account PATCH] returning account image fields", {
    id: updatedProvider?.id,
    profile_image_url: updatedProvider?.profile_image_url,
    profile_image_path: updatedProvider?.profile_image_path,
    avatar_url: nextProfileImageUrl,
    avatar_path: nextProfileImagePath,
  });

  const response = NextResponse.json({
    success: true,
    account: {
      ...updatedProvider,
      profile_image_url: updatedProvider.profile_image_url ?? nextProfileImageUrl,
      profile_image_path: updatedProvider.profile_image_path ?? nextProfileImagePath,
      avatar_url: nextProfileImageUrl,
      avatar_path: nextProfileImagePath,
    },
    provider: updatedProvider,
    user: nextUser,
  });
  response.cookies.set(APP_SESSION_COOKIE, serializeAppSession(nextUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
