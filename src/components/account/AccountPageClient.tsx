"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { BILLING_PRODUCTS } from "@/lib/billing";
import { getAccountEntitlements, normalizeAccountTier } from "@/lib/provider-access";
import { isProviderTrialActive, type ProviderAccountRecord } from "@/lib/provider-account";

export function AccountPageClient({
  initialAccount,
  initialNotice = "",
}: {
  initialAccount: ProviderAccountRecord;
  initialNotice?: string;
}) {
  const { setUser } = useAuthSession();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState(initialAccount);
  const [form, setForm] = useState({
    name: initialAccount.name,
    email: initialAccount.email ?? "",
    avatarUrl: initialAccount.avatarUrl ?? "",
    phone: initialAccount.phone ?? "",
    town: initialAccount.town ?? "",
    postcode: initialAccount.postcode ?? "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(initialAccount.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(initialNotice);
  const [billingBusy, setBillingBusy] = useState<null | string>(null);

  useEffect(() => {
    if (searchParams.get("billing") !== "success") {
      return;
    }

    let cancelled = false;
    async function refreshAccount() {
      const response = await fetch("/api/account", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || cancelled) {
        return;
      }
      setAccount(payload.provider);
      if (payload.user) {
        setUser(payload.user);
      }
      setFeedback("Billing update received. Your account status has been refreshed.");
    }

    void refreshAccount();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const planLabel = useMemo(() => {
    if (account.billingStatus === "expired" && account.isTrialMonth) return "Trial Expired";
    const tier = normalizeAccountTier(account.accessTier ?? account.accountTier);
    if (tier === "monthly_full_access") return "Monthly Membership";
    if (tier === "trial_full_access") return "Free";
    if (tier === "payg") return "PAYG";
    return "Free";
  }, [account.accountTier, account.accessTier, account.billingStatus, account.isTrialMonth]);
  const trialActive = isProviderTrialActive(account);
  const entitlements = getAccountEntitlements({
    accessTier: account.accessTier,
    accessStatus: account.accessStatus,
    accountTier: account.accountTier,
    billingStatus: account.billingStatus,
    paygPackType: account.paygPackType,
    paygDispatchAllowanceTotal: account.paygDispatchAllowanceTotal,
    paygDispatchAllowanceRemaining: account.paygDispatchAllowanceRemaining,
    monthlyRenewalDate: account.monthlyRenewalDate,
    monthlyActive: account.monthlyActive,
    activeSubscription: account.activeSubscription,
    trialAccess: account.trialAccess,
    isTrialMonth: account.isTrialMonth,
    trialGrantedByAdmin: account.trialGrantedByAdmin,
    trialStartDate: account.trialStartDate,
    trialEndDate: account.trialEndDate,
    trialStatus: account.trialStatus,
    trialAccessLevel: account.trialAccessLevel,
    profileOpensThisMonth: account.profileOpensThisMonth,
    compareActionsThisMonth: account.compareActionsThisMonth,
    manualDraftsUsed: account.manualDraftsUsed,
    fullAccess: account.fullAccess,
    adminFullAccess: account.adminFullAccess,
    accessLevel: account.accessLevel,
  });
  const activeSubscription = entitlements.hasActiveSubscription;
  const billingStatusLabel = trialActive
    ? "trial"
    : account.billingStatus === "trial" && account.trialStatus !== "active"
      ? "inactive"
      : account.billingStatus;

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(form.avatarUrl);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile, form.avatarUrl]);

  async function handleSaveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");

    try {
      let avatarUrl = form.avatarUrl;
      if (avatarFile) {
        const avatarFormData = new FormData();
        avatarFormData.append("avatar", avatarFile);
        const avatarResponse = await fetch("/api/account/avatar", {
          method: "POST",
          body: avatarFormData,
        });
        const avatarPayload = await avatarResponse.json().catch(() => ({}));

        if (!avatarResponse.ok || !avatarPayload.success || typeof avatarPayload.avatarUrl !== "string") {
          setFeedback(avatarPayload.error ?? "Unable to upload profile image.");
          return;
        }

        avatarUrl = avatarPayload.avatarUrl;
      }

      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, avatarUrl }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        setFeedback(payload.error ?? "Unable to update account details.");
        return;
      }

      setAccount(payload.provider);
      setUser(payload.user);
      setAvatarFile(null);
      setForm((current) => ({ ...current, avatarUrl }));
      setFeedback("Account details updated.");
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout(product: "payg_3" | "payg_5" | "payg_10" | "monthly") {
    setBillingBusy(product);
    setFeedback("");

    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success || typeof payload.url !== "string") {
        setFeedback(payload.error ?? "Unable to start checkout.");
        return;
      }

      window.location.href = payload.url;
    } finally {
      setBillingBusy(null);
    }
  }

  async function openBillingPortal() {
    setBillingBusy("portal");
    setFeedback("");

    try {
      const response = await fetch("/api/billing/create-portal-session", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || typeof payload.url !== "string") {
        setFeedback(payload.error ?? "Unable to open billing portal.");
        return;
      }
      window.location.href = payload.url;
    } finally {
      setBillingBusy(null);
    }
  }

  return (
    <main style={{ display: "grid", gap: "1.25rem" }}>
      <section
        style={{
          padding: "1.1rem",
          borderRadius: 18,
          border: "1px solid var(--rd-border)",
          background: "var(--rd-bg-elevated)",
          display: "grid",
          gap: "0.65rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Account</h1>
        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
          Review your provider account tier, top up PAYG access, manage Monthly Membership billing, and update your company details without leaving the current workflow.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.85rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Current Plan</div>
          <strong>{planLabel}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Effective Access</div>
          <strong>{entitlements.effectiveAccessLabel}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Billing Status</div>
          <strong>{billingStatusLabel}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Dispatch Allowance Remaining</div>
          <strong>{entitlements.hasUnlimitedDispatches ? entitlements.dispatchLimitLabel : account.paygDispatchAllowanceRemaining}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Dispatch Access</div>
          <strong>{entitlements.dispatchLimitLabel}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Renewal Date</div>
          <strong>{account.monthlyRenewalDate ?? "—"}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Active Subscription</div>
          <strong>{activeSubscription ? "Yes" : "No"}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Trial Access</div>
          <strong>{trialActive ? "Yes" : "No"}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Trial Status</div>
          <strong>{account.trialStatus}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Trial Access Level</div>
          <strong>{account.trialAccessLevel === "full_access" ? "Full access" : account.trialAccessLevel ?? "—"}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Trial Start Date</div>
          <strong>{account.trialStartDate ?? "—"}</strong>
        </article>
        <article style={{ padding: "1rem", borderRadius: 16, border: "1px solid var(--rd-border)", background: "var(--rd-bg-elevated)" }}>
          <div style={{ color: "var(--rd-text-muted)", fontSize: "0.82rem" }}>Trial End Date</div>
          <strong>{account.trialEndDate ?? "—"}</strong>
        </article>
      </section>

      <section
        style={{
          padding: "1rem",
          borderRadius: 18,
          border: "1px solid var(--rd-border)",
          background: "var(--rd-bg-elevated)",
          display: "grid",
          gap: "0.85rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Plan & Billing</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
            Free is preview-only. PAYG uses prepaid dispatch packs. Monthly Membership is £249/month with unlimited dispatch requests included.
          </p>
          <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
            Billing Status: {billingStatusLabel ?? "Unavailable"} | Current PAYG Pack: {account.paygPackType ?? "Not recorded"}
          </p>
          {trialActive ? (
            <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
              Effective Access: {entitlements.effectiveAccessLabel} | Dispatch Access: {entitlements.dispatchLimitLabel} | Trial Access: Yes | Trial Status: {account.trialStatus}
              {account.trialStartDate ? ` | Trial Start: ${account.trialStartDate}` : ""}
              {account.trialEndDate ? ` | Trial Ends: ${account.trialEndDate}` : ""}.
            </p>
          ) : null}
          {account.billingStatus === "expired" ? (
            <p style={{ margin: "0.35rem 0 0", color: "#92400e" }}>
              Trial access has expired. Upgrade to continue full monthly workflow access.
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => startCheckout("monthly")} disabled={billingBusy !== null}>
            {billingBusy === "monthly" ? "Opening Monthly Checkout..." : "Upgrade to Monthly — £249/month"}
          </button>
          <button type="button" onClick={openBillingPortal} disabled={billingBusy !== null}>
            {billingBusy === "portal" ? "Opening Billing Portal..." : "Manage Billing"}
          </button>
        </div>
      </section>

      <section
        style={{
          padding: "1rem",
          borderRadius: 18,
          border: "1px solid var(--rd-border)",
          background: "var(--rd-bg-elevated)",
          display: "grid",
          gap: "0.85rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>PAYG Top Up</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
            Dispatch is included inside each PAYG pack and is not charged separately after purchase.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {(["payg_3", "payg_5", "payg_10"] as const).map((packKey) => (
            <article
              key={packKey}
              style={{
                border: "1px solid var(--rd-border)",
                borderRadius: 14,
                padding: "0.95rem",
                background: "var(--rd-surface-soft)",
                display: "grid",
                gap: "0.55rem",
              }}
            >
              <strong>{BILLING_PRODUCTS[packKey].label}</strong>
              <span style={{ color: "var(--rd-text-muted)" }}>£{BILLING_PRODUCTS[packKey].priceGbp}</span>
              <button type="button" onClick={() => startCheckout(packKey)} disabled={billingBusy !== null}>
                {billingBusy === packKey ? "Opening Checkout..." : `Top up ${BILLING_PRODUCTS[packKey].dispatches} dispatches`}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          padding: "1rem",
          borderRadius: 18,
          border: "1px solid var(--rd-border)",
          background: "var(--rd-bg-elevated)",
          display: "grid",
          gap: "0.85rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Company / Account Details</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>
            Update your company or account contact details while keeping the current provider linkage intact.
          </p>
        </div>
        <form onSubmit={handleSaveAccount} style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: "0.45rem" }}>
            Profile Image
            <span style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
              <span
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "var(--rd-surface-soft)",
                  border: "1px solid var(--rd-border)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "var(--rd-text)",
                  fontWeight: 800,
                }}
              >
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  (form.name || account.name || "RD")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("") || "RD"
                )}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
              />
            </span>
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Company / Account Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Phone
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Town
            <input value={form.town} onChange={(event) => setForm((current) => ({ ...current, town: event.target.value }))} />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Postcode
            <input value={form.postcode} onChange={(event) => setForm((current) => ({ ...current, postcode: event.target.value }))} />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Account Details"}
            </button>
          </div>
        </form>
      </section>

      <section
        style={{
          padding: "1rem",
          borderRadius: 18,
          border: "1px solid var(--rd-border)",
          background: "var(--rd-bg-elevated)",
          display: "grid",
          gap: "0.55rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Billing Management</h2>
        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
          Stripe Customer Portal is used for subscription management, payment method updates, and invoice visibility where available.
        </p>
        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
          {account.stripeCustomerId
            ? "A Stripe customer is linked to this account."
            : "Billing details unavailable right now. Stripe customer linking has not been completed for this account yet."}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={openBillingPortal} disabled={billingBusy !== null}>
            Open Billing Portal
          </button>
        </div>
      </section>

      {feedback ? (
        <section
          style={{
            padding: "0.95rem 1rem",
            borderRadius: 14,
            border: "1px solid var(--rd-border)",
            background: "var(--rd-surface-soft)",
            color: "var(--rd-text-muted)",
          }}
        >
          {feedback}
        </section>
      ) : null}
    </main>
  );
}
