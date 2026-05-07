"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createJobProviderSchema, type CreateJobProviderInput } from "@/lib/validation/schemas";
import { formatZodErrors } from "@/lib/forms";

const initialState: CreateJobProviderInput = {
  name: "",
  email: "",
  phone: "",
  town: "",
  postcode: "",
  account_tier: "free_preview",
  billing_status: "trial",
  payg_pack_type: null,
  payg_dispatch_allowance_total: 0,
  payg_dispatch_allowance_remaining: 0,
  usage_today: 0,
  monthly_renewal_date: null,
  monthly_active: false,
  is_trial_month: false,
  trial_granted_by_admin: false,
  trial_start_date: null,
  trial_end_date: null,
  trial_status: "none",
  internal_billing_note: "",
  success_fee_status: "",
  payment_reliability_status: "limited_data",
  invoices_issued_count: 0,
  invoices_paid_on_time_count: 0,
  invoices_paid_late_count: 0,
  unpaid_invoices_count: 0,
  part_paid_invoices_count: 0,
  average_days_to_pay: null,
  longest_payment_delay_days: 0,
  current_overdue_count: 0,
  payment_disputes_count: 0,
  contractor_payout_delay_incidents_count: 0,
  last_payment_received_date: null,
  payment_reliability_note: "",
  payment_reliability_last_reviewed_at: null,
};

interface JobProviderFormProps {
  initialData?: Partial<CreateJobProviderInput>;
  submitUrl?: string;
  method?: "POST" | "PATCH";
  successRedirect?: string;
}

function buildInitialState(initialData?: Partial<CreateJobProviderInput>): CreateJobProviderInput {
  return {
    ...initialState,
    ...initialData,
  };
}

