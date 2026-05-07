export type WorkerAlertDraft = {
  role?: string;
  primaryRole?: string;
  title?: string;
  location?: string;
  address?: string;
  postcode?: string;
  payRate?: string | number;
  rate?: string | number;
  payType?: "hour" | "day" | "week" | "fixed" | string;
  startDate?: string;
  startTime?: string;
  duration?: string;
  headcount?: string | number;
  requiredWorkers?: string | number;
  skills?: string[];
  duties?: string[] | string;
  ppe?: string[] | string;
  compliance?: string[];
  requirements?: string[];
  cscsRequired?: boolean;
  dbsRequired?: boolean;
  enhancedDbsRequired?: boolean;
  siaRequired?: boolean;
  ipafRequired?: boolean;
  firstAidRequired?: boolean;
};

function clean(value: unknown, fallback: string) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function joinList(value: unknown, fallback: string) {
  if (Array.isArray(value)) {
    const filtered = value.filter(Boolean).map(String);
    return filtered.length ? filtered.join(", ") : fallback;
  }

  if (typeof value === "string" && value.trim()) return value;

  return fallback;
}

export function formatWorkerAlert(job: WorkerAlertDraft = {}) {
  const role =
    job.role ||
    job.primaryRole ||
    job.title ||
    "Role pending";

  const location =
    job.location ||
    job.address ||
    job.postcode ||
    "Location pending";

  const rawPay = job.payRate || job.rate;
  const payType = job.payType || "day";
  const pay = rawPay ? `£${rawPay}/${payType}` : "Pay TBC";

  const startDate = clean(job.startDate, "Start date TBC");
  const startTime = clean(job.startTime, "Time TBC");
  const start = `${startDate}${startTime !== "Time TBC" ? ` at ${startTime}` : ""}`;

  const duration = clean(job.duration, "Duration TBC");
  const headcount = clean(job.headcount || job.requiredWorkers, "TBC");

  const skills = joinList(job.skills, "Skills TBC");
  const duties = joinList(job.duties, "Duties TBC");
  const ppe = joinList(job.ppe, "PPE TBC");

  const complianceItems = [
    ...(job.compliance || []),
    ...(job.requirements || []),
    job.cscsRequired ? "CSCS" : null,
    job.dbsRequired ? "DBS" : null,
    job.enhancedDbsRequired ? "Enhanced DBS" : null,
    job.siaRequired ? "SIA" : null,
    job.ipafRequired ? "IPAF" : null,
    job.firstAidRequired ? "First Aid" : null,
  ].filter(Boolean) as string[];

  const compliance = complianceItems.length
    ? Array.from(new Set(complianceItems)).join(", ")
    : "Compliance TBC";

  return {
    appName: "1stCall Dispatch",
    title: "New Job Alert",
    role,
    location,
    pay,
    start,
    duration,
    headcount,
    shortBody: `${role} needed in ${location}`,
    shortMeta: `${pay} · Starts ${startDate} · Reply YES`,
    fullMessage: [
      "New Job Alert",
      "",
      `Role: ${role}`,
      `Location: ${location}`,
      `Pay: ${pay}`,
      `Start: ${start}`,
      `Duration: ${duration}`,
      `Workers needed: ${headcount}`,
      "",
      `Skills: ${skills}`,
      `Duties: ${duties}`,
      `PPE: ${ppe}`,
      `Compliance: ${compliance}`,
      "",
      "Reply YES to accept / NO to decline.",
    ].join("\n"),
  };
}
