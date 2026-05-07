import { query } from "@/lib/db";

export type DispatchLogChannel = "whatsapp" | "sms" | "call";
export type DispatchLogStatus = "pending" | "sent" | "failed";

export interface DispatchLogEntry {
  dispatchId: string;
  jobId: string;
  workerId: string;
  channel: DispatchLogChannel;
  phone: string | null;
  status: DispatchLogStatus;
  provider: string;
  errorMessage?: string | null;
  sentAt?: string | null;
}

export async function insertDispatchLogs(entries: DispatchLogEntry[]) {
  if (entries.length === 0) {
    return;
  }

  await query(
    `
      insert into dispatch_logs (
        dispatch_id,
        job_id,
        worker_id,
        channel,
        phone,
        status,
        provider,
        error_message,
        sent_at
      )
      select
        unnest($1::uuid[]),
        unnest($2::uuid[]),
        unnest($3::uuid[]),
        unnest($4::text[]),
        unnest($5::text[]),
        unnest($6::text[]),
        unnest($7::text[]),
        unnest($8::text[]),
        unnest($9::timestamptz[])
    `,
    [
      entries.map((entry) => entry.dispatchId),
      entries.map((entry) => entry.jobId),
      entries.map((entry) => entry.workerId),
      entries.map((entry) => entry.channel),
      entries.map((entry) => entry.phone),
      entries.map((entry) => entry.status),
      entries.map((entry) => entry.provider),
      entries.map((entry) => entry.errorMessage ?? null),
      entries.map((entry) => entry.sentAt ?? null),
    ],
  );
}

export async function updateDispatchLogs(
  dispatchId: string,
  channel: DispatchLogChannel,
  entries: Array<Pick<DispatchLogEntry, "workerId" | "status" | "errorMessage">>,
) {
  if (entries.length === 0) {
    return;
  }

  await query(
    `
      update dispatch_logs as dl
      set
        status = updates.status::text,
        error_message = updates.error_message,
        sent_at = case
          when updates.status = 'sent' then timezone('utc', now())
          else null
        end
      from (
        select
          unnest($1::uuid[]) as worker_id,
          unnest($2::text[]) as status,
          unnest($3::text[]) as error_message
      ) as updates
      where dl.dispatch_id = $4::uuid
        and dl.channel = $5::text
        and dl.worker_id = updates.worker_id
    `,
    [
      entries.map((entry) => entry.workerId),
      entries.map((entry) => entry.status),
      entries.map((entry) => entry.errorMessage ?? null),
      dispatchId,
      channel,
    ],
  );
}

export async function upsertResponseLogDelivery(params: {
  jobId: string;
  channel: "whatsapp" | "sms" | "ivr";
  deliveredWorkerIds: string[];
  failedWorkerIds: string[];
}) {
  const { jobId, channel, deliveredWorkerIds, failedWorkerIds } = params;

  if (deliveredWorkerIds.length > 0) {
    await query(
      `
        insert into response_log (
          job_id,
          worker_id,
          sent_time,
          channel,
          delivered,
          read,
          response_type,
          response_time,
          selected,
          reserve
        )
        select
          $1::uuid,
          unnest($2::uuid[]),
          timezone('utc', now()),
          $3::text,
          true,
          false,
          'no_response',
          null,
          false,
          false
        on conflict (job_id, worker_id)
        do update set
          sent_time = excluded.sent_time,
          channel = excluded.channel,
          delivered = true,
          read = false,
          response_type = 'no_response',
          response_time = null,
          selected = false,
          reserve = false
      `,
      [jobId, deliveredWorkerIds, channel],
    );
  }

  if (failedWorkerIds.length > 0) {
    await query(
      `
        insert into response_log (
          job_id,
          worker_id,
          sent_time,
          channel,
          delivered,
          read,
          response_type,
          response_time,
          selected,
          reserve
        )
        select
          $1::uuid,
          unnest($2::uuid[]),
          timezone('utc', now()),
          $3::text,
          false,
          false,
          'no_response',
          null,
          false,
          false
        on conflict (job_id, worker_id)
        do update set
          sent_time = excluded.sent_time,
          channel = excluded.channel,
          delivered = false,
          read = false,
          response_type = 'no_response',
          response_time = null,
          selected = false,
          reserve = false
      `,
      [jobId, failedWorkerIds, channel],
    );
  }
}
