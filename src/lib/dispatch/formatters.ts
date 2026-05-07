import type { StructuredJobAlert } from "@/lib/job-intake/schema";

function normalizeList(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean) as string[];
}

function yesNo(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return null;
}

export function formatWorkerDispatchWhatsApp(job: StructuredJobAlert) {
  const lines: string[] = [];
  const role = job.core_role ?? job.job_title ?? null;
  const requirements = normalizeList([
    job.dbs_requirement && job.dbs_requirement !== "None" ? job.dbs_requirement : "DBS: No",
    job.ipaf_required !== null ? `IPAF: ${yesNo(job.ipaf_required)}` : null,
    job.own_tools_required !== null ? `Own Tools: ${yesNo(job.own_tools_required)}` : null,
    job.ppe_required !== null ? `PPE: ${yesNo(job.ppe_required)}` : null,
  ]);

  if (job.alert_type) {
    lines.push(`[ALERT TYPE]: ${job.alert_type}`);
    lines.push("");
  }

  if (role) lines.push(`Role: ${role}`);
  if (job.headcount_required) lines.push(`Needed: ${job.headcount_required} worker${job.headcount_required === 1 ? "" : "s"}`);
  if (job.location) lines.push(`Location: ${job.location}`);
  if (job.duration) lines.push(`Duration: ${job.duration}`);
  if (job.start_date) lines.push(`Start Date: ${job.start_date}`);
  if (job.end_date) lines.push(`End Date: ${job.end_date}`);
  if (job.pay_rate) lines.push(`Pay: ${job.pay_rate}`);

  if (job.duties) {
    lines.push("");
    lines.push("Duties:");
    lines.push(...job.duties.split(/\n+/).map((line) => `- ${line.trim()}`).filter((line) => line !== "-"));
  }

  if (requirements.length) {
    lines.push("");
    lines.push("Requirements:");
    lines.push(...requirements.map((value) => `- ${value}`));
  }

  if (job.skills_required.length) {
    lines.push("");
    lines.push("Skills Required:");
    lines.push(...job.skills_required.map((skill) => `- ${skill}`));
  }

  if (job.tickets_required.length) {
    lines.push("");
    lines.push("Tickets Required:");
    lines.push(...job.tickets_required.map((ticket) => `- ${ticket}`));
  }

  if (job.optional_supporting_notes) {
    lines.push("");
    lines.push("Additional Notes:");
    lines.push(job.optional_supporting_notes);
  }

  lines.push("");
  lines.push("Reply with Yes please.");

  return lines.join("\n");
}
