import { NextRequest, NextResponse } from "next/server";

import {
  PROFILE_IMAGE_BUCKET,
  getProfileImageExtension,
  validateProfileImage,
} from "@/lib/profileImages";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      accountId: string;
    }>;
  },
) {
  await requireAdmin();

  const { accountId } = await context.params;
  const supabase = createAdminSupabaseClient();
  const formData = await request.formData();

  const patch = removeUndefined({
    name: getText(formData, "name"),
    email: getText(formData, "email"),
    phone: getText(formData, "phone"),
    town: getText(formData, "town"),
    postcode: getText(formData, "postcode"),
    profile_image_url: undefined as string | undefined,
    profile_image_path: undefined as string | undefined,
  });

  const image = formData.get("profileImage");

  if (image instanceof File && image.size > 0) {
    try {
      validateProfileImage(image);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid profile image.",
        },
        {
          status: 400,
        },
      );
    }

    const extension = getProfileImageExtension(image);
    const objectPath = `admin-managed/${accountId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_IMAGE_BUCKET)
      .upload(objectPath, image, {
        cacheControl: "3600",
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error: uploadError.message,
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(objectPath);

    patch.profile_image_url = publicUrl;
    patch.profile_image_path = objectPath;
  }

  const { data: account, error } = await supabase
    .from("project_management_accounts")
    .update(patch)
    .eq("id", accountId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 400,
      },
    );
  }

  return NextResponse.json({
    account,
  });
}
