export function normaliseStringList(value: unknown): string[] {
  if (value == null) return []

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normaliseStringList(item))
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()

    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed)

      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((item) => normaliseStringList(item))
          .map((item) => item.trim())
          .filter(Boolean)
      }
    } catch {
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const inner = trimmed.slice(1, -1).trim()
        if (!inner) return []
        return inner
          .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
          .map((item) => item.trim().replace(/^"(.*)"$/, "$1").trim())
          .filter(Boolean)
      }
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === "object") {
    return []
  }

  return [String(value).trim()].filter(Boolean)
}
