import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import { getDashboardAlerts } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getAppSessionUser();
    const payload = await getDashboardAlerts(
      currentUser?.role === "job_provider" ? currentUser.providerId : undefined,
    );
    return NextResponse.json(
      { success: true, ...payload },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard alerts";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
