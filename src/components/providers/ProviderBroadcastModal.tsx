"use client";

import { BroadcastModal } from "@/components/messaging/BroadcastModal";
import type { ProviderOverviewRow } from "@/components/providers/ProviderOverviewTable";

export function ProviderBroadcastModal({
  open,
  providers,
  onClose,
}: {
  open: boolean;
  providers: ProviderOverviewRow[];
  onClose: () => void;
}) {
  return (
    <BroadcastModal
      open={open}
      title="Broadcast / Dispatch"
      audience="providers"
      recipients={providers.map((provider) => ({
        id: provider.provider_id,
        name: provider.name,
        phone: provider.phone,
        email: provider.email,
      }))}
      onboardingTemplateType="recruiter_onboarding"
      onboardingTitle="Provider Onboarding Template"
      onClose={onClose}
    />
  );
}
