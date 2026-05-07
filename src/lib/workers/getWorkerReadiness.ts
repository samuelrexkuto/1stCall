export function getWorkerReadiness(worker: any) {
  const contractSigned =
    worker.contract_status === "signed" ||
    worker.contract_signed_at != null ||
    worker.contract_signed === true;
  const docsReady =
    Boolean(worker.id_document_uploaded) &&
    Boolean(worker.cscs_uploaded);

  if (contractSigned && docsReady) {
    return "work_ready";
  }

  if (docsReady && !contractSigned) {
    return "contract_pending";
  }

  return "documents_pending";
}
