import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("job_id, worker_type, skill_tags, dbs_required")
    .eq("job_id", jobId)
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 404 });
  }

  const query = supabase
    .from("staff_subs")
    .select(
      "worker_id, full_name, worker_type, available_today, skill_tags, right_to_work, contract_signed, dbs_status, reliability_score",
    )
    .eq("status", "active")
    .eq("available_today", true)
    .eq("right_to_work", true)
    .eq("contract_signed", true);

  if (job.worker_type) query.eq("worker_type", job.worker_type);
  if (job.dbs_required) query.not("dbs_status", "is", null);

  const { data: candidates, error: candidateError } = await query;

  if (candidateError) {
    return NextResponse.json({ error: candidateError.message }, { status: 500 });
  }

  const ranked = (candidates ?? [])
    .map((candidate) => {
      const matchedSkills = job.skill_tags.filter((tag: string) =>
        (candidate.skill_tags ?? []).includes(tag),
      ).length;

      return {
        ...candidate,
        matchedSkills,
      };
    })
    .filter((candidate) => candidate.matchedSkills > 0 || job.skill_tags.length === 0)
    .sort((a, b) => {
      if (b.matchedSkills !== a.matchedSkills) return b.matchedSkills - a.matchedSkills;
      return (b.reliability_score ?? 0) - (a.reliability_score ?? 0);
    });

  return NextResponse.json({
    data: ranked,
    notes: "Add postcode-distance and channel dispatch orchestration here later.",
  });
}
