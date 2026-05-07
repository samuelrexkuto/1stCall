import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { WORKER_DOCUMENT_BUCKET } from "@/lib/worker-documents";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workerId: string; documentId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { workerId, documentId } = await params;

  try {
    const supabase = createAdminSupabaseClient();
    const { data: document, error: fetchError } = await supabase
      .from("worker_documents")
      .select("id, worker_id, file_path")
      .eq("id", documentId)
      .eq("worker_id", workerId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Document not found." }, { status: 404 });
      }

      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    const { error: storageError } = await supabase.storage
      .from(WORKER_DOCUMENT_BUCKET)
      .remove([document.file_path]);

    if (storageError) {
      return NextResponse.json({ success: false, error: storageError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabase
      .from("worker_documents")
      .delete()
      .eq("id", documentId)
      .eq("worker_id", workerId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete worker document";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
