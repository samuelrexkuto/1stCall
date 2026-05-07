import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { JobDispatchConsole } from "@/components/jobs/JobDispatchConsole";

interface JobSummaryRow {
  job_id: string;
  job_title: string;
  company_name: string;
  area: string | null;
  postcode: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  trade_type: string | null;
  workers_required: number;
  workers_confirmed: number;
  broadcast_status: string;
  payment_status: string;
  skill_tags: string[];
}

interface MatchedWorkerRow {
  worker_id: string;
  full_name: string;
  mobile: string;
  primary_role: string | null;
  town: string | null;
  postcode: string;
  available_today: boolean;
  priority_tier: string;
  whatsapp_opt_in: boolean;
  right_to_work: boolean;
  contract_signed: boolean;
  matched_skill_count: number;
}

interface ResponseResultRow {
  worker_id: string;
  full_name: string;
  mobile: string;
  channel: string;
  response_type: string | null;
  response_time: string | null;
  booking_status: string | null;
}

function getFillStatus(workersRequired: number, workersConfirmed: number) {
  if (workersConfirmed >= workersRequired) return "Filled";
  if (workersConfirmed > 0) return "Part-filled";
  return "Open";
}

export default async function JobBroadcastPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  const { rows: jobRows } = await query<JobSummaryRow>(
    `
      select
        j.job_id,
        j.job_title,
        p.company_name,
        j.area,
        j.postcode,
        j.start_date::text,
        j.start_time::text,
        j.end_time::text,
        j.trade_type,
        j.workers_required,
        j.workers_confirmed,
        j.broadcast_status,
        j.payment_status,
        j.skill_tags
      from jobs j
      join job_providers p on p.provider_id = j.provider_id
      where j.job_id = $1
      limit 1
    `,
    [jobId],
  );

  const job = jobRows[0];

  if (!job) {
    notFound();
  }

  const { rows: matchedWorkers } = await query<MatchedWorkerRow>(
    `
      select
        s.worker_id,
        s.full_name,
        s.mobile,
        s.primary_role,
        s.town,
        s.postcode,
        s.available_today,
        s.priority_tier,
        s.whatsapp_opt_in,
        s.right_to_work,
        s.contract_signed,
        (
          select count(*)
          from unnest($1::text[]) as required_skill
          where required_skill = any (s.skill_tags)
        ) as matched_skill_count
      from staff_subs s
      where s.status = 'active'
        and s.available_today = true
        and s.right_to_work = true
        and s.contract_signed = true
        and coalesce(s.primary_role, '') = coalesce($2::text, '')
      order by matched_skill_count desc, s.reliability_score desc, s.full_name asc
    `,
    [job.skill_tags, job.trade_type],
  );

  const { rows: responseResults } = await query<ResponseResultRow>(
    `
      select
        rl.worker_id,
        s.full_name,
        s.mobile,
        rl.channel,
        rl.response_type,
        rl.response_time::text,
        b.booking_status
      from response_log rl
      join staff_subs s on s.worker_id = rl.worker_id
      left join bookings b
        on b.job_id = rl.job_id
       and b.worker_id = rl.worker_id
      where rl.job_id = $1
      order by rl.sent_time desc, s.full_name asc
    `,
    [jobId],
  );

  return (
    <>
      <p style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/jobs">Back to jobs</Link>
        <Link href={`/jobs?title=${encodeURIComponent(job.job_title)}`}>Back to filtered overview</Link>
      </p>
      <JobDispatchConsole
        job={{
          ...job,
          fill_status: getFillStatus(job.workers_required, job.workers_confirmed),
        }}
        matchedWorkers={matchedWorkers}
        responseResults={responseResults}
      />
    </>
  );
}
