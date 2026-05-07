import type { StructuredJobIntake } from "@/lib/job-intake/schema";

const weekdayMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveRelativeWeekday(sourceText: string, baseDate: Date) {
  const lower = sourceText.toLowerCase();

  for (const [weekday, weekdayIndex] of Object.entries(weekdayMap)) {
    const hasWeekday = lower.includes(weekday);
    if (!hasWeekday) continue;

    const hasNextWeek = new RegExp(`next week\\s+${weekday}|${weekday}\\s+next week`).test(lower);
    const hasNext = new RegExp(`next\\s+${weekday}`).test(lower);
    const hasThis = new RegExp(`this\\s+${weekday}`).test(lower);

    if (!hasNextWeek && !hasNext && !hasThis && !hasWeekday) continue;

    const currentDay = baseDate.getDay();
    let offset = (weekdayIndex - currentDay + 7) % 7;

    if (hasNextWeek || hasNext || (offset === 0 && hasWeekday)) {
      offset += 7;
    } else if (!hasThis && offset === 0) {
      offset = 7;
    }

    return formatDate(addDays(baseDate, offset));
  }

  return null;
}

function extractDurationDays(sourceText: string, duration: string | null) {
  const match = sourceText.toLowerCase().match(/\b(\d+)\s+(day|days)\b/);
  if (match) return Number(match[1]);

  const durationMatch = duration?.toLowerCase().match(/\b(\d+)\s+(day|days)\b/);
  if (durationMatch) return Number(durationMatch[1]);

  return null;
}

function normalizeMissingFields(job: StructuredJobIntake) {
  const fields: Array<[keyof StructuredJobIntake | "pay_rate" | "ipaf_required" | "own_tools_required" | "ppe_required" | "skills_required" | "payment_type" | "shift_pattern" | "tickets_required", boolean]> = [
    ["pay_rate", !job.pay_rate],
    ["duties", !job.duties],
    ["end_date", !job.end_date],
    ["own_tools_required", job.own_tools_required === null],
    ["ppe_required", job.ppe_required === null],
  ];

  return fields.filter(([, isMissing]) => isMissing).map(([field]) => field);
}

export function enrichStructuredJobIntakeDates(
  job: StructuredJobIntake,
  sourceText: string,
  now = new Date(),
): StructuredJobIntake {
  const nextJob = { ...job };
  const resolvedStartDate =
    parseIsoDate(nextJob.start_date)?.toISOString().slice(0, 10) ??
    resolveRelativeWeekday(sourceText, now) ??
    nextJob.start_date;

  nextJob.start_date = resolvedStartDate ?? null;

  const durationDays = extractDurationDays(sourceText, nextJob.duration);
  const startDate = parseIsoDate(nextJob.start_date);

  if (startDate && durationDays && durationDays > 0 && !nextJob.end_date) {
    nextJob.end_date = formatDate(addDays(startDate, durationDays - 1));
  }

  nextJob.missing_fields = normalizeMissingFields(nextJob);
  return nextJob;
}
