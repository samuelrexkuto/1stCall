import type { StructuredJobIntake } from "@/lib/job-intake/schema";
import type { ResolvedLocationPayload } from "@/lib/location";

export const WORKFORCE_DISPATCH_AI_STATE_KEY = "workforce-dispatch-ai-state-v1";
export const WORKFORCE_DISPATCH_AI_UPDATED_EVENT = "workforce-dispatch-ai:updated";

export interface WorkforceDispatchAIState {
  promptText: string;
  structuredJob: StructuredJobIntake | null;
  resolvedLocation?: ResolvedLocationPayload | null;
  updatedAt: string;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readWorkforceDispatchAIState(): WorkforceDispatchAIState | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(WORKFORCE_DISPATCH_AI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      promptText: typeof parsed.promptText === "string" ? parsed.promptText : "",
      structuredJob: parsed.structuredJob ?? null,
      resolvedLocation: parsed.resolvedLocation ?? null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeWorkforceDispatchAIState(state: WorkforceDispatchAIState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(WORKFORCE_DISPATCH_AI_STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(WORKFORCE_DISPATCH_AI_UPDATED_EVENT));
}
