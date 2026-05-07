import type { WorkerOverviewRow } from "@/lib/workers/types";

export const SAVED_WORKERS_STORAGE_KEY = "saved-workers-v1";
export const SAVED_WORKERS_UPDATED_EVENT = "saved-workers:updated";

export interface SavedWorkerRecord {
  id: string;
  userId: string;
  workerId: string;
  createdAt: string;
  worker: WorkerOverviewRow;
}

export interface SavedWorkersReadOptions {
  userId?: string | null;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitSavedWorkersUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SAVED_WORKERS_UPDATED_EVENT));
  }
}

export function readSavedWorkers(options?: SavedWorkersReadOptions): SavedWorkerRecord[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(SAVED_WORKERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : [];
    if (!options?.userId) return records;
    return records.filter((record) => record.userId === options.userId);
  } catch {
    return [];
  }
}

function writeSavedWorkers(records: SavedWorkerRecord[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SAVED_WORKERS_STORAGE_KEY, JSON.stringify(records));
  emitSavedWorkersUpdated();
}

export function isWorkerSaved(workerId: string, userId?: string | null) {
  return readSavedWorkers({ userId }).some((record) => record.workerId === workerId);
}

export function saveWorker(worker: WorkerOverviewRow, userId = "job-provider-local") {
  const current = readSavedWorkers();
  if (current.some((record) => record.workerId === worker.worker_id && record.userId === userId)) {
    return current;
  }

  const next = [
    {
      id: `${userId}:${worker.worker_id}`,
      userId,
      workerId: worker.worker_id,
      createdAt: new Date().toISOString(),
      worker,
    },
    ...current,
  ];
  writeSavedWorkers(next);
  return next;
}

export function removeSavedWorker(workerId: string, userId?: string | null) {
  const next = readSavedWorkers().filter((record) =>
    userId ? !(record.workerId === workerId && record.userId === userId) : record.workerId !== workerId,
  );
  writeSavedWorkers(next);
  return next;
}

export function toggleSavedWorker(worker: WorkerOverviewRow, userId = "job-provider-local") {
  if (isWorkerSaved(worker.worker_id, userId)) {
    return {
      saved: false,
      records: removeSavedWorker(worker.worker_id, userId),
    };
  }

  return {
    saved: true,
    records: saveWorker(worker, userId),
  };
}
