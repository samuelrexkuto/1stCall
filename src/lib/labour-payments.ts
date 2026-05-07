export type LabourPaymentCycle = "weekly" | "fortnightly";
export type LabourPaymentStatus =
  | "not_ready"
  | "preliminary_notice_sent"
  | "approved_for_payment"
  | "scheduled"
  | "paid"
  | "overdue"
  | "held"
  | "disputed"
  | "cancelled";

export interface WorkerPaymentSummary {
  paymentCycle: LabourPaymentCycle;
  cycleStart: string;
  cycleEnd: string;
  nextPaymentDueDate: string;
  lastPaymentDate: string | null;
  workedDays: number;
  dayRate: number;
  estimatedAmountDue: number;
  paymentStatus: LabourPaymentStatus;
  isEstimated: boolean;
  alertDue: boolean;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetweenInclusive(start: Date, end: Date) {
  if (end.getTime() < start.getTime()) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function normaliseCycle(value: unknown): LabourPaymentCycle {
  return value === "fortnightly" ? "fortnightly" : "weekly";
}

function normaliseStatus(value: unknown): LabourPaymentStatus {
  const valid: LabourPaymentStatus[] = [
    "not_ready",
    "preliminary_notice_sent",
    "approved_for_payment",
    "scheduled",
    "paid",
    "overdue",
    "held",
    "disputed",
    "cancelled",
  ];
  return valid.includes(value as LabourPaymentStatus) ? value as LabourPaymentStatus : "not_ready";
}

export function calculateWorkerPaymentSummary(input: {
  assignment: Record<string, unknown>;
  worker?: Record<string, unknown> | null;
  job: Record<string, unknown>;
  today?: Date;
  payoutDelayDays?: number;
  attendanceRecords?: Array<{ worked_date?: string | null; date?: string | null; status?: string | null }>;
}): WorkerPaymentSummary {
  const today = input.today ? new Date(input.today) : new Date();
  today.setUTCHours(0, 0, 0, 0);
  const paymentCycle = normaliseCycle(input.assignment.payment_cycle);
  const cycleLength = paymentCycle === "fortnightly" ? 14 : 7;
  const anchor =
    parseDate(input.assignment.payment_cycle_anchor_date) ??
    parseDate(input.assignment.confirmed_start_date) ??
    parseDate(input.job.starts_at) ??
    parseDate(input.assignment.created_at) ??
    today;
  let cycleStart = new Date(anchor);
  while (addDays(cycleStart, cycleLength).getTime() <= today.getTime()) {
    cycleStart = addDays(cycleStart, cycleLength);
  }
  while (cycleStart.getTime() > today.getTime()) {
    cycleStart = addDays(cycleStart, -cycleLength);
  }
  const cycleEnd = addDays(cycleStart, cycleLength - 1);
  const manualNextDue = parseDate(input.assignment.next_payment_due_date);
  const nextDue = manualNextDue ?? addDays(cycleEnd, input.payoutDelayDays ?? 7);
  const assignmentEnd = parseDate(input.assignment.confirmed_end_date);
  const jobEnd = parseDate(input.job.end_date);
  const workEndCandidates = [today, cycleEnd, assignmentEnd, jobEnd].filter(Boolean) as Date[];
  const workEnd = new Date(Math.min(...workEndCandidates.map((date) => date.getTime())));
  const exactAttendance = (input.attendanceRecords ?? []).filter((record) => {
    const workedDate = parseDate(record.worked_date ?? record.date);
    if (!workedDate) return false;
    if (record.status && !["confirmed", "approved", "worked"].includes(record.status)) return false;
    return workedDate.getTime() >= cycleStart.getTime() && workedDate.getTime() <= cycleEnd.getTime();
  });
  const storedWorkedDays = Number(input.assignment.worked_days_current_cycle ?? 0);
  const workedDays = exactAttendance.length > 0
    ? exactAttendance.length
    : storedWorkedDays > 0
      ? storedWorkedDays
      : daysBetweenInclusive(cycleStart, workEnd);
  const dayRate = Number(input.assignment.day_rate ?? input.job.pay_rate ?? 0) || 0;
  const paymentStatus = normaliseStatus(input.assignment.payment_status);
  const estimatedAmountDue = Number((workedDays * dayRate).toFixed(2));
  const alertDue =
    nextDue.getTime() <= today.getTime() &&
    !["paid", "cancelled", "scheduled", "held"].includes(paymentStatus);

  return {
    paymentCycle,
    cycleStart: toDateString(cycleStart),
    cycleEnd: toDateString(cycleEnd),
    nextPaymentDueDate: toDateString(nextDue),
    lastPaymentDate: parseDate(input.assignment.last_payment_date)
      ? toDateString(parseDate(input.assignment.last_payment_date) as Date)
      : null,
    workedDays,
    dayRate,
    estimatedAmountDue,
    paymentStatus,
    isEstimated: exactAttendance.length === 0,
    alertDue,
  };
}

export function formatLabourPaymentStatus(status: LabourPaymentStatus | string | null | undefined) {
  const labels: Record<LabourPaymentStatus, string> = {
    not_ready: "Not ready",
    preliminary_notice_sent: "Preliminary notice sent",
    approved_for_payment: "Approved for payment",
    scheduled: "Scheduled",
    paid: "Paid",
    overdue: "Overdue",
    held: "Held",
    disputed: "Disputed",
    cancelled: "Cancelled",
  };
  return labels[normaliseStatus(status)] ?? "Not ready";
}
