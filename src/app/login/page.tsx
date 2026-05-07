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

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const user = await getAppSessionUser();
  if (user) {
    redirect(nextPath);
  }

  return (
    <main>
      <JobProviderLoginForm
        role="job_provider"
        title="Sign in"
        description="Access your workspace."
        submitLabel="Login as Client"
        successRedirect={nextPath}
        allowRoleSwitch
      />
    </main>
  );
}
