import Link from "next/link";
import { redirect } from "next/navigation";
import { NewWorkerPageClient } from "@/components/workers/NewWorkerPageClient";
import { getCurrentAdminUser } from "@/lib/admin-auth";
import { getAppSessionUser } from "@/lib/auth/session";

export default async function NewWorkerPage() {
  const user = await getAppSessionUser();
  if (!user) {
    redirect("/login?next=/workers/new");
  }
  const admin = await getCurrentAdminUser();
  if (!admin) {
    redirect("/");
  }

  return (
    <main>
      <p>
        <Link href="/workers">Back to staff</Link>
      </p>
      <h1>Create Worker</h1>
      <NewWorkerPageClient />
    </main>
  );
}
