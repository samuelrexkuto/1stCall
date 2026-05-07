import { redirect } from "next/navigation";
import { ProvidersPageClient } from "@/components/providers/ProvidersPageClient";
import { getCurrentAdminUser } from "@/lib/admin-auth";
import { getAppSessionUser } from "@/lib/auth/session";
import type { ProviderOverviewRow } from "@/components/providers/ProviderOverviewTable";
import { loadProvidersOverview } from "@/lib/providers";

export default async function ProvidersPage() {
  const user = await getAppSessionUser();
  if (!user) {
    redirect("/login?next=/providers");
  }
  const admin = await getCurrentAdminUser();
  if (!admin) {
    redirect("/");
  }

  try {
    const data = await loadProvidersOverview();
    return <ProvidersPageClient initialData={{ providers: data.providers, errorMessage: "" }} />;
  } catch (error) {
    console.error("[ProvidersPage] failed", error);
    if (process.env.NODE_ENV === "development") {
      throw error;
    }

    return (
      <ProvidersPageClient
        initialData={{
          providers: [] as ProviderOverviewRow[],
          errorMessage: error instanceof Error ? error.message : "Providers could not be loaded right now.",
        }}
      />
    );
  }
}
