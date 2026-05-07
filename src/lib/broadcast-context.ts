const STORAGE_KEY = "workforce-dispatch-broadcast-context";

export type BroadcastContextPreference = "standard" | "onboarding";

export function readBroadcastContextPreference(): BroadcastContextPreference {
  if (typeof window === "undefined") {
    return "standard";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "onboarding" ? "onboarding" : "standard";
}

export function writeBroadcastContextPreference(value: BroadcastContextPreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent("broadcast-context-change", { detail: value }));
}
