import Link from "next/link";
import { JobProviderForm } from "@/components/forms/JobProviderForm";

export default function NewProviderPage() {
  return (
    <main>
      <p>
        <Link href="/providers">Back to providers</Link>
      </p>
      <h1>Create Job Provider</h1>
      <JobProviderForm successRedirect="/providers" />
    </main>
  );
}
