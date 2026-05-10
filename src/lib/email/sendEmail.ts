import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const RESEND_NOT_CONFIGURED_REASON = "Resend email service is not configured";

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  if (!resend || !resendFromEmail) {
    console.warn("[email] Resend is disabled because RESEND_API_KEY or RESEND_FROM_EMAIL is missing.");
    return {
      skipped: true,
      reason: RESEND_NOT_CONFIGURED_REASON,
      data: null,
      error: null,
    };
  }

  return resend.emails.send({
    from: resendFromEmail,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  });
}
