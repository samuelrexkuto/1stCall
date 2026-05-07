import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { jobIntakeDraftSchema } from "@/lib/job-intake/schema";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = jobIntakeDraftSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid draft payload." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("job_intake_drafts")
      .insert({
        raw_text_input: parsed.data.raw_text_input,
        raw_audio_url: parsed.data.raw_audio_url,
        transcript_text: parsed.data.transcript_text,
        ai_structured_job_json: parsed.data.ai_structured_job_json,
        final_user_approved_job_json: parsed.data.final_user_approved_job_json,
      })
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, draft: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save intake draft.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
