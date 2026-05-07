import {
  structuredJobIntakeJsonSchema,
  structuredJobIntakeSchema,
  type StructuredJobIntake,
} from "@/lib/job-intake/schema";
import { enrichStructuredJobIntakeDates } from "@/lib/job-intake/dates";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const DEFAULT_EXTRACTION_MODEL = process.env.OPENAI_JOB_INTAKE_MODEL || "gpt-4o-mini";
const DEFAULT_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return apiKey;
}

function readOutputText(payload: unknown): string {
  if (payload && typeof payload === "object" && "output_text" in payload) {
    const outputText = (payload as { output_text?: unknown }).output_text;
    if (typeof outputText === "string") return outputText;
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { output?: unknown[] }).output)) {
    const output = (payload as {
      output: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    }).output;

    return output
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text as string)
      .join("");
  }

  return "";
}

export async function extractStructuredJobIntake({
  textInput,
  transcriptText,
  selectedKeywords = [],
}: {
  textInput?: string;
  transcriptText?: string;
  selectedKeywords?: string[];
}): Promise<StructuredJobIntake> {
  const promptParts = [
    textInput?.trim() ? `Typed recruiter input:\n${textInput.trim()}` : "",
    transcriptText?.trim() ? `Voice transcript:\n${transcriptText.trim()}` : "",
    selectedKeywords.length
      ? `Selected keyword hints:\n${selectedKeywords.join(", ")}`
      : "",
  ].filter(Boolean);

  const sourceText = promptParts.join("\n\n");
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  if (!sourceText) {
    throw new Error("No source text was provided for job intake extraction.");
  }

  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: DEFAULT_EXTRACTION_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                `Extract workforce job intake details into the provided schema. Use only details clearly stated by the recruiter or client. Never invent missing values. Unknown or unclear values must be null. Keep missing_fields accurate. Normalize rough recruiter language into clean internal wording while preserving meaning. Treat selected keyword hints as helpful refinement, not as guaranteed facts. Preserve recruiter intent. Normalize common slang such as sparky to electrician, chippy to carpenter, and labour to labourer when appropriate. Include the selected keywords in selected_keywords. Pay close attention to alert type, role, headcount, location, duration, start date, end date, pay format, duties, DBS level, IPAF, own tools, PPE, skills, shift pattern, and tickets. Map phrases like 'dbs school role', 'enhanced needed', 'must have tools', 'ipaf job', 'night shift', and 'price work' into the correct structured fields when explicitly stated. Today's date is ${todayIso}. Resolve relative timing like 'next Monday', 'Monday next week', or 'this Friday' against that date when possible. If a duration like '5 days' is stated and a start date can be resolved, return both start_date and end_date using that duration.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: sourceText,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "job_intake_brief",
          strict: true,
          schema: structuredJobIntakeJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI extraction failed: ${errorText}`);
  }

  const payload = await response.json();
  const outputText = readOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI extraction returned no structured output.");
  }

  const parsed = structuredJobIntakeSchema.safeParse(JSON.parse(outputText));

  if (!parsed.success) {
    throw new Error(`OpenAI extraction returned invalid JSON: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  }

  return enrichStructuredJobIntakeDates(parsed.data, sourceText, today);
}

export async function transcribeAudioFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", DEFAULT_TRANSCRIBE_MODEL);
  formData.append("response_format", "json");

  const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI transcription failed: ${errorText}`);
  }

  const payload = (await response.json()) as { text?: string };

  if (!payload.text?.trim()) {
    throw new Error("OpenAI transcription returned no transcript text.");
  }

  return payload.text.trim();
}
