import { redirect } from "next/navigation";

export default function NewJobPage() {
  redirect("/jobs/manual-entry");
}
