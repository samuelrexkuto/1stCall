import { DispatchAlertsClient } from "@/components/layout/DispatchAlertsClient";
import { getAppSessionUser } from "@/lib/auth/session";
import { getDashboardAlerts } from "@/lib/dashboard";

export async function DispatchAlerts() {
  try {
    const currentUser = await getAppSessionUser();
    if (currentUser?.role === "job_provider") {
      return null;
    }

    const payload = await getDashboardAlerts();

    return <DispatchAlertsClient initialPayload={payload} />;
  } catch {
    return null;
  }
}
