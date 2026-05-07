import { NextResponse } from "next/server";
import { serializeAppSession, APP_SESSION_COOKIE } from "@/lib/auth/session";
import type {
  AppSessionUser,
  AppUserRole,
} from "@/lib/auth/types";
import { verifyPassword } from "@/lib/auth/password";
import { getAdminProfileByUserId, recordAdminLogin } from "@/lib/admin-auth";
import { getAccountEntitlements } from "@/lib/provider-access";
import { loadProviderAccount } from "@/lib/provider-account";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeRole(value: unknown): AppUserRole | null {
  return value === "admin" || value === "job_provider" ? value : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const role = normalizeRole(body?.role);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const accessCode = typeof body?.accessCode === "string" ? body.accessCode : "";

  if (!role) {
    return NextResponse.json({ success: false, error: "Select a valid role." }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
  }

  const requiredAdminCode = process.env.ADMIN_ACCESS_CODE;
  if (role === "admin" && requiredAdminCode && accessCode !== requiredAdminCode) {
    return NextResponse.json({ success: false, error: "Invalid admin access code." }, { status: 401 });
  }

  let user: AppSessionUser;

  if (role === "job_provider") {
    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: account, error: lookupError } = await supabase
      .from("project_management_accounts")
      .select("id, name, email, password_hash, provider_id, account_status")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { success: false, error: `Unable to check subscriber login record. ${lookupError.message}` },
        { status: 500 },
      );
    }

    if (!account) {
      return NextResponse.json(
        { success: false, error: "No account found for this email. Create an account first." },
        { status: 404 },
      );
    }

    if (account.account_status !== "active") {
      return NextResponse.json(
        { success: false, error: "This account is inactive." },
        { status: 403 },
      );
    }

    const passwordOk = await verifyPassword(password, account.password_hash);
    if (!passwordOk) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const provider = await loadProviderAccount(String(account.provider_id));

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Unable to load project management account." },
        { status: 500 },
      );
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

    user = {
      id: `job_provider:${account.provider_id}`,
      email,
      name: account.name || name || undefined,
      role,
      providerId: String(account.provider_id),
      providerName: provider.name,
      avatarUrl: provider.avatarUrl,
      accessBadgeLabel: entitlements.accountBadgeLabel,
      accountGroup: "project_management",
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
  } else {
    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required." },
        { status: 400 },
      );
    }

    const authClient = createServerSupabaseClient();
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: "Invalid admin email or password." },
        { status: 401 },
      );
    }

    const adminProfile = await getAdminProfileByUserId(authData.user.id);
    if (!adminProfile || adminProfile.email.toLowerCase() !== email) {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 },
      );
    }

    void recordAdminLogin(adminProfile);
    const displayName = adminProfile.display_name || adminProfile.email || "Admin";

    user = {
      id: adminProfile.user_id,
      email,
      name: displayName,
      role,
      adminRole: adminProfile.role,
      accountGroup: "admin",
    };
  }

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
