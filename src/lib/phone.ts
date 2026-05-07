export function normalizeUkPhoneNumber(phone: string | null | undefined) {
  if (!phone) {
    return null;
  }

  const compact = phone.replace(/\s+/g, "").trim();

  if (!compact) {
    return null;
  }

  const digits = compact.replace(/[^\d+]/g, "");

  if (digits.startsWith("+44")) {
    const normalized = `+44${digits.slice(3).replace(/\D/g, "")}`;
    return /^(\+447\d{9})$/.test(normalized) ? normalized : null;
  }

  if (digits.startsWith("44")) {
    const normalized = `+44${digits.slice(2).replace(/\D/g, "")}`;
    return /^(\+447\d{9})$/.test(normalized) ? normalized : null;
  }

  if (digits.startsWith("0")) {
    const normalized = `+44${digits.slice(1).replace(/\D/g, "")}`;
    return /^(\+447\d{9})$/.test(normalized) ? normalized : null;
  }

  return /^\+447\d{9}$/.test(digits) ? digits : null;
}

export function deriveWhatsappNumber(phone: string | null | undefined, whatsappOptIn: boolean) {
  if (!whatsappOptIn) {
    return null;
  }

  return normalizeUkPhoneNumber(phone);
}