export function JobProviderForm({
  initialData,
  submitUrl = "/api/providers",
  method = "POST",
  successRedirect,
}: JobProviderFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<CreateJobProviderInput>(() => buildInitialState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function toDateInputValue(value: string | null | undefined) {
    return typeof value === "string" ? value : "";
  }

  function toIsoDateString(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  function addOneMonth(dateString: string) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setMonth(date.getMonth() + 1);
    return toIsoDateString(date);
  }

  function applyTrialPreset() {
    const today = toIsoDateString(new Date());
    setForm((current) => ({
      ...current,
      account_tier: "trial_full_access",
      billing_status: "active",
      monthly_active: true,
      is_trial_month: true,
      trial_granted_by_admin: true,
      trial_start_date: current.trial_start_date || today,
      trial_end_date: current.trial_end_date || addOneMonth(current.trial_start_date || today),
      trial_status: "active",
      monthly_renewal_date: current.monthly_renewal_date || current.trial_end_date || addOneMonth(current.trial_start_date || today),
      internal_billing_note: current.internal_billing_note || "Admin-granted monthly trial access",
    }));
  }

  function revokeTrialPreset() {
    setForm((current) => ({
      ...current,
      account_tier: "free_preview",
      billing_status: "inactive",
      monthly_active: false,
      is_trial_month: false,
      trial_granted_by_admin: false,
      trial_status: "none",
      internal_billing_note: current.internal_billing_note || "Trial access revoked by admin",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createJobProviderSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(formatZodErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(submitUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const payload = await response.json();
        setErrors({ form: payload.error ?? "Unable to create provider" });
        return;
      }

      if (successRedirect) {
        router.push(successRedirect);
        router.refresh();
        return;
      }

      setForm(initialState);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      {method === "PATCH" ? (
        <div className="md:col-span-2" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={applyTrialPreset}>
            Grant 1-Month Trial
          </button>
          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                account_tier: "monthly_full_access",
                billing_status: "active",
                monthly_active: true,
                is_trial_month: false,
                trial_granted_by_admin: false,
                trial_status: "none",
              }))
            }
          >
            Convert to Paid Monthly
          </button>
          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                billing_status: "expired",
                monthly_active: false,
                is_trial_month: true,
                trial_status: "expired",
                internal_billing_note: current.internal_billing_note || "Trial marked expired by admin",
              }))
            }
          >
            Mark Trial Expired
          </button>
          <button
            type="button"
            onClick={() =>
              setForm((current) => {
                const baseDate = current.trial_end_date || current.trial_start_date || toIsoDateString(new Date());
                const extendedDate = addOneMonth(baseDate);
                return {
                  ...current,
                  account_tier: "trial_full_access",
                  billing_status: "active",
                  monthly_active: true,
                  is_trial_month: true,
                  trial_granted_by_admin: true,
                  trial_status: "active",
                  trial_start_date: current.trial_start_date || toIsoDateString(new Date()),
                  trial_end_date: extendedDate,
                  monthly_renewal_date: extendedDate,
                  internal_billing_note: current.internal_billing_note || "Admin-granted monthly trial access",
                };
              })
            }
          >
            Extend Trial by 1 Month
          </button>
          <button type="button" onClick={revokeTrialPreset}>
            Revoke Trial
          </button>
          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                account_tier: "payg",
                billing_status: "active",
                monthly_active: false,
                is_trial_month: false,
                trial_granted_by_admin: false,
                trial_status: "none",
              }))
            }
          >
            Convert to PAYG
          </button>
          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                account_tier: "free_preview",
                billing_status: "trial",
                monthly_active: false,
                is_trial_month: false,
                trial_granted_by_admin: false,
                trial_status: "none",
              }))
            }
          >
            Reset to Free
          </button>
        </div>
      ) : null}

      <label>
        Provider Name
        <input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        {errors.name && <span>{errors.name}</span>}
      </label>

      <label>
        Email
        <input
          type="email"
          value={form.email ?? ""}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        {errors.email && <span>{errors.email}</span>}
      </label>

      <label>
        Phone
        <input
          value={form.phone ?? ""}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
      </label>

      <label>
        Town
        <input
          value={form.town ?? ""}
          onChange={(event) => setForm({ ...form, town: event.target.value })}
        />
      </label>

      <label>
        Postcode
        <input
          value={form.postcode ?? ""}
          onChange={(event) => setForm({ ...form, postcode: event.target.value })}
        />
        {errors.postcode && <span>{errors.postcode}</span>}
      </label>

      <label>
        Account Tier
        <select
          value={form.account_tier}
          onChange={(event) =>
            setForm({
              ...form,
              account_tier: event.target.value as CreateJobProviderInput["account_tier"],
            })
          }
        >
          <option value="free_preview">Free Preview</option>
          <option value="payg">PAYG</option>
          <option value="monthly_full_access">Monthly — Full Access</option>
          <option value="trial_full_access">30-Day Trial — Full Access</option>
          <option value="manual_full_access">Manual Full Access</option>
        </select>
      </label>

      <label>
        Billing Status
        <select
          value={form.billing_status}
          onChange={(event) =>
            setForm({
              ...form,
              billing_status: event.target.value as CreateJobProviderInput["billing_status"],
            })
          }
        >
          <option value="trial">trial</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="past_due">past_due</option>
          <option value="expired">expired</option>
        </select>
      </label>

      <label>
        PAYG Pack
        <select
          value={form.payg_pack_type ?? ""}
          onChange={(event) =>
            setForm({
              ...form,
              payg_pack_type: event.target.value
                ? (event.target.value as NonNullable<CreateJobProviderInput["payg_pack_type"]>)
                : null,
            })
          }
        >
          <option value="">None</option>
          <option value="payg_3">£39 / 3 dispatch requests</option>
          <option value="payg_5">£59 / 5 dispatch requests</option>
          <option value="payg_10">£99 / 10 dispatch requests</option>
        </select>
      </label>

      <label>
        PAYG Allowance Total
        <input
          type="number"
          min={0}
          value={form.payg_dispatch_allowance_total}
          onChange={(event) => setForm({ ...form, payg_dispatch_allowance_total: Number(event.target.value) })}
        />
      </label>

      <label>
        PAYG Allowance Remaining
        <input
          type="number"
          min={0}
          value={form.payg_dispatch_allowance_remaining}
          onChange={(event) => setForm({ ...form, payg_dispatch_allowance_remaining: Number(event.target.value) })}
        />
      </label>

      <label>
        Usage Today
        <input
          type="number"
          min={0}
          value={form.usage_today}
          onChange={(event) => setForm({ ...form, usage_today: Number(event.target.value) })}
        />
      </label>

      <label>
        Monthly Renewal Date
        <input
          type="date"
          value={toDateInputValue(form.monthly_renewal_date)}
          onChange={(event) => setForm({ ...form, monthly_renewal_date: event.target.value || null })}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="checkbox"
          checked={Boolean(form.monthly_active)}
          onChange={(event) => setForm({ ...form, monthly_active: event.target.checked })}
        />
        Monthly Active
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="checkbox"
          checked={Boolean(form.is_trial_month)}
          onChange={(event) =>
            setForm((current) => {
              const checked = event.target.checked;
              const today = toIsoDateString(new Date());
              return {
                ...current,
                is_trial_month: checked,
                trial_granted_by_admin: checked ? true : current.trial_granted_by_admin,
                trial_start_date: checked ? current.trial_start_date || today : current.trial_start_date,
                trial_end_date: checked ? current.trial_end_date || addOneMonth(current.trial_start_date || today) : current.trial_end_date,
                trial_status: checked ? "active" : current.trial_status === "active" ? "none" : current.trial_status,
                internal_billing_note:
                  checked && !current.internal_billing_note
                    ? "Admin-granted monthly trial access"
                    : current.internal_billing_note,
              };
            })
          }
        />
        Trial Month Granted
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="checkbox"
          checked={Boolean(form.trial_granted_by_admin)}
          onChange={(event) => setForm({ ...form, trial_granted_by_admin: event.target.checked })}
        />
        Trial Granted By Admin
      </label>

      <label>
        Trial Start Date
        <input
          type="date"
          value={toDateInputValue(form.trial_start_date)}
          onChange={(event) => setForm({ ...form, trial_start_date: event.target.value || null })}
        />
      </label>

      <label>
        Trial End Date
        <input
          type="date"
          value={toDateInputValue(form.trial_end_date)}
          onChange={(event) => {
            const nextValue = event.target.value || null;
            setForm((current) => ({
              ...current,
              trial_end_date: nextValue,
              monthly_renewal_date: current.monthly_renewal_date || nextValue,
            }));
          }}
        />
      </label>

      <label>
        Trial Status
        <select
          value={form.trial_status}
          onChange={(event) =>
            setForm({
              ...form,
              trial_status: event.target.value as CreateJobProviderInput["trial_status"],
            })
          }
        >
          <option value="none">none</option>
          <option value="active">active</option>
          <option value="expired">expired</option>
          <option value="revoked">revoked</option>
        </select>
      </label>

      <label className="md:col-span-2">
        Internal Billing Note
        <textarea
          value={form.internal_billing_note ?? ""}
          onChange={(event) => setForm({ ...form, internal_billing_note: event.target.value })}
          rows={3}
        />
      </label>

      <fieldset
        className="md:col-span-2"
        style={{
          border: "1px solid var(--rd-border)",
          borderRadius: 16,
          padding: "1rem",
          display: "grid",
          gap: "1rem",
        }}
      >
        <legend style={{ padding: "0 0.4rem", fontWeight: 800 }}>Payment Reliability</legend>
        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
          Internal metric based only on verified platform payment behaviour.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <label>
            Payment Reliability Status
            <select
              value={form.payment_reliability_status}
              onChange={(event) =>
                setForm({
                  ...form,
                  payment_reliability_status: event.target.value as CreateJobProviderInput["payment_reliability_status"],
                  payment_reliability_last_reviewed_at: new Date().toISOString(),
                })
              }
            >
              <option value="limited_data">Limited Data</option>
              <option value="strong">Strong</option>
              <option value="moderate">Moderate</option>
              <option value="at_risk">At Risk</option>
              <option value="under_review">Under Review</option>
            </select>
          </label>
          {[
            ["Invoices Issued", "invoices_issued_count"],
            ["Paid On Time", "invoices_paid_on_time_count"],
            ["Paid Late", "invoices_paid_late_count"],
            ["Unpaid", "unpaid_invoices_count"],
            ["Part Paid", "part_paid_invoices_count"],
            ["Avg Days to Pay", "average_days_to_pay"],
            ["Longest Delay", "longest_payment_delay_days"],
            ["Current Overdue Count", "current_overdue_count"],
            ["Payment Disputes", "payment_disputes_count"],
            ["Payout Delay Incidents", "contractor_payout_delay_incidents_count"],
          ].map(([label, key]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={0}
                value={(form[key as keyof CreateJobProviderInput] as number | null) ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [key]: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />
            </label>
          ))}
          <label>
            Last Payment Received
            <input
              type="date"
              value={toDateInputValue(form.last_payment_received_date)}
              onChange={(event) => setForm({ ...form, last_payment_received_date: event.target.value || null })}
            />
          </label>
          <label>
            Last Reviewed At
            <input
              value={form.payment_reliability_last_reviewed_at ?? ""}
              onChange={(event) => setForm({ ...form, payment_reliability_last_reviewed_at: event.target.value || null })}
              placeholder="Auto-set when status changes"
            />
          </label>
        </div>
        <label>
          Internal Payment Reliability Note
          <textarea
            value={form.payment_reliability_note ?? ""}
            onChange={(event) => setForm({ ...form, payment_reliability_note: event.target.value })}
            rows={3}
          />
        </label>
      </fieldset>

      {errors.form && <p className="md:col-span-2">{errors.form}</p>}

      <button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : method === "PATCH" ? "Update Provider" : "Create Job Provider"}
      </button>
    </form>
  );
}
