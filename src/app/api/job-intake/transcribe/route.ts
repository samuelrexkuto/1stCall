import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { transcribeAudioFile } from "@/lib/job-intake/openai";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const AUDIO_BUCKET = "job-intake-audio";
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "video/webm",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { success: false, error: "audio file is required." },
        { status: 400 },
      );
    }

    if (!ALLOWED_AUDIO_TYPES.has(audio.type)) {
      return NextResponse.json(
        { success: false, error: `Unsupported audio type: ${audio.type || "unknown"}.` },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const extension = audio.name.includes(".") ? audio.name.split(".").pop() : "webm";
    const filePath = `intake-audio/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await audio.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(filePath, buffer, {
        contentType: audio.type,
        upsert: false,
      });

    if (uploadError) {
      const clearerMessage = uploadError.message.includes("Bucket not found")
        ? 'Storage bucket "job-intake-audio" was not found. Create it before using AI voice intake.'
        : uploadError.message;
      return NextResponse.json({ success: false, error: clearerMessage }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(filePath);
    const transcriptText = await transcribeAudioFile(audio);

    return NextResponse.json({
      success: true,
      raw_audio_url: publicUrlData.publicUrl,
      transcript_text: transcriptText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to transcribe audio.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
