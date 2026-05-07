import { NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const PROFILE_IMAGE_BUCKET = "profile-images";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Choose a profile image to upload." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ success: false, error: "Use a JPG, PNG, WEBP, or GIF image." }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ success: false, error: "Profile image must be 3MB or smaller." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const extension = extensionForType(file.type);
  const filePath = `${currentUser.providerId}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(filePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        success: false,
        error: uploadError.message,
        hint: `Ensure the Supabase storage bucket "${PROFILE_IMAGE_BUCKET}" exists and is public or readable by this app.`,
      },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(filePath);
  return NextResponse.json({ success: true, avatarUrl: data.publicUrl, path: filePath });
}
