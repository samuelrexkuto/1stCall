"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProviderBroadcastModal } from "@/components/providers/ProviderBroadcastModal";
import { Modal } from "@/components/ui/Modal";
import { getAccountEntitlements, normalizeAccountTier, type ProviderAccountTier } from "@/lib/provider-access";
import { getPaymentReliabilityLabel, type ProviderPaymentReliabilityStatus } from "@/lib/provider-trust";

type ProviderTab = "Account Summary" | "Access & Billing" | "Job Payments & Reliability" | "Jobs & Dispatch";

const providerTabs: ProviderTab[] = [
  "Account Summary",
  "Access & Billing",
  "Job Payments & Reliability",
  "Jobs & Dispatch",
];

export interface ProviderOverviewRow {
  id: string;
  sourceTable: "project_management_accounts" | "job_providers";
  provider_id: string;
  name: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  town: string | null;
  postcode: string | null;
  created_at: string;
  updated_at?: string | null;
  account_tier?: ProviderAccountTier;
  billing_status?: "trial" | "active" | "inactive" | "past_due" | "expired";
  usage_today?: number;
  payg_pack_type?: "payg_3" | "payg_5" | "payg_10" | null;
  payg_dispatch_allowance_total?: number;
  payg_dispatch_allowance_remaining?: number;
  monthly_renewal_date?: string | null;
  monthly_active?: boolean;
  access_tier?: string | null;
  access_status?: string | null;
  admin_full_access?: boolean;
  dispatch_access_source?: string | null;
  trial_access?: boolean;
  is_trial_month?: boolean;
  trial_granted_by_admin?: boolean;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  trial_status?: "none" | "active" | "expired" | "revoked";
  trial_access_level?: "preview" | "full_access" | null;
  trial_granted_by?: string | null;
  trial_granted_at?: string | null;
  trial_notes?: string | null;
  internal_billing_note?: string | null;
  success_fee_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_status?: string | null;
  payment_reliability_status?: ProviderPaymentReliabilityStatus;
  invoices_issued_count?: number;
  invoices_paid_on_time_count?: number;
  invoices_paid_late_count?: number;
  unpaid_invoices_count?: number;
  part_paid_invoices_count?: number;
  average_days_to_pay?: number | null;
  longest_payment_delay_days?: number;
  current_overdue_count?: number;
  payment_disputes_count?: number;
  contractor_payout_delay_incidents_count?: number;
  last_payment_received_date?: string | null;
  payment_reliability_note?: string | null;
  payment_reliability_last_reviewed_at?: string | null;
  latest_account_access_events?: Array<{
    event_type: string;
    actor_email: string | null;
    actor_role: string | null;
    notes: string | null;
    reason: string | null;
    created_at: string;
  }>;
  profile_image_url?: string | null;
  profile_image_path?: string | null;
}

