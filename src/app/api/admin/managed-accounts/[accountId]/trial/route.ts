import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildTrialAccessPatch,
  ManagedAccountResolutionError,
  resolveManagedAccount,
  updateAccountAccess,
  type ManagedAccountTable,
} from "@/lib/account-access-service";
import { loadProvidersOverview } from "@/lib/providers";

type TrialAction = "grant" | "extend" | "revoke";

function parseAction(value: unknown): TrialAction {
  return value === "extend" || value === "revoke" ? value : "grant";
}

function parseSourceTable(value: unknown): ManagedAccountTable | undefined {
  return value === "project_management_accounts" || value === "job_providers" ? value : undefined;
}

function errorPayload(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to grant trial because the target account could not be resolved.";
  const debug =
    process.env.NODE_ENV !== "production" && error instanceof ManagedAccountResolutionError
      ? { debug: error.debug }
      : {};
  return { success: false, error: message, ...debug };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { accountId } = await params;
  const body = await request.json().catch(() => ({}));
  const sourceTable = parseSourceTable(body?.sourceTable);
  const action = parseAction(body?.action);
  const notes = typeof body?.notes === "string" && body.notes.trim()
    ? body.notes.trim()
    : typeof body?.note === "string" && body.note.trim()
      ? body.note.trim()
      : null;

  try {
    const resolved = await resolveManagedAccount({ id: accountId, sourceTable });
    const account = { ...(resolved.mirrorAccount ?? {}), ...(resolved.canonicalAccount ?? {}) };
    const accessPatch = buildTrialAccessPatch({
      action,
      durationDays: body?.durationDays,
      admin,
      account,
      notes,
    });
    const result = await updateAccountAccess({
      targetAccountId: accountId,
      targetTable: sourceTable,
      eventType: action === "revoke" ? "revoke_trial" : action === "extend" ? "extend_trial" : "grant_trial",
      accessPatch,
      admin,
      notes,
    });
    const overview = await loadProvidersOverview();
    const provider = overview.providers.find((row) =>
      row.id === accountId ||
      row.provider_id === accountId ||
      row.id === String(result.canonicalAccount?.id ?? "") ||
      row.provider_id === String(result.mirrorAccount?.id ?? ""),
    ) ?? null;

    return NextResponse.json({
      success: true,
      trial: accessPatch,
      provider,
      canonicalAccount: result.canonicalAccount,
      mirrorAccount: result.mirrorAccount,
      entitlements: result.entitlements,
      accountAccessEventId: result.accountAccessEventId,
      adminActionEventId: result.adminActionEventId,
    });
  } catch (error) {
    const status = error instanceof ManagedAccountResolutionError ? error.status : 500;
    return NextResponse.json(errorPayload(error), { status });
  }
}
