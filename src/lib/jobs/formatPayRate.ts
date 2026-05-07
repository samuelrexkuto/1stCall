function normalizePaymentType(paymentType: string | null | undefined) {
  const value = paymentType?.trim().toLowerCase();
  if (!value) return null;

  if (value === "hourly" || value === "hour" || value === "per hour") return "hourly";
  if (value === "daily" || value === "day" || value === "per day") return "daily";
  if (value === "price work" || value === "price_work") return "price_work";
  if (value === "fixed shift rate" || value === "fixed_shift_rate") return "fixed_shift_rate";

  return value;
}

function hasCurrencyOrSuffix(payRate: string) {
  return /£|\$|€|\/|per\s|hour|day|shift|price/i.test(payRate);
}

export function formatPayRate(
  payRate: string | null | undefined,
  paymentType: string | null | undefined,
) {
  const trimmedRate = payRate?.trim();
  if (!trimmedRate) {
    return null;
  }

  if (hasCurrencyOrSuffix(trimmedRate)) {
    return trimmedRate;
  }

  const normalizedType = normalizePaymentType(paymentType);
  const prefixedRate = /^\d+(\.\d+)?$/.test(trimmedRate) ? `£${trimmedRate}` : trimmedRate;

  switch (normalizedType) {
    case "hourly":
      return `${prefixedRate}/hour`;
    case "daily":
      return `${prefixedRate}/day`;
    case "fixed_shift_rate":
      return `${prefixedRate}/shift`;
    case "price_work":
      return trimmedRate;
    default:
      return prefixedRate;
  }
}
