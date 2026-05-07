import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  WORKER_DOCUMENT_TYPES,
  type WorkerDocumentType,
} from "@/lib/worker-documents";
import { uploadWorkerDocuments } from "@/lib/worker-documents-server";

function isWorkerDocumentType(value: string): value is WorkerDocumentType {
  return WORKER_DOCUMENT_TYPES.includes(value as WorkerDocumentType);
}

function mapDocument(document: Record<string, unknown>) {
  return {
    id: String(document.id),
    worker_id: String(document.worker_id),
    document_type: document.document_type,
    file_name: String(document.file_name),
    file_path: String(document.file_path),
    file_url: typeof document.file_url === "string" ? document.file_url : null,
    mime_type: typeof document.mime_type === "string" ? document.mime_type : null,
    created_at: String(document.created_at),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workerId: string }> },
) {
  const { workerId } = await params;

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("worker_documents")
      .select("id, worker_id, document_type, file_name, file_path, file_url, mime_type, created_at")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documents: (data ?? []).map(mapDocument),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load worker documents";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

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
    const formData = await request.formData();
    const documentTypeValue = formData.get("document_type");

    if (typeof documentTypeValue !== "string" || !isWorkerDocumentType(documentTypeValue)) {
      return NextResponse.json(
        { success: false, error: "Invalid document type." },
        { status: 400 },
      );
    }

    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files were provided." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const uploadedDocuments = await uploadWorkerDocuments(supabase, workerId, documentTypeValue, files);

    return NextResponse.json({ success: true, documents: uploadedDocuments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload worker documents";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
