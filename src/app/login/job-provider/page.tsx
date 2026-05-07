import { redirect } from "next/navigation";
import { JobProviderLoginForm } from "@/components/auth/JobProviderLoginForm";
import { getAppSessionUser } from "@/lib/auth/session";

function getSafeNextPath(input: string | string[] | undefined) {
  const value = Array.isArray(input) ? input[0] : input;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export default async function JobProviderLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const user = await getAppSessionUser();
  if (user?.role === "job_provider") {
    redirect(nextPath);
  }

  return (
    <main>
      <JobProviderLoginForm
        role="job_provider"
        title="Project Management Login"
        description="Sign in with email and password, or create a new project management account. New accounts are added to the Project Management Overview and then get their own jobs, alerts, and hiring workflow."
        submitLabel="Continue to Home"
        successRedirect={nextPath}
      />
    </main>
  );
}
