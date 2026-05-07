import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getPaygAllowanceForPack } from "@/lib/billing";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function updateProviderWithFallback(
  providerId: string,
  values: Record<string, unknown>,
  fallbackValues?: Record<string, unknown>,
) {
  const supabase = createAdminSupabaseClient();
  const primary = await supabase.from("job_providers").update(values).eq("id", providerId);
  if (!primary.error) {
    return primary;
  }

  const byProviderId = await supabase.from("job_providers").update(values).eq("provider_id", providerId);
  if (!byProviderId.error || !fallbackValues) {
    return byProviderId;
  }

  const fallbackById = await supabase.from("job_providers").update(fallbackValues).eq("id", providerId);
  if (!fallbackById.error) {
    return fallbackById;
  }

  return supabase.from("job_providers").update(fallbackValues).eq("provider_id", providerId);
}

async function updateLinkedProjectAccount(providerId: string, values: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  const projectValues: Record<string, unknown> = {};
  for (const key of [
    "account_tier",
    "access_tier",
    "access_status",
    "billing_status",
    "monthly_active",
    "trial_access",
    "trial_status",
    "trial_access_level",
    "trial_start_date",
    "trial_end_date",
    "dispatch_allowance_remaining",
    "dispatch_access_source",
  ]) {
    if (key in values) projectValues[key] = values[key];
  }
  if (Object.keys(projectValues).length === 0) return;
  await supabase.from("project_management_accounts").update(projectValues).eq("provider_id", providerId);
}

async function updateProviderAndLinkedAccount(
  providerId: string,
  values: Record<string, unknown>,
  fallbackValues?: Record<string, unknown>,
) {
  const result = await updateProviderWithFallback(providerId, values, fallbackValues);
  if (!result.error) {
    await updateLinkedProjectAccount(providerId, values);
  }
  return result;
}

