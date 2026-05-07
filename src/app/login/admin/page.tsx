import { redirect } from "next/navigation";
import { JobProviderLoginForm } from "@/components/auth/JobProviderLoginForm";
import { getCurrentAdminUser } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdminUser();
  if (admin) {
    redirect("/");
  }

  return (
    <main>
      <JobProviderLoginForm
        role="admin"
        title="Admin Login"
        description="Continue into the current admin dashboard and existing internal dispatch tools."
        submitLabel="Continue to Admin Workspace"
        successRedirect="/"
      />
    </main>
  );
}
