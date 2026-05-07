"use client";

import { BroadcastModal, type BroadcastJobOption } from "@/components/messaging/BroadcastModal";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export type DispatchJobOption = BroadcastJobOption;

export function WorkerBroadcastModal({
  open,
  workers,
  jobs,
  jobsUnavailable,
  preferredRole,
  onClose,
}: {
  open: boolean;
  workers: WorkerOverviewRow[];
  jobs: DispatchJobOption[];
  jobsUnavailable?: boolean;
  preferredRole?: string;
  onClose: () => void;
}) {
  return (
    <BroadcastModal
      open={open}
      title="Broadcast / Dispatch"
      audience="workers"
      recipients={workers.map((worker) => ({
        id: worker.worker_id,
        name: worker.full_name,
        phone: worker.phone,
        whatsappNumber: worker.whatsapp_number,
        email: worker.email,
      }))}
      jobs={jobs}
      jobsUnavailable={jobsUnavailable}
      preferredRole={preferredRole}
      onboardingTemplateType="worker_onboarding"
      onboardingTitle="Worker Onboarding Template"
      onClose={onClose}
    />
  );
}
