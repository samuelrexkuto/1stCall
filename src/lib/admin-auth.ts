import { getAppSessionUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AdminRole = "owner" | "admin" | "support";

export interface AdminProfile {
  id?: string | null;
  user_id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  display_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
  last_login_at?: string | null;
  login_count?: number;
}

const allowedAdminRoles = new Set<AdminRole>(["owner", "admin", "support"]);

function isUuid(value: string | undefined) {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  );
}

function normalizeAdminProfile(row: Record<string, unknown> | null): AdminProfile | null {
  if (!row) return null;
  const role = typeof row.role === "string" && allowedAdminRoles.has(row.role as AdminRole)
    ? (row.role as AdminRole)
    : null;
  if (!role || row.is_active !== true || typeof row.user_id !== "string" || typeof row.email !== "string") {
    return null;
  }
  return {
    id: typeof row.id === "string" ? row.id : null,
    user_id: row.user_id,
    email: row.email,
    role,
    is_active: true,
    display_name: typeof row.display_name === "string" && row.display_name.trim() ? row.display_name : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
    revoked_at: typeof row.revoked_at === "string" ? row.revoked_at : null,
    revoked_by: typeof row.revoked_by === "string" ? row.revoked_by : null,
    last_login_at: typeof row.last_login_at === "string" ? row.last_login_at : null,
    login_count: typeof row.login_count === "number" ? row.login_count : 0,
  };
}

export async function getAdminProfileByUserId(userId: string) {
  if (!isUuid(userId)) return null;
  const supabase = createAdminSupabaseClient();
  const selects = [
    "id, user_id, email, display_name, role, is_active, notes, created_at, created_by, updated_at, updated_by, revoked_at, revoked_by, last_login_at, login_count",
    "user_id, email, role, is_active",
  ] as const;

  for (const select of selects) {
    const { data, error } = await supabase
      .from("admin_users")
      .select(select)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!error) {
      return normalizeAdminProfile(data as Record<string, unknown> | null);
    }

    if (!error.message.toLowerCase().includes("display_name") && !error.message.toLowerCase().includes("column")) {
      throw error;
    }
  }

  return null;
}

export async function recordAdminLogin(admin: AdminProfile) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("admin_users")
    .update({
      last_login_at: new Date().toISOString(),
      login_count: (admin.login_count ?? 0) + 1,
    })
    .eq("user_id", admin.user_id);

  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[admin-login] unable to update login counters", error.message);
  }
}

export async function getCurrentAdminUser() {
  const sessionUser = await getAppSessionUser();
  if (!sessionUser || sessionUser.role !== "admin") return null;
  const profile = await getAdminProfileByUserId(sessionUser.id);
  if (!profile) return null;
  if (profile.email.toLowerCase() !== sessionUser.email.toLowerCase()) return null;
  return profile;
}

export async function currentUserIsAdmin() {
  return Boolean(await getCurrentAdminUser());
}

export async function requireAdmin() {
  const profile = await getCurrentAdminUser();
  if (!profile) {
    const error = new Error("Admin access required.");
    error.name = "AdminAccessError";
    throw error;
  }
  return profile;
}

export function adminUnauthorizedResponse() {
  return Response.json({ success: false, error: "Admin access required." }, { status: 403 });
}
