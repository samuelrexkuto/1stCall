import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getDefaultRecruiterOnboardingTemplate,
  getDefaultWorkerOnboardingTemplate,
  loadMessageTemplate,
  saveMessageTemplate,
  type MessageTemplateRecord,
} from "@/lib/message-templates";

const defaultTemplateByType = {
  recruiter_onboarding: getDefaultRecruiterOnboardingTemplate,
  worker_onboarding: getDefaultWorkerOnboardingTemplate,
} as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get("template_type") as MessageTemplateRecord["template_type"] | null;

    if (!templateType || !(templateType in defaultTemplateByType)) {
      return NextResponse.json({ success: false, error: "Valid template_type is required." }, { status: 400 });
    }

    const loaded = await loadMessageTemplate(templateType);
    return NextResponse.json({
      success: true,
      template: loaded ?? defaultTemplateByType[templateType](),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load template.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const json = (await request.json()) as MessageTemplateRecord;

    if (!json.template_type || !(json.template_type in defaultTemplateByType) || !json.body?.trim()) {
      return NextResponse.json({ success: false, error: "template_type and body are required." }, { status: 400 });
    }

    const saved = await saveMessageTemplate({
      ...defaultTemplateByType[json.template_type](),
      ...json,
      subject: null,
      channel: "whatsapp",
      body: json.body.trim(),
    });

    return NextResponse.json({ success: true, template: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save template.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
