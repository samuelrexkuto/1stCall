import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workerId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { workerId } = await params;
  const body = await request.json().catch(() => ({}));
  const availableToday = body?.available_today;

  if (typeof availableToday !== "boolean") {
    return NextResponse.json({ success: false, error: "available_today must be true or false." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("workers")
    .update({ available_today: availableToday })
    .eq("id", workerId)
    .select("id, available_today")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "Worker not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    worker: {
      worker_id: String(data.id),
      available_today: Boolean(data.available_today),
    },
  });
}
