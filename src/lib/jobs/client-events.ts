export const JOB_CREATED_EVENT = "workforce-dispatch:job-created";
export const MAP_DATA_REFRESH_EVENT = "workforce-dispatch:map-data-refresh";
export const JOB_UPDATED_EVENT = "jobs:updated";

export function notifyMapDataChanged(detail?: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(MAP_DATA_REFRESH_EVENT, {
      detail,
    }),
  );

  try {
    window.localStorage.setItem("workforce-dispatch:last-map-refresh-at", String(Date.now()));
  } catch {}
}

export function notifyJobCreated(savedJob: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(JOB_CREATED_EVENT, {
      detail: savedJob,
    }),
  );

  notifyMapDataChanged(savedJob);

  try {
    window.localStorage.setItem("workforce-dispatch:last-job-created-at", String(Date.now()));
  } catch {}
}

export function emitMapRefresh(detail?: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(JOB_UPDATED_EVENT));
  notifyMapDataChanged(detail);
}
