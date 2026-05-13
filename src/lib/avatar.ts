export type AvatarLike = {
  profile_image_url?: string | null;
  profile_image_path?: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
  image_url?: string | null;
  logo_url?: string | null;
};

export function getAvatarUrl(...sources: Array<AvatarLike | null | undefined>) {
  for (const source of sources) {
    if (!source) continue;

    const url =
      source.profile_image_url ||
      source.avatar_url ||
      source.image_url ||
      source.logo_url;

    if (typeof url === "string" && url.trim().length > 0) {
      return url.trim();
    }
  }

  return null;
}

export function getAvatarPath(...sources: Array<AvatarLike | null | undefined>) {
  for (const source of sources) {
    if (!source) continue;

    const path = source.profile_image_path || source.avatar_path;

    if (typeof path === "string" && path.trim().length > 0) {
      return path.trim();
    }
  }

  return null;
}

export function cacheBustImageUrl(url: string | null | undefined) {
  if (!url) return null;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}
