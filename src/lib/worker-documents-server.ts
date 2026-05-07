import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupportedWorkerDocument,
  sanitizeStorageFileName,
  supportsMultipleFiles,
  WORKER_DOCUMENT_BUCKET,
  type WorkerDocument,
  type WorkerDocumentType,
} from "@/lib/worker-documents";

function mapDocument(document: Record<string, unknown>): WorkerDocument {
  return {
    id: String(document.id),
    worker_id: String(document.worker_id),
    document_type: document.document_type as WorkerDocumentType,
    file_name: String(document.file_name),
    file_path: String(document.file_path),
    file_url: typeof document.file_url === "string" ? document.file_url : null,
    mime_type: typeof document.mime_type === "string" ? document.mime_type : null,
    created_at: String(document.created_at),
  };
}

export async function uploadWorkerDocuments(
  supabase: SupabaseClient,
  workerId: string,
  documentType: WorkerDocumentType,
  files: File[],
) {
  if (files.length === 0) {
    return [];
  }

  const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(
    WORKER_DOCUMENT_BUCKET,
  );

  if (bucketError || !bucketData) {
    throw new Error(
      `Storage bucket "${WORKER_DOCUMENT_BUCKET}" was not found. Create it in Supabase Storage before uploading worker documents.`,
    );
  }

  if (!supportsMultipleFiles(documentType) && files.length > 1) {
    throw new Error(`${documentType} only supports a single file upload.`);
  }

  const unsupportedFile = files.find((file) => !isSupportedWorkerDocument(file));

  if (unsupportedFile) {
    throw new Error(
      `Unsupported file type for ${unsupportedFile.name}. Allowed types: jpg, jpeg, png, webp, heic, heif, pdf, doc, docx.`,
    );
  }

  const existingSingleTypeDocuments = !supportsMultipleFiles(documentType)
    ? (
        await supabase
          .from("worker_documents")
          .select("id, file_path")
          .eq("worker_id", workerId)
          .eq("document_type", documentType)
      ).data ?? []
    : [];

  const uploadedDocuments: WorkerDocument[] = [];

  for (const file of files) {
    const sanitizedFileName = sanitizeStorageFileName(file.name || "document");
    const filePath = `workers/${workerId}/${documentType}/${randomUUID()}-${sanitizedFileName}`;
    const { error: uploadError } = await supabase.storage
      .from(WORKER_DOCUMENT_BUCKET)
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from(WORKER_DOCUMENT_BUCKET)
      .getPublicUrl(filePath);

    const { data: documentRow, error: insertError } = await supabase
      .from("worker_documents")
      .insert({
        worker_id: workerId,
        document_type: documentType,
        file_name: file.name,
        file_path: filePath,
        file_url: publicUrlData.publicUrl || null,
        mime_type: file.type || null,
      })
      .select("id, worker_id, document_type, file_name, file_path, file_url, mime_type, created_at")
      .single();

    if (insertError) {
      await supabase.storage.from(WORKER_DOCUMENT_BUCKET).remove([filePath]);
      throw new Error(insertError.message);
    }

    uploadedDocuments.push(mapDocument(documentRow));
  }

  if (existingSingleTypeDocuments.length > 0) {
    const existingFilePaths = existingSingleTypeDocuments
      .map((document) => document.file_path)
      .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);

    if (existingFilePaths.length > 0) {
      await supabase.storage.from(WORKER_DOCUMENT_BUCKET).remove(existingFilePaths);
    }

    const existingDocumentIds = existingSingleTypeDocuments
      .map((document) => document.id)
      .filter((documentId): documentId is string => typeof documentId === "string" && documentId.length > 0);

    if (existingDocumentIds.length > 0) {
      await supabase
        .from("worker_documents")
        .delete()
        .in("id", existingDocumentIds);
    }
  }

  return uploadedDocuments;
}