function verifyStripeSignature(payload: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, error: "Stripe webhook secret is not configured." };
  }
  if (!signatureHeader) {
    return { ok: false, error: "Missing Stripe signature." };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    return { ok: false, error: "Invalid Stripe signature header." };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const actual = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
    return { ok: false, error: "Invalid Stripe signature." };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = verifyStripeSignature(rawBody, request.headers.get("stripe-signature"));
  if (!signature.ok) {
    return NextResponse.json({ success: false, error: signature.error }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid webhook payload." }, { status: 400 });
  }
  const eventObject = readObject(event);
  const type = typeof eventObject?.type === "string" ? eventObject.type : "";
  const dataObject = readObject(readObject(eventObject?.data)?.object);
  const metadata = readObject(dataObject?.metadata);
  const customerIdForLookup = typeof dataObject?.customer === "string" ? dataObject.customer : null;
  const subscriptionIdForLookup = typeof dataObject?.subscription === "string"
    ? dataObject.subscription
    : typeof dataObject?.id === "string" && type.startsWith("customer.subscription.")
      ? dataObject.id
      : null;
  const providerId =
    typeof metadata?.provider_id === "string"
      ? metadata.provider_id
      : await resolveProviderId(customerIdForLookup, subscriptionIdForLookup);

  if (!providerId) {
    return NextResponse.json({ received: true, skipped: true });
  }

  const supabase = createAdminSupabaseClient();

  if (type === "checkout.session.completed") {
    const productKey = metadata?.product_key;
    const customerId = typeof dataObject?.customer === "string" ? dataObject.customer : null;
    const subscriptionId = typeof dataObject?.subscription === "string" ? dataObject.subscription : null;

    if (productKey === "monthly") {
      await updateProviderAndLinkedAccount(
        providerId,
        {
          account_tier: "monthly_full_access",
          access_tier: "monthly_full_access",
          access_status: "active",
          dispatch_access_source: "monthly",
          billing_status: "active",
          monthly_active: true,
          is_trial_month: false,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_subscription_status: "active",
        },
        {
          account_tier: "monthly_full_access",
          billing_status: "active",
          monthly_active: true,
          trial_status: "none",
        },
      );
    }

    if (productKey === "payg_3" || productKey === "payg_5" || productKey === "payg_10") {
      const allowance = getPaygAllowanceForPack(productKey);
      const existing = await supabase
        .from("job_providers")
        .select("payg_dispatch_allowance_remaining")
        .eq("id", providerId)
        .maybeSingle();
      const fallbackExisting =
        existing.error || !existing.data
          ? await supabase
              .from("job_providers")
              .select("payg_dispatch_allowance_remaining")
              .eq("provider_id", providerId)
              .maybeSingle()
          : existing;
      const currentRemaining =
        typeof fallbackExisting.data?.payg_dispatch_allowance_remaining === "number"
          ? fallbackExisting.data.payg_dispatch_allowance_remaining
          : 0;

      await updateProviderAndLinkedAccount(
        providerId,
        {
          account_tier: "payg",
          access_tier: "payg",
          access_status: "active",
          dispatch_access_source: "payg",
          billing_status: "active",
          payg_pack_type: productKey,
          payg_pack: productKey,
          payg_dispatch_allowance_total: allowance,
          payg_dispatch_allowance_remaining: currentRemaining + allowance,
          payg_allowance_total: allowance,
          payg_allowance_remaining: currentRemaining + allowance,
          dispatch_allowance_remaining: currentRemaining + allowance,
          monthly_active: false,
          stripe_customer_id: customerId,
        },
        {
          account_tier: "payg",
          billing_status: "active",
          payg_pack_type: productKey,
          payg_dispatch_allowance_total: allowance,
          payg_dispatch_allowance_remaining: currentRemaining + allowance,
          monthly_active: false,
        },
      );
    }
  }

  if (type === "customer.subscription.created" || type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const subscriptionStatus =
      typeof dataObject?.status === "string" ? dataObject.status : type === "customer.subscription.deleted" ? "cancelled" : "active";
    const customerId = typeof dataObject?.customer === "string" ? dataObject.customer : null;
    const subscriptionId = typeof dataObject?.id === "string" ? dataObject.id : null;
    const currentPeriodEnd =
      typeof dataObject?.current_period_end === "number"
        ? new Date(dataObject.current_period_end * 1000).toISOString().slice(0, 10)
        : null;

    await updateProviderAndLinkedAccount(
      providerId,
      {
        account_tier: subscriptionStatus === "active" ? "monthly_full_access" : "free_preview",
        access_tier: subscriptionStatus === "active" ? "monthly_full_access" : "free_preview",
        access_status: subscriptionStatus === "active" ? "active" : "inactive",
        dispatch_access_source: subscriptionStatus === "active" ? "monthly" : "free_preview",
        billing_status: subscriptionStatus === "active" ? "active" : "inactive",
        monthly_active: subscriptionStatus === "active",
        monthly_renewal_date: currentPeriodEnd,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_subscription_status: subscriptionStatus,
      },
      {
        account_tier: subscriptionStatus === "active" ? "monthly_full_access" : "free_preview",
        billing_status: subscriptionStatus === "active" ? "active" : "inactive",
        monthly_active: subscriptionStatus === "active",
        monthly_renewal_date: currentPeriodEnd,
      },
    );
  }

  if (type === "invoice.paid" || type === "invoice.payment_failed") {
    const paid = type === "invoice.paid";
    await updateProviderAndLinkedAccount(
      providerId,
      {
        billing_status: paid ? "active" : "past_due",
        monthly_active: paid,
        stripe_customer_id: typeof dataObject?.customer === "string" ? dataObject.customer : null,
        stripe_subscription_id: typeof dataObject?.subscription === "string" ? dataObject.subscription : null,
        stripe_subscription_status: paid ? "active" : "past_due",
      },
      {
        billing_status: paid ? "active" : "past_due",
        monthly_active: paid,
      },
    );
  }

  return NextResponse.json({ received: true });
}

async function resolveProviderId(customerId: string | null, subscriptionId: string | null) {
  if (!customerId && !subscriptionId) return null;
  const supabase = createAdminSupabaseClient();
  if (customerId) {
    const byCustomer = await supabase
      .from("job_providers")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (!byCustomer.error && byCustomer.data?.id) return String(byCustomer.data.id);
  }
  if (subscriptionId) {
    const bySubscription = await supabase
      .from("job_providers")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (!bySubscription.error && bySubscription.data?.id) return String(bySubscription.data.id);
  }
  return null;
}
