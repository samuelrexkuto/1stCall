import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTrialAccessPatch, ManagedAccountResolutionError, resolveManagedAccount, updateAccountAccess } from "@/lib/account-access-service";
import { loadProvidersOverview } from "@/lib/providers";

type TrialAction = "grant" | "extend" | "revoke";

function parseAction(value: unknown): TrialAction | null {
  return value === "grant" || value === "extend" || value === "revoke" ? value : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { providerId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = parseAction(body?.action);
  if (!action) {
    return NextResponse.json({ success: false, error: "Invalid trial action." }, { status: 400 });
  }

  const note = typeof body?.note === "string" && body.note.trim()
    ? body.note.trim()
    : typeof body?.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;

  try {
    const resolved = await resolveManagedAccount({ targetAccountId: providerId, targetTable: "job_providers" });
    const account = { ...(resolved.mirrorAccount ?? {}), ...(resolved.canonicalAccount ?? {}) };
    const accessPatch = buildTrialAccessPatch({
      action,
      durationDays: body?.durationDays,
      admin,
      account,
      notes: note,
    });
    const result = await updateAccountAccess({
      targetAccountId: providerId,
      targetTable: "job_providers",
      eventType: action === "revoke" ? "revoke_trial" : action === "extend" ? "extend_trial" : "grant_trial",
      accessPatch,
      admin,
      notes: note,
    });
    const overview = await loadProvidersOverview();
    const provider = overview.providers.find((row) =>
      row.id === providerId ||
      row.provider_id === providerId ||
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
    const debug =
      process.env.NODE_ENV !== "production" && error instanceof ManagedAccountResolutionError
        ? { debug: error.debug }
        : {};
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to grant trial because the target account could not be resolved.",
        ...debug,
      },
      { status },
    );
  }
}
