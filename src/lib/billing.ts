import type { ProviderPaygPackType } from "@/lib/auth/types";

export const BILLING_PRODUCTS = {
  payg_3: { label: "Buy 3 dispatches", priceGbp: 39, dispatches: 3, mode: "payment" as const },
  payg_5: { label: "Buy 5 dispatches", priceGbp: 59, dispatches: 5, mode: "payment" as const },
  payg_10: { label: "Buy 10 dispatches", priceGbp: 99, dispatches: 10, mode: "payment" as const },
  monthly: { label: "Monthly Membership", priceGbp: 249, dispatches: null, mode: "subscription" as const },
};

export type BillingProductKey = keyof typeof BILLING_PRODUCTS;

export function getStripeBaseUrl() {
  return process.env.STRIPE_API_BASE_URL ?? "https://api.stripe.com/v1";
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getStripePriceId(product: BillingProductKey) {
  const mapping: Record<BillingProductKey, string | undefined> = {
    payg_3: process.env.STRIPE_PRICE_PAYG_3,
    payg_5: process.env.STRIPE_PRICE_PAYG_5,
    payg_10: process.env.STRIPE_PRICE_PAYG_10,
    monthly: process.env.STRIPE_PRICE_MONTHLY,
  };

  return mapping[product];
}

export function toStripeFormBody(
  data: Record<string, string | number | null | undefined>,
  listData?: Record<string, Array<string>>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }

  if (listData) {
    for (const [key, values] of Object.entries(listData)) {
      values.forEach((value, index) => {
        params.set(`${key}[${index}]`, value);
      });
    }
  }

  return params.toString();
}

export async function callStripeApi(path: string, body: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY and the relevant STRIPE_PRICE_* env vars.");
  }

  const response = await fetch(`${getStripeBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Stripe request failed.";
    throw new Error(message);
  }

  return payload as Record<string, unknown>;
}

export function getPaygAllowanceForPack(packType: ProviderPaygPackType) {
  if (!packType) return 0;
  return BILLING_PRODUCTS[packType].dispatches ?? 0;
}
