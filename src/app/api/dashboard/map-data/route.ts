import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import { getDashboardMapData } from "@/lib/dashboard";

export async function GET() {
  try {
    const currentUser = await getAppSessionUser();
    const payload = await getDashboardMapData({
      viewerProviderId: currentUser?.role === "job_provider" ? currentUser.providerId : undefined,
      limitedProviderView: currentUser?.role === "job_provider",
      includeJobs: Boolean(currentUser),
    });
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load map data";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
