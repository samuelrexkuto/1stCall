import { NextResponse } from "next/server";
import { extractStructuredJobIntake } from "@/lib/job-intake/openai";
import { structuredJobIntakeSchema } from "@/lib/job-intake/schema";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as {
      source_text?: unknown;
      text_input?: unknown;
      transcript_text?: unknown;
      selected_keywords?: unknown;
    };
    const textInput = typeof json.text_input === "string" ? json.text_input.trim() : "";
    const transcriptText =
      typeof json.transcript_text === "string" ? json.transcript_text.trim() : "";
    const sourceText = typeof json.source_text === "string" ? json.source_text.trim() : "";
    const selectedKeywords = Array.isArray(json.selected_keywords)
      ? json.selected_keywords.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];

    if (!sourceText && !textInput && !transcriptText) {
      return NextResponse.json(
        { success: false, error: "text_input, transcript_text, or source_text is required." },
        { status: 400 },
      );
    }

    const structuredJob = await extractStructuredJobIntake({
      textInput: textInput || sourceText,
      transcriptText,
      selectedKeywords,
    });
    const validated = structuredJobIntakeSchema.parse(structuredJob);

    return NextResponse.json({
      success: true,
      source_text: [textInput || sourceText, transcriptText].filter(Boolean).join("\n\n"),
      selected_keywords: selectedKeywords,
      structured_job: validated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to extract job details.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
