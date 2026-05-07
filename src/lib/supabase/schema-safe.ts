export interface SchemaSafeResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
  attempt: string;
  usedFallback: boolean;
}

function toErrorLike(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = error as { message?: unknown; code?: unknown };
  if (typeof value.message !== "string") return null;
  return {
    message: value.message,
    code: typeof value.code === "string" ? value.code : undefined,
  };
}

export function isMissingColumnError(message: string, columns?: string[]) {
  const lower = message.toLowerCase();
  if (!lower.includes("does not exist") && !lower.includes("schema cache") && !lower.includes("could not find the")) {
    return false;
  }

  if (!columns?.length) return true;
  return columns.some((column) => lower.includes(column.toLowerCase()));
}

export async function runSchemaSafeQuery<T>(
  attempts: Array<{
    label: string;
    query: () => Promise<{ data: unknown; error: unknown }>;
    missingColumns?: string[];
  }>,
): Promise<SchemaSafeResult<T>> {
  let lastError: { message: string; code?: string } | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const result = await attempt.query();
    const error = toErrorLike(result.error);

    if (!error) {
      return {
        data: (result.data as T | null) ?? null,
        error: null,
        attempt: attempt.label,
        usedFallback: index > 0,
      };
    }

    lastError = error;
    if (!isMissingColumnError(error.message, attempt.missingColumns)) {
      return {
        data: (result.data as T | null) ?? null,
        error,
        attempt: attempt.label,
        usedFallback: index > 0,
      };
    }
  }

  return {
    data: null,
    error: lastError,
    attempt: attempts[attempts.length - 1]?.label ?? "unknown",
    usedFallback: attempts.length > 1,
  };
}
