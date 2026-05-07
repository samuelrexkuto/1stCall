"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getOnboardingLink } from "@/lib/onboarding/getOnboardingLink";

export function SendOnboardingLinkModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const onboardingLink = useMemo(() => getOnboardingLink(), []);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientMobile, setRecipientMobile] = useState("");
  const [channel, setChannel] = useState("email");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(onboardingLink);
      setSuccessMessage("Onboarding link copied.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to copy onboarding link.");
    }
  }

  async function handleSend() {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/onboarding/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name: recipientName.trim(),
          recipient_email: recipientEmail.trim(),
          recipient_mobile: recipientMobile.trim(),
          channel,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "Unable to send onboarding form link.");
      }

      setSuccessMessage("Onboarding form link sent successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send onboarding form link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Send onboarding form link" onClose={onClose}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          Recipient name
          <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          Recipient email
          <input
            type="email"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          Recipient mobile
          <input
            type="tel"
            value={recipientMobile}
            onChange={(event) => setRecipientMobile(event.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          Channel
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="email">email</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          Onboarding link
          <input value={onboardingLink} readOnly />
        </label>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={handleCopy}>
            Copy onboarding link
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting || !recipientEmail.trim()}
          >
            {submitting ? "Sending..." : "Send onboarding form link"}
          </button>
        </div>

        {errorMessage ? <p style={{ margin: 0, color: "#b91c1c" }}>{errorMessage}</p> : null}
        {successMessage ? <p style={{ margin: 0, color: "#166534" }}>{successMessage}</p> : null}
      </div>
    </Modal>
  );
}
