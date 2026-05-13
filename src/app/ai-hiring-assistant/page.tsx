import { AIJobIntakeWorkspace } from "@/components/dashboard/AIJobIntakeWorkspace";
import { AIHiringAssistantPageClient } from "@/components/job-provider/AIHiringAssistantPageClient";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { Callout } from "@radix-ui/themes";
import { getAppSessionUser } from "@/lib/auth/session";
import { loadJobsOverview } from "@/lib/jobs";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadWorkersOverview } from "@/lib/workers";

export default async function AIHiringAssistantPage() {
  const user = await getAppSessionUser();
  const supabase = createAdminSupabaseClient();
  const viewerProviderId = user?.role === "job_provider" ? user.providerId : undefined;
  const [{ workers }, jobsData, providersData] = await Promise.all([
    loadWorkersOverview({
      name: "",
      worker_type: "",
      primary_role: "",
      location: "",
      available_today: "",
    }),
    loadJobsOverview({
      title: "",
      role: "",
      area: "",
      postcode: "",
      provider: "",
      job_status: "",
      fill_status: "",
      payment_status: "",
      broadcast_status: "",
    }, { viewerProviderId }),
    (async () => {
      try {
        const baseQuery = supabase
          .from("job_providers")
          .select("id, name")
          .order("name", { ascending: true });
        const result = await (viewerProviderId
          ? baseQuery.eq("id", viewerProviderId)
          : baseQuery);
        return result.data ?? [];
      } catch {
        return [] as Array<{ id: string; name: string }>;
      }
    })(),
  ]);

  return (
    <main className="workforce-dispatch-ai-page detailed-ai-page ai-hiring-page" style={{ display: "grid", gap: "1rem" }}>
      <div className="ai-hiring-workspace-layout">
        <AIJobIntakeWorkspace
          providers={providersData.map((provider: { id: string; name: string }) => ({
            provider_id: String(provider.id),
            company_name: provider.name,
          }))}
          currentProviderId={viewerProviderId}
          currentProviderName={user?.providerName}
        />

        <aside className="ai-hiring-brief-help quick-job-brief-help quick-job-brief-card job-brief-help-accordion">
          <details>
            <summary className="quick-job-brief-help__trigger quick-job-brief-card__trigger job-brief-help-accordion__trigger" style={{ cursor: "pointer", fontWeight: 700 }}>
              <span className="quick-job-brief-help__desktop-label">Quick job brief help</span>
              <Callout.Root
                color="gray"
                variant="surface"
                size="2"
                className="quick-job-brief-callout mobile-info-callout ai-hiring-help-callout"
              >
                <Callout.Icon>
                  <QuestionMarkCircledIcon aria-hidden="true" />
                </Callout.Icon>
                <Callout.Text>Quick job brief help</Callout.Text>
              </Callout.Root>
            </summary>
            <p className="quick-job-brief-help__text" style={{ margin: "0.65rem 0 0", color: "var(--rd-text-muted)", lineHeight: 1.55, fontSize: "0.9rem" }}>
              Say the trade, how many people you need, where the job is, when it starts, and any must-have tickets like CSCS or DBS.
            </p>
          </details>
        </aside>
      </div>

      <div className="last-recommended-matches">
        <AIHiringAssistantPageClient
          workers={workers}
          recentJobs={jobsData.jobs.map((job: {
            job_title: string;
            trade_type: string | null;
            area: string | null;
            postcode: string;
          }) => ({
            job_title: job.job_title,
            trade_type: job.trade_type,
            area: job.area,
            postcode: job.postcode,
          }))}
        />
      </div>
    </main>
  );
}
