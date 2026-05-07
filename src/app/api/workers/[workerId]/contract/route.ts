import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getWorkerReadiness } from "@/lib/workers/getWorkerReadiness";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workerId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { workerId } = await params;

  try {
    const { action, contract_document_url } = (await request.json().catch(() => ({}))) as {
      action?: string;
      contract_document_url?: string | null;
    };

    if (!action || !["preview", "send", "mark_signed"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid contract action." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const selectClause =
      "id, full_name, contract_signed, contract_status, contract_sent_at, contract_signed_at, contract_document_url, onboarding_status, id_document_uploaded, cscs_uploaded, certificates_uploaded, portfolio_uploaded";
    const fallbackSelect =
      "id, full_name, contract_signed";

    let worker: Record<string, unknown> | null = null;
    let error: { message: string; code?: string } | null = null;
    const primaryLookup = await supabase
      .from("workers")
      .select(selectClause)
      .eq("id", workerId)
      .maybeSingle();
    worker = (primaryLookup.data as Record<string, unknown> | null) ?? null;
    error = primaryLookup.error;

    if (error) {
      const fallbackResult = await supabase
        .from("workers")
        .select(fallbackSelect)
        .eq("id", workerId)
        .maybeSingle();
      worker = (fallbackResult.data as Record<string, unknown> | null) ?? null;
      error = fallbackResult.error;
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!worker) {
      return NextResponse.json({ success: false, error: "Worker not found." }, { status: 404 });
    }

    if (action === "preview") {
      return NextResponse.json({ success: true, worker });
    }

    const updatePayload =
      action === "send"
        ? {
            contract_status: "sent",
            contract_sent_at: new Date().toISOString(),
            contract_document_url: typeof contract_document_url === "string" ? contract_document_url : null,
          }
        : {
            contract_status: "signed",
            contract_signed_at: new Date().toISOString(),
            contract_signed: true,
          };

    const mergedWorker = { ...worker, ...updatePayload };
    const nextOnboardingStatus =
      action === "mark_signed" ? getWorkerReadiness(mergedWorker) : worker.onboarding_status ?? "contract_pending";

    const { data: updatedWorker, error: updateError } = await supabase
      .from("workers")
      .update({
        ...updatePayload,
        onboarding_status: nextOnboardingStatus,
      })
      .eq("id", workerId)
      .select(selectClause)
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const mirrorPayload =
      action === "send"
        ? {
            contract_status: "sent",
            contract_sent_at: "contract_sent_at" in updatePayload ? updatePayload.contract_sent_at : null,
            contract_document_url:
              "contract_document_url" in updatePayload ? updatePayload.contract_document_url ?? null : null,
          }
        : {
            contract_status: "signed",
            contract_signed_at: "contract_signed_at" in updatePayload ? updatePayload.contract_signed_at : null,
            contract_signed: true,
            onboarding_status: nextOnboardingStatus,
          };

    const mirrorResult = await supabase.from("staff_subs").update(mirrorPayload).eq("worker_id", workerId);
    if (mirrorResult.error && mirrorResult.error.code !== "PGRST205") {
      console.warn("[contract] staff_subs mirror failed", mirrorResult.error.message);
    }

    return NextResponse.json({ success: true, worker: updatedWorker });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Contract workflow failed." },
      { status: 500 },
    );
  }
}
