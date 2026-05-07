import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import { BILLING_PRODUCTS, callStripeApi, getAppBaseUrl, getStripePriceId, type BillingProductKey } from "@/lib/billing";
import { loadProviderAccount } from "@/lib/provider-account";

function isCheckoutProduct(value: unknown): value is BillingProductKey {
  return value === "payg_3" || value === "payg_5" || value === "payg_10" || value === "monthly";
}

export async function POST(request: Request) {
  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const product: BillingProductKey | null = isCheckoutProduct(body?.product) ? body.product : null;
  if (!product) {
    return NextResponse.json({ success: false, error: "Select a valid billing product." }, { status: 400 });
  }

  const provider = await loadProviderAccount(currentUser.providerId);
  if (!provider) {
    return NextResponse.json({ success: false, error: "Provider account not found." }, { status: 404 });
  }

  const priceId = getStripePriceId(product);
  if (!priceId) {
    return NextResponse.json(
      { success: false, error: `Stripe price is not configured for ${product}. Add the STRIPE_PRICE_* env vars.` },
      { status: 503 },
    );
  }

  const productConfig = BILLING_PRODUCTS[product];
  const appBaseUrl = getAppBaseUrl();
  const params = new URLSearchParams();
  params.set("mode", productConfig.mode);
  params.set("success_url", `${appBaseUrl}/account?billing=success`);
  params.set("cancel_url", `${appBaseUrl}/account?billing=cancelled`);
  params.set("customer_email", provider.email ?? currentUser.email);
  params.set("metadata[provider_id]", provider.id);
  params.set("metadata[product_key]", product);
  params.set("metadata[account_tier]", product === "monthly" ? "monthly_full_access" : "payg");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");

  try {
    const payload = await callStripeApi("/checkout/sessions", params.toString());
    return NextResponse.json({
      success: true,
      url: typeof payload.url === "string" ? payload.url : null,
      sessionId: typeof payload.id === "string" ? payload.id : null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to start Stripe checkout." },
      { status: 500 },
    );
  }
}
