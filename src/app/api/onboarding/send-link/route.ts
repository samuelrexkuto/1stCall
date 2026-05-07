import { NextResponse } from "next/server";
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

    return NextResponse.json({
      success: false,
      channel,
      onboarding_link: onboardingLink,
      subject: email.subject,
      error: "Email sending is disabled because the Resend integration has been removed.",
    }, { status: 501 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send onboarding link." },
      { status: 500 },
    );
  }
}
