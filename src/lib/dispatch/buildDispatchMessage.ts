import { normaliseStringList } from "@/lib/stringLists";

type DispatchJobInput = {
  provider_name?: string | null;
  title?: string | null;
  required_role?: string | null;
  headcount_required?: number | null;
  location?: string | null;
  starts_at?: string | null;
  pay_rate?: string | number | null;
  duties?: string | null;
  skills_required?: string | string[] | null;
  ppe_required?: boolean | null;
  dbs_requirement?: string | null;
  payment_reliability_label?: string | null;
  platform_trust_label?: string | null;
};

function yesNo(value: boolean | null | undefined) {
  return value ? "Yes" : "No";
}

function normaliseText(value: unknown, fallback = "Not specified") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normaliseSkills(value: DispatchJobInput["skills_required"]) {
  const items = normaliseStringList(value);
  return items.length ? items.join(", ") : "Not specified";
}

export function buildDispatchMessage(job: DispatchJobInput, alertStyle: string) {
  const role = normaliseText(job.required_role || job.title);
  const needed =
    typeof job.headcount_required === "number" && job.headcount_required > 0
      ? `${job.headcount_required} worker${job.headcount_required > 1 ? "s" : ""}`
      : "Not specified";
  const payRate =
    job.pay_rate !== null && job.pay_rate !== undefined && String(job.pay_rate).trim()
      ? String(job.pay_rate)
      : "Not specified";
  const dbsRequired =
    String(job.dbs_requirement ?? "").toLowerCase().includes("enhanced")
      ? "Yes"
      : String(job.dbs_requirement ?? "").trim()
        ? String(job.dbs_requirement)
        : "No";

  return `[ALERT TYPE]: ${alertStyle}

Client: ${normaliseText(job.provider_name)}

Job: ${normaliseText(job.title)}

Role: ${role}

Needed: ${needed}

Location: ${normaliseText(job.location)}

Start Date: ${normaliseText(job.starts_at)}

Pay Rate: ${payRate}

Duties: ${normaliseText(job.duties)}

Skills Required: ${normaliseSkills(job.skills_required)}

PPE Required: ${yesNo(Boolean(job.ppe_required))}

Enhanced DBS Required: ${dbsRequired}
${job.payment_reliability_label ? `\n${job.payment_reliability_label}\n` : ""}
${job.platform_trust_label ? `\n${job.platform_trust_label}\n` : ""}

Reply with Yes please.`;
}
