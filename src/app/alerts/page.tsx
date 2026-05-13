import { DispatchAlertsClient } from "@/components/layout/DispatchAlertsClient";
import { ProviderHiringUpdatesPanel } from "@/components/layout/ProviderHiringUpdatesPanel";
import { getAppSessionUser } from "@/lib/auth/session";
import { getDashboardAlerts } from "@/lib/dashboard";
import { loadJobsOverview } from "@/lib/jobs";
import { loadWorkersOverview } from "@/lib/workers";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  try {
    const currentUser = await getAppSessionUser();
    const viewerProviderId = currentUser?.role === "job_provider" ? currentUser.providerId : undefined;
    const [result, jobsData, workersData] = await Promise.all([
      getDashboardAlerts(viewerProviderId),
      loadJobsOverview({
        title: "",
        role: "",
        area: "",
        postcode: "",
        provider: "",
        job_status: "open",
        fill_status: "",
        payment_status: "",
        broadcast_status: "",
      }, { viewerProviderId }).catch(() => null),
      currentUser?.role === "job_provider"
        ? Promise.resolve(null)
        : loadWorkersOverview({
            name: "",
            worker_type: "",
            primary_role: "",
            location: "",
            available_today: "",
          }).catch(() => null),
    ]);

    return (
      <main style={{ paddingTop: 8 }}>
        <div style={{ marginBottom: 18 }}>
          <h1
            className="mobile-alerts-title"
            style={{
              margin: 0,
              color: "var(--rd-text)",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            Alerts
          </h1>
          <p className="mobile-alerts-description" style={{ margin: "10px 0 0", color: "var(--rd-text-muted)", fontSize: 16, lineHeight: 1.6 }}>
            {currentUser?.role === "job_provider"
              ? `Provider-scoped hiring updates for ${currentUser.providerName ?? "your account"} only, focused on current dispatch progress and confirmed booking activity.`
              : "Platform-wide operations alerts for dispatch execution, payments, invoices, onboarding follow-up, and worker document review. Closing a popup on other pages does not remove it from this list."}
          </p>
        </div>

        {currentUser?.role === "job_provider" ? (
          <>
            <ProviderHiringUpdatesPanel jobs={jobsData?.jobs ?? []} />
          </>
        ) : (
          <>
            <DispatchAlertsClient
              initialPayload={result}
              jobs={jobsData?.jobs ?? []}
              workers={workersData?.workers ?? []}
            />
          </>
        )}
      </main>
    );
  } catch (error) {
    return (
      <main style={{ paddingTop: 8 }}>
        <h1
          style={{
            margin: 0,
            color: "var(--rd-text)",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          Alerts
        </h1>
        <p style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 16 }}>
          {error instanceof Error ? error.message : "Failed to load alerts."}
        </p>
      </main>
    );
  }
}
