import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_IMAGE_BUCKET = "profile-pictures";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_PROFILE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function getProfileImageExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName;
  }

  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

export function validateProfileImage(file: File) {
  if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error("Please upload a JPG, PNG, WEBP, or GIF image.");
  }

  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error("Profile image must be 5MB or smaller.");
  }
}

export async function uploadOwnProfileImage({
  supabase,
  userId,
  file,
}: {
  supabase: SupabaseClient;
  userId: string;
  file: File;
}) {
  validateProfileImage(file);

  const extension = getProfileImageExtension(file);
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl,
  };
}
