import type { CreateJobInput } from "@/lib/validation/schemas";

const STORAGE_KEY = "manual-job-draft-v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveManualJobDraft(draft: Partial<CreateJobInput>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function readManualJobDraft(): Partial<CreateJobInput> | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearManualJobDraft() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
