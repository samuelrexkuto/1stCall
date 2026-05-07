type OnboardingInviteInput = {
  recipientName?: string | null;
  onboardingLink: string;
};

export function buildOnboardingInviteEmail(input: OnboardingInviteInput) {
  const subject = "Complete your worker onboarding form";
  const body = `Hi ${input.recipientName || "there"},

Thank you for your interest in joining our recruitment dispatch pool.

Please complete your onboarding form using the link below:

${input.onboardingLink}

All required details and documents must be submitted before your contract can be issued.

Kind regards,

Recruited Dispatch`;

  const html = `<p>Hi ${input.recipientName || "there"},</p>
<p>Thank you for your interest in joining our recruitment dispatch pool.</p>
<p>Please complete your onboarding form using the link below:</p>
<p><a href="${input.onboardingLink}">${input.onboardingLink}</a></p>
<p>All required details and documents must be submitted before your contract can be issued.</p>
<p>Kind regards,<br />Recruited Dispatch</p>`;

  return { subject, body, html };
}
