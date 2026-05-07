import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import { callStripeApi, getAppBaseUrl, toStripeFormBody } from "@/lib/billing";
import { loadProviderAccount } from "@/lib/provider-account";

export async function POST() {
  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const provider = await loadProviderAccount(currentUser.providerId);
  if (!provider) {
    return NextResponse.json({ success: false, error: "Provider account not found." }, { status: 404 });
  }

  if (!provider.stripeCustomerId) {
    return NextResponse.json(
      { success: false, error: "No Stripe customer is linked to this provider account yet." },
      { status: 400 },
    );
  }

  try {
    const payload = await callStripeApi(
      "/billing_portal/sessions",
      toStripeFormBody({
        customer: provider.stripeCustomerId,
        return_url: `${getAppBaseUrl()}/account`,
      }),
    );

    return NextResponse.json({
      success: true,
      url: typeof payload.url === "string" ? payload.url : null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to open Stripe billing portal." },
      { status: 500 },
    );
  }
}
