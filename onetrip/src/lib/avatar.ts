import "server-only";
import sharp from "sharp";
import { AVATAR_MAX_BYTES } from "@/lib/avatar-rules";
import { createClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const AVATAR_SIZE = 256;
const SIGNED_URL_SECONDS = 60 * 60;
// Formats detected from the file contents, not the browser-reported type.
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ProcessedAvatar =
  | { ok: true; data: Buffer }
  | { ok: false; error: string };

// Validates the actual image contents, then crops to a square, fixes
// orientation, strips metadata (including location), and converts to WebP.
export async function processAvatar(file: File): Promise<ProcessedAvatar> {
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Choose a picture smaller than 5 MB." };
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 40_000_000 });
    const { format } = await image.metadata();
    if (!format || !SUPPORTED_FORMATS.has(format)) {
      return { ok: false, error: "Use a JPEG, PNG, or WebP image." };
    }

    const data = await image
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "We couldn't read that picture. Try a different one.",
    };
  }
}

// Stores the avatar and records it on the user's profile. Storage policies
// restrict writes to the caller's own folder.
export async function saveAvatar(userId: string, data: Buffer) {
  const supabase = await createClient();
  const path = `${userId}/avatar.webp`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, data, { contentType: "image/webp", upsert: true });
  if (uploadError) {
    return { ok: false as const };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, avatar_path: path });
  return { ok: !profileError };
}

export async function removeAvatar(userId: string) {
  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, avatar_path: null });
  if (profileError) {
    return { ok: false as const };
  }
  // The profile no longer points at the file, so a failure here only
  // leaves an unused object behind.
  await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.webp`]);
  return { ok: true as const };
}

// A short-lived URL for the user's avatar, or null if they don't have one.
export async function getAvatarUrl(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .maybeSingle<{ avatar_path: string | null }>();

  if (!profile?.avatar_path) {
    return null;
  }

  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(profile.avatar_path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}