export function ProviderOverviewTable({
  providers,
  onDeleteSuccess,
  onProviderUpdate,
}: {
  providers: ProviderOverviewRow[];
  onDeleteSuccess?: (providerId: string) => void;
  onProviderUpdate?: (provider: ProviderOverviewRow) => void;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [trialBusyId, setTrialBusyId] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderOverviewRow | null>(null);

  function toggleSelection(providerId: string) {
    setSelectedIds((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.length === providers.length ? [] : providers.map((provider) => provider.id),
    );
  }

  async function handleDelete(providerId: string, name: string) {
    const confirmed = window.confirm(`Delete provider "${name}"? This cannot be undone.`);
    if (!confirmed) return;

    const response = await fetch(`/api/providers/${providerId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      window.alert(payload.error ?? "Unable to delete provider.");
      return;
    }

    onDeleteSuccess?.(providerId);
    router.refresh();
  }

  async function handleTrialAction(provider: ProviderOverviewRow, action: "grant" | "extend" | "revoke") {
    const durationDays =
      action === "revoke"
        ? 0
        : Number(window.prompt(action === "extend" ? "Extend trial by how many days?" : "Grant full-access trial for how many days?", "30"));
    if (action !== "revoke" && (!Number.isFinite(durationDays) || durationDays <= 0)) return;

    const note = action === "revoke"
      ? window.prompt("Optional revocation note", "") ?? ""
      : window.prompt("Optional trial note", "") ?? "";

    setTrialBusyId(provider.id);
    const response = await fetch(`/api/admin/managed-accounts/${provider.id}/trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceTable: provider.sourceTable || "project_management_accounts",
        action,
        durationDays,
        accessLevel: "full_access",
        notes: note,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setTrialBusyId(null);

    if (!response.ok || !payload.success) {
      window.alert(payload.error ?? "Unable to update trial.");
      return;
    }

    if (payload.provider) {
      const updatedProvider = payload.provider as ProviderOverviewRow;
      onProviderUpdate?.(updatedProvider);
      if (provider.id === activeProvider?.id) {
        setActiveProvider(updatedProvider);
      }
    } else if (payload.trial && provider.id === activeProvider?.id) {
      setActiveProvider((current) => current ? applyTrialPayload(current, payload.trial) : current);
    }
    router.refresh();
  }

  const selectedProviders = providers.filter((provider) => selectedIds.includes(provider.id));

  return (
    <>
      <div className="rd-bulk-action-row">
        <strong>Selected subscriber accounts: {selectedIds.length}</strong>
        <button
          className="rd-button rd-button--primary"
          type="button"
          disabled={selectedIds.length === 0}
          aria-disabled={selectedIds.length === 0}
          onClick={() => setBroadcastModalOpen(true)}
        >
          Broadcast / Dispatch
        </button>
      </div>

      <div className="rd-table-shell">
        <table className="rd-admin-table" style={{ background: "var(--rd-bg-elevated)" }}>
          <thead>
            <tr>
              <TableHeader>
                <input
                  type="checkbox"
                  checked={providers.length > 0 && selectedIds.length === providers.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all providers"
                />
              </TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Grouping / Account Type</TableHeader>
              <TableHeader>Location</TableHeader>
              <TableHeader>Plan / Access</TableHeader>
              <TableHeader>Billing</TableHeader>
              <TableHeader>Dispatch / Jobs</TableHeader>
              <TableHeader>Actions</TableHeader>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(provider.id)}
                    onChange={() => toggleSelection(provider.id)}
                    aria-label={`Select ${provider.name}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setActiveProvider(provider)}
                    style={{
                      border: "none",
                      padding: 0,
                      background: "transparent",
                      color: "var(--rd-link)",
                      textDecoration: "underline",
                      font: "inherit",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {provider.name}
                  </button>
                  <CellSecondary>{provider.email ?? "Email not provided"}</CellSecondary>
                </TableCell>
                <TableCell>
                  <strong>{getAccountTypeLabel(provider)}</strong>
                  <CellSecondary>{provider.company_name || provider.name}</CellSecondary>
                </TableCell>
                <TableCell>
                  {provider.town ?? "Not recorded"}
                  <CellSecondary>{provider.postcode ?? "Postcode not provided"}</CellSecondary>
                </TableCell>
                <TableCell>
                  {getEffectiveAccessLabel(provider)}
                  <CellSecondary>{getAccessSecondaryLabel(provider)}</CellSecondary>
                </TableCell>
                <TableCell>
                  {provider.billing_status ?? "trial"}
                  <CellSecondary>{provider.monthly_active ? "Subscription active" : provider.payg_pack_type ? "PAYG account" : getTrialStatus(provider) === "active" ? "Trial billing state" : "No paid billing"}</CellSecondary>
                </TableCell>
                <TableCell>
                  Dispatch: {getDispatchAccessLabel(provider)}
                  <CellSecondary>Usage today: {provider.usage_today ?? 0}</CellSecondary>
                </TableCell>
                <TableCell>
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                    <Link href={`/providers/${provider.provider_id}/edit`}>Edit</Link>
                    <button
                      type="button"
                      disabled={trialBusyId === provider.id}
                      onClick={() => handleTrialAction(provider, isTrialActive(provider) ? "extend" : "grant")}
                    >
                      {isTrialActive(provider) ? "Extend trial" : "Grant trial"}
                    </button>
                    <button
                      type="button"
                      disabled={trialBusyId === provider.id || !isTrialActive(provider)}
                      onClick={() => handleTrialAction(provider, "revoke")}
                    >
                      Revoke
                    </button>
                    <button type="button" onClick={() => handleDelete(provider.provider_id, provider.name)}>
                      Delete
                    </button>
                  </div>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProviderDetailModal
        provider={activeProvider}
        onClose={() => setActiveProvider(null)}
        onBroadcast={(provider) => {
          setSelectedIds((current) => current.includes(provider.id) ? current : [...current, provider.id]);
          setBroadcastModalOpen(true);
        }}
        onTrialAction={handleTrialAction}
        trialBusyId={trialBusyId}
      />

      <ProviderBroadcastModal
        open={broadcastModalOpen}
        providers={selectedProviders}
        onClose={() => setBroadcastModalOpen(false)}
      />
    </>
  );
}

function ProviderDetailModal({
  provider,
  onClose,
  onBroadcast,
  onTrialAction,
  trialBusyId,
}: {
  provider: ProviderOverviewRow | null;
  onClose: () => void;
  onBroadcast: (provider: ProviderOverviewRow) => void;
  onTrialAction: (provider: ProviderOverviewRow, action: "grant" | "extend" | "revoke") => void;
  trialBusyId: string | null;
}) {
  const [activeTab, setActiveTab] = useState<ProviderTab>("Account Summary");

  if (!provider) return null;

  const topDetails: Array<[string, string]> = [
    ["Mobile", provider.phone ?? "Not provided"],
    ["WhatsApp", provider.phone ?? "Not provided"],
    ["Email", provider.email ?? "Not provided"],
    ["Company / Account Name", provider.company_name || provider.name],
    ["Account Type / Grouping", getAccountTypeLabel(provider)],
    ["Primary Contact", provider.name],
    ["Location", provider.town ?? "Not recorded"],
    ["Postcode", provider.postcode ?? "Not provided"],
    ["Tier / Plan", formatTier(provider.account_tier)],
    ["Access Status", getEffectiveAccessLabel(provider)],
    ["Dispatch Access", getDispatchAccessLabel(provider)],
    ["Trial Ends", isTrialActive(provider) ? provider.trial_end_date ?? "—" : "—"],
  ];

  return (
    <Modal open={Boolean(provider)} title={`${getAccountTypeLabel(provider)}: ${provider.name}`} onClose={onClose}>
      <div style={{ display: "grid", gap: "0.85rem" }}>
        <section
          style={{
            display: "grid",
            gap: "0.55rem 1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {topDetails.map(([label, value]) => (
            <DetailItem key={label} label={label} value={value} />
          ))}
        </section>

        <section style={{ display: "grid", gap: "0.7rem" }}>
          <div
            role="tablist"
            aria-label="Project management account sections"
            style={{
              display: "flex",
              gap: "0.45rem",
              overflowX: "auto",
              paddingBottom: "0.15rem",
              scrollbarWidth: "thin",
            }}
          >
            {providerTabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: "0 0 auto",
                    padding: "0.58rem 0.82rem",
                    borderRadius: 999,
                    border: isActive ? "1px solid var(--rd-primary)" : "1px solid var(--rd-border)",
                    background: isActive ? "var(--rd-primary)" : "var(--rd-surface-soft)",
                    color: isActive ? "var(--rd-primary-text)" : "var(--rd-text)",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            aria-label={activeTab}
            style={{
              display: "grid",
              gap: "0.85rem",
              padding: "0.95rem",
              borderRadius: 14,
              background: "var(--rd-surface-soft)",
              border: "1px solid var(--rd-border)",
            }}
          >
            {activeTab === "Account Summary" ? (
              <DetailGrid
                items={[
                  ["Company/account name", provider.company_name || provider.name],
                  ["Email", provider.email ?? "Not provided"],
                  ["Phone", provider.phone ?? "Not provided"],
                  ["Town/location", provider.town ?? "Not recorded"],
                  ["Postcode", provider.postcode ?? "Not provided"],
                  ["Account type/grouping", getAccountTypeLabel(provider)],
                  ["Created date", formatDate(provider.created_at)],
                  ["Last updated date", provider.updated_at ? formatDate(provider.updated_at) : "Not recorded"],
                ]}
              />
            ) : null}

            {activeTab === "Access & Billing" ? (
              <>
                <DetailGrid
                  items={[
                    ["Effective access", getEffectiveAccessLabel(provider)],
                    ["Account Tier", formatTier(normalizeAccountTier(provider.access_tier ?? provider.account_tier))],
                    ["Access Status", provider.access_status ?? "Not recorded"],
                    ["Tier / plan", formatTier(provider.account_tier)],
                    ["Billing Status", provider.billing_status ?? "trial"],
                    ["Active Subscription", provider.monthly_active ? "Yes" : "No"],
                    ["Monthly Active", provider.monthly_active ? "Yes" : "No"],
                    ["Subscription Status", provider.stripe_subscription_status ?? "Not recorded"],
                    ["Renewal Date", provider.monthly_renewal_date ?? "Not recorded"],
                    ["Stripe Customer Linked", provider.stripe_customer_id ? "Yes" : "No"],
                    ["Stripe Subscription Linked", provider.stripe_subscription_id ? "Yes" : "No"],
                    ["Current PAYG Pack", provider.payg_pack_type ?? "Not recorded"],
                    ["Dispatch allowance remaining", getDispatchAccessLabel(provider)],
                    ["Dispatch Access", provider.dispatch_access_source === "trial" || isTrialActive(provider) ? "Unlimited" : getDispatchAccessLabel(provider)],
                    ["Trial Access", isTrialActive(provider) ? "Yes" : "No"],
                    ["Trial Status", getTrialStatus(provider)],
                    ["Trial Access Level", provider.trial_access_level === "full_access" ? "Full access" : provider.trial_access_level ?? "Not recorded"],
                    ["Trial Start Date", provider.trial_start_date ?? "Not recorded"],
                    ["Trial End Date", provider.trial_end_date ?? "Not recorded"],
                    ["Trial Granted By", provider.trial_granted_by ?? "Not recorded"],
                    ["Trial Granted At", provider.trial_granted_at ? formatDate(provider.trial_granted_at) : "Not recorded"],
                    ["Trial Notes", provider.trial_notes ?? provider.internal_billing_note ?? "Not recorded"],
                  ]}
                />
                {provider.latest_account_access_events?.length ? (
                  <section style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.98rem" }}>Latest access changes</h3>
                    {provider.latest_account_access_events.slice(0, 5).map((event) => (
                      <div key={`${event.event_type}-${event.created_at}`} style={{ color: "var(--rd-text-muted)" }}>
                        <strong style={{ color: "var(--rd-text)" }}>{event.event_type}</strong>
                        {" | "}
                        {event.actor_email ?? event.actor_role ?? "Unknown actor"}
                        {" | "}
                        {formatDate(event.created_at)}
                        {event.notes || event.reason ? ` | ${event.notes ?? event.reason}` : ""}
                      </div>
                    ))}
                  </section>
                ) : null}
              </>
            ) : null}

            {activeTab === "Job Payments & Reliability" ? (
              <section style={{ display: "grid", gap: "0.75rem" }}>
                <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
                  Payment reliability is calculated from job invoice and payment history, not subscription billing.
                </p>
                <DetailGrid
                  items={[
                    ["Payment Reliability", calculatePaymentReliability(provider)],
                    ["Invoices Issued", String(provider.invoices_issued_count ?? 0)],
                    ["Paid On Time", String(provider.invoices_paid_on_time_count ?? 0)],
                    ["Paid Late", String(provider.invoices_paid_late_count ?? 0)],
                    ["Unpaid", String(provider.unpaid_invoices_count ?? 0)],
                    ["Part Paid", String(provider.part_paid_invoices_count ?? 0)],
                    ["Avg Days to Pay", provider.average_days_to_pay == null ? "Not recorded" : String(provider.average_days_to_pay)],
                    ["Last Payment Received", provider.last_payment_received_date ?? "Not recorded"],
                    ["Current Overdue Count", String(provider.current_overdue_count ?? 0)],
                    ["Payment Disputes", String(provider.payment_disputes_count ?? 0)],
                    ["Payout Delay Incidents", String(provider.contractor_payout_delay_incidents_count ?? 0)],
                    ["Payment review note", provider.payment_reliability_note ?? "Not recorded"],
                  ]}
                />
              </section>
            ) : null}

            {activeTab === "Jobs & Dispatch" ? (
              <DetailGrid
                items={[
                  ["Usage Today", String(provider.usage_today ?? 0)],
                  ["Dispatches remaining", getDispatchAccessLabel(provider)],
                  ["Jobs created", "Not recorded"],
                  ["Active jobs", "Not recorded"],
                  ["Dispatch requests", "Not recorded"],
                  ["Dispatches sent", "Not recorded"],
                  ["Filled jobs", "Not recorded"],
                  ["Completed jobs", "Not recorded"],
                  ["Latest dispatch status", "Not recorded"],
                  ["Latest job status", "Not recorded"],
                  ["Contact details release status", "Released after worker confirmation"],
                  ["Jobs dispatched", "Not recorded"],
                  ["Success fee status", provider.success_fee_status ?? "Not recorded"],
                ]}
              />
            ) : null}
          </div>
        </section>

        <section style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => onBroadcast(provider)}>
            Broadcast / Dispatch
          </button>
          <Link href={`/providers/${provider.provider_id}/edit`}>Edit Account</Link>
          <button
            type="button"
            disabled={trialBusyId === provider.id}
            onClick={() => onTrialAction(provider, isTrialActive(provider) ? "extend" : "grant")}
          >
            {isTrialActive(provider) ? "Extend Trial" : "Grant Trial"}
          </button>
          {isTrialActive(provider) ? (
            <button
              type="button"
              disabled={trialBusyId === provider.id}
              onClick={() => onTrialAction(provider, "revoke")}
            >
              Revoke Trial
            </button>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{children}</th>;
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)", verticalAlign: "top" }}>{children}</td>;
}

function CellSecondary({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: "0.22rem", color: "var(--rd-text-muted)", fontSize: "0.9rem", lineHeight: 1.25 }}>{children}</div>;
}

function DetailGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <section style={{ display: "grid", gap: "0.65rem 1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {items.map(([label, value]) => (
        <DetailItem key={label} label={label} value={value} />
      ))}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: "0.1rem" }}>
      <div style={{ fontSize: "0.82rem", color: "var(--rd-text-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ color: "var(--rd-text)", fontWeight: 700, lineHeight: 1.25 }}>{value}</div>
    </div>
  );
}

function isTrialActive(provider: ProviderOverviewRow) {
  const trialAccess = provider.trial_access ?? provider.trial_granted_by_admin ?? provider.is_trial_month ?? false;
  if (!trialAccess) return false;
  if (provider.trial_status !== "active" || !provider.trial_start_date || !provider.trial_end_date) return false;
  if (provider.trial_access_level && provider.trial_access_level !== "full_access") return false;
  const start = parseTrialBoundary(provider.trial_start_date, false);
  const end = parseTrialBoundary(provider.trial_end_date, true);
  const now = Date.now();
  return Boolean(start && end && start.getTime() <= now && end.getTime() > now);
}

function parseTrialBoundary(value: string, endOfDay: boolean) {
  const hasTime = value.includes("T");
  const parsed = new Date(hasTime ? value : `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (hasTime && endOfDay) parsed.setUTCHours(23, 59, 59, 999);
  if (hasTime && !endOfDay) parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

function getTrialStatus(provider: ProviderOverviewRow) {
  if (isTrialActive(provider)) return "active";
  if (provider.trial_status === "active" && provider.trial_end_date) return "expired";
  return provider.trial_status ?? "none";
}

function getEffectiveAccessLabel(provider: ProviderOverviewRow) {
  return getProviderEntitlements(provider).accountBadgeLabel;
}

function getAccessSecondaryLabel(provider: ProviderOverviewRow) {
  if (isTrialActive(provider)) return `Trial ends: ${provider.trial_end_date ?? "—"}`;
  if (provider.monthly_active) return `Renewal: ${provider.monthly_renewal_date ?? "—"}`;
  return "—";
}

function getDispatchAccessLabel(provider: ProviderOverviewRow) {
  return getProviderEntitlements(provider).hasUnlimitedDispatches
    ? "Unlimited"
    : String(getProviderEntitlements(provider).dispatchRemaining);
}

function getProviderEntitlements(provider: ProviderOverviewRow) {
  return getAccountEntitlements({
    accessTier: provider.access_tier,
    accountTier: normalizeAccountTier(provider.access_tier ?? provider.account_tier),
    accessStatus: provider.access_status,
    billingStatus: provider.billing_status ?? "trial",
    paygDispatchAllowanceRemaining: provider.payg_dispatch_allowance_remaining ?? 0,
    monthlyActive: provider.monthly_active ?? false,
    activeSubscription: provider.monthly_active ?? false,
    trialAccess: provider.trial_access ?? false,
    trialStatus: provider.trial_status ?? "none",
    trialAccessLevel: provider.trial_access_level ?? null,
    trialStartDate: provider.trial_start_date ?? null,
    trialEndDate: provider.trial_end_date ?? null,
    adminFullAccess: provider.admin_full_access ?? false,
  });
}

function calculatePaymentReliability(provider: ProviderOverviewRow) {
  const issued = provider.invoices_issued_count ?? 0;
  const unpaid = provider.unpaid_invoices_count ?? 0;
  const late = provider.invoices_paid_late_count ?? 0;
  const paidOnTime = provider.invoices_paid_on_time_count ?? 0;
  if (issued < 3) return "Limited Data";
  if (unpaid >= 2 || (provider.current_overdue_count ?? 0) >= 2) return "Poor";
  if (late > paidOnTime) return "Needs Review";
  if (paidOnTime >= late) return "Reliable";
  return getPaymentReliabilityLabel(provider.payment_reliability_status);
}

function applyTrialPayload(provider: ProviderOverviewRow, payload: Record<string, unknown>): ProviderOverviewRow {
  return {
    ...provider,
    billing_status: typeof payload.billing_status === "string" ? payload.billing_status as ProviderOverviewRow["billing_status"] : provider.billing_status,
    trial_access: typeof payload.trial_access === "boolean" ? payload.trial_access : provider.trial_access,
    is_trial_month: typeof payload.is_trial_month === "boolean" ? payload.is_trial_month : provider.is_trial_month,
    trial_granted_by_admin:
      typeof payload.trial_granted_by_admin === "boolean" ? payload.trial_granted_by_admin : provider.trial_granted_by_admin,
    trial_status:
      payload.trial_status === "active" || payload.trial_status === "expired" || payload.trial_status === "revoked" || payload.trial_status === "none"
        ? payload.trial_status
        : provider.trial_status,
    trial_access_level:
      payload.trial_access_level === "preview" || payload.trial_access_level === "full_access"
        ? payload.trial_access_level
        : provider.trial_access_level,
    trial_start_date: typeof payload.trial_start_date === "string" ? payload.trial_start_date : provider.trial_start_date,
    trial_end_date: typeof payload.trial_end_date === "string" ? payload.trial_end_date : provider.trial_end_date,
    trial_granted_by: typeof payload.trial_granted_by === "string" ? payload.trial_granted_by : provider.trial_granted_by,
    trial_granted_at: typeof payload.trial_granted_at === "string" ? payload.trial_granted_at : provider.trial_granted_at,
    trial_notes: typeof payload.trial_notes === "string" ? payload.trial_notes : provider.trial_notes,
    account_tier: typeof payload.account_tier === "string" ? normalizeAccountTier(payload.account_tier) : provider.account_tier,
    access_tier: typeof payload.access_tier === "string" ? payload.access_tier : provider.access_tier,
    access_status: typeof payload.access_status === "string" ? payload.access_status : provider.access_status,
    dispatch_access_source:
      typeof payload.dispatch_access_source === "string" ? payload.dispatch_access_source : provider.dispatch_access_source,
  };
}

function getAccountTypeLabel(provider: ProviderOverviewRow) {
  if (provider.company_name?.toLowerCase().includes("consult")) return "Consultant";
  if (provider.name.toLowerCase().includes("client")) return "Client";
  if (provider.name.toLowerCase().includes("contractor")) return "Contractor";
  return "Subscriber";
}

function formatTier(value: ProviderOverviewRow["account_tier"]) {
  const tier = normalizeAccountTier(value);
  if (tier === "payg") return "PAYG";
  if (tier === "monthly_full_access") return "Monthly — Full Access";
  if (tier === "trial_full_access") return "30-Day Trial — Full Access";
  if (tier === "manual_full_access") return "Manual Full Access";
  return "Free Preview";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
