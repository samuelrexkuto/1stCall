import { NextResponse } from "next/server";
import { APP_SESSION_COOKIE, getAppSessionUser, serializeAppSession } from "@/lib/auth/session";
import { getAccountEntitlements } from "@/lib/provider-access";
import { loadProviderAccount } from "@/lib/provider-account";
import {
  PROFILE_IMAGE_BUCKET,
  getProfileImageExtension,
  validateProfileImage,
} from "@/lib/profileImages";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("avatar") ?? formData?.get("profileImage");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Choose a profile image to upload." }, { status: 400 });
  }

  try {
    validateProfileImage(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid profile image.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const extension = getProfileImageExtension(file);
  const filePath = `${currentUser.providerId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        success: false,
        error: uploadError.message,
        hint: `Ensure the Supabase storage bucket "${PROFILE_IMAGE_BUCKET}" exists and is public or readable by this app.`,
      },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(filePath);
  console.log("[account/avatar] uploaded avatar", {
    bucket: PROFILE_IMAGE_BUCKET,
    path: filePath,
    publicUrl: data.publicUrl,
  });

  const providerImagePatch = {
    profile_image_url: data.publicUrl,
    profile_image_path: filePath,
    avatar_url: data.publicUrl,
    avatar_path: filePath,
  };

  const primaryUpdate = await supabase
    .from("job_providers")
    .update(providerImagePatch)
    .eq("id", currentUser.providerId)
    .select("id")
    .maybeSingle();

  const providerUpdate = !primaryUpdate.error && primaryUpdate.data
    ? primaryUpdate
    : await supabase
      .from("job_providers")
      .update(providerImagePatch)
      .eq("provider_id", currentUser.providerId)
      .select("id")
      .maybeSingle();

  if (providerUpdate.error || !providerUpdate.data) {
    return NextResponse.json(
      {
        success: false,
        error: providerUpdate.error?.message ?? "Unable to save profile image to account.",
      },
      { status: 500 },
    );
  }

  await supabase
    .from("project_management_accounts")
    .update({
      profile_image_url: data.publicUrl,
      profile_image_path: filePath,
    })
    .eq("provider_id", currentUser.providerId);

  if (currentUser.email) {
    await supabase
      .from("project_management_accounts")
      .update({
        profile_image_url: data.publicUrl,
        profile_image_path: filePath,
      })
      .eq("email", currentUser.email);
  }

  await supabase
    .from("profiles")
    .update({
      avatar_url: data.publicUrl,
      avatar_path: filePath,
    })
    .eq("id", currentUser.id);

  const updatedProvider = await loadProviderAccount(currentUser.providerId);
  const entitlements = updatedProvider
    ? getAccountEntitlements({
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
    })
    : null;

  const nextUser = updatedProvider
    ? {
      ...currentUser,
      providerName: updatedProvider.name,
      avatarUrl: updatedProvider.avatarUrl ?? data.publicUrl,
      accessBadgeLabel: entitlements?.accountBadgeLabel ?? currentUser.accessBadgeLabel,
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
    }
    : {
      ...currentUser,
      avatarUrl: data.publicUrl,
    };

  const response = NextResponse.json({
    success: true,
    profile_image_url: data.publicUrl,
    profile_image_path: filePath,
    avatar_url: data.publicUrl,
    avatar_path: filePath,
    avatarUrl: data.publicUrl,
    profileImageUrl: data.publicUrl,
    profileImagePath: filePath,
    path: filePath,
    account: updatedProvider,
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
