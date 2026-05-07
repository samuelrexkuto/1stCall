export const WORKER_DOCUMENT_BUCKET = "worker-documents";

export const WORKER_DOCUMENT_TYPES = [
  "cscs_card",
  "id_document",
  "portfolio",
  "certificate",
  "sia_badge",
  "enhanced_dbs",
  "dbs",
] as const;

export type WorkerDocumentType = (typeof WORKER_DOCUMENT_TYPES)[number];

export interface WorkerDocument {
  id: string;
  worker_id: string;
  document_type: WorkerDocumentType;
  file_name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string | null;
  created_at: string;
}

export function getWorkerDocumentLabel(documentType: WorkerDocumentType) {
  switch (documentType) {
    case "cscs_card":
      return "CSCS Card";
    case "id_document":
      return "ID Document";
    case "portfolio":
      return "Portfolio";
    case "certificate":
      return "Certificate";
    case "sia_badge":
      return "SIA Badge";
    case "enhanced_dbs":
      return "Enhanced DBS";
    case "dbs":
      return "DBS";
  }
}

export const MULTI_FILE_DOCUMENT_TYPES: WorkerDocumentType[] = ["portfolio", "certificate"];

export const SUPPORTED_WORKER_DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const SUPPORTED_WORKER_DOCUMENT_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
  ".doc",
  ".docx",
];

export function isPreviewableImage(mimeType: string | null, fileName: string) {
  if (mimeType?.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}

export function sanitizeStorageFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");
}

export function isSupportedWorkerDocument(file: File) {
  if (SUPPORTED_WORKER_DOCUMENT_MIME_TYPES.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return SUPPORTED_WORKER_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

export function supportsMultipleFiles(documentType: WorkerDocumentType) {
  return MULTI_FILE_DOCUMENT_TYPES.includes(documentType);
}

export function getWorkerDocumentSectionsForRole(primaryRole: string | null | undefined) {
  const normalizedRole = (primaryRole ?? "").trim().toLowerCase();

  const isConstructionRole = [
    "construction",
    "labour",
    "labourer",
    "labor",
    "laborer",
    "builder",
    "skilled labourer",
    "skilled laborer",
    "general labourer",
    "general laborer",
    "site operative",
  ].some((keyword) => normalizedRole.includes(keyword));

  const isSecurityRole = [
    "security",
    "door supervisor",
    "guard",
    "cctv",
    "sia",
  ].some((keyword) => normalizedRole.includes(keyword));

  if (isSecurityRole) {
    return [
      "id_document",
      "sia_badge",
      "enhanced_dbs",
      "dbs",
      "certificate",
      "portfolio",
    ] as WorkerDocumentType[];
  }

  if (isConstructionRole) {
    return [
      "cscs_card",
      "id_document",
      "enhanced_dbs",
      "dbs",
      "portfolio",
      "certificate",
    ] as WorkerDocumentType[];
  }

  return ["id_document", "certificate", "portfolio"] as WorkerDocumentType[];
}
