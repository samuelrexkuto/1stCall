import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sendEmail";
import { buildOnboardingInviteEmail } from "@/lib/onboarding/buildOnboardingInviteEmail";
import { getOnboardingLink } from "@/lib/onboarding/getOnboardingLink";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      recipient_name?: string;
      recipient_email?: string;
      recipient_mobile?: string;
      channel?: string;
    };

    const channel = String(body.channel ?? "email").trim() || "email";

    if (channel !== "email") {
      return NextResponse.json(
        { success: false, error: "Only email onboarding invites are supported currently." },
        { status: 400 },
      );
    }

    const recipientEmail = String(body.recipient_email ?? "").trim();

    if (!recipientEmail) {
      return NextResponse.json(
        { success: false, error: "Recipient email is required." },
        { status: 400 },
      );
    }

    const onboardingLink = getOnboardingLink();
    const email = buildOnboardingInviteEmail({
      recipientName: body.recipient_name ?? null,
      onboardingLink,
    });

    const result = await sendEmail({
      to: recipientEmail,
      subject: email.subject,
      html: email.html,
      text: email.body,
    });

    return NextResponse.json({
      success: true,
      channel,
      onboarding_link: onboardingLink,
      provider: "resend",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send onboarding link." },
      { status: 500 },
    );
  }
}
