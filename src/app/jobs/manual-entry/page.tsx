import { redirect } from "next/navigation";
import { ManualEntryJobPostPageClient } from "@/components/jobs/ManualEntryJobPostPageClient";
import { getCurrentAdminUser } from "@/lib/admin-auth";
import { getAppSessionUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function ManualEntryJobPostPage() {
  const user = await getAppSessionUser();
  if (!user) {
    redirect("/login?next=/jobs/manual-entry");
  }
  const admin = await getCurrentAdminUser();
  if (!admin) {
    redirect("/");
  }

  const supabase = createAdminSupabaseClient();
  const baseQuery = supabase
    .from("job_providers")
    .select("id, name")
    .order("name", { ascending: true });
  const { data } = await baseQuery;

  return (
    <ManualEntryJobPostPageClient
      providers={(data ?? []).map((provider) => ({
        provider_id: String(provider.id),
        company_name: provider.name,
      }))}
      successRedirect="/jobs"
    />
  );
}
