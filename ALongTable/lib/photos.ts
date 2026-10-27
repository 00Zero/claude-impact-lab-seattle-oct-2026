import "server-only";
import { supabase } from "@/lib/supabase";

// Photos for restaurants and events live in one public Storage bucket, `photos` (see
// supabase/add-photos.sql), in folders restaurants/<id>/ and events/<id>/. The server uploads
// with the service role key; callers then save the returned public URL on the row.

const BUCKET = "photos";
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // under Vercel's ~4.5 MB request limit
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type PhotoKind = "restaurants" | "events";
export type PhotoResult = { ok: true; url: string; path: string } | { ok: false; message: string };

/** The reason a file can't be used as a photo, or null if it's fine. Cheap enough to run before anything is saved. */
export function checkPhoto(file: FormDataEntryValue | null): string | null {
  if (!(file instanceof File) || file.size === 0) return "Choose a photo to upload.";
  if (!TYPES[file.type]) return "Use a JPEG, PNG or WebP photo.";
  if (file.size > MAX_PHOTO_BYTES) return "That photo is over 4 MB. Choose a smaller one.";
  return null;
}

/** Upload to photos/<kind>/<id>/<random>.<ext> and return its public URL. Saving the URL is up to the caller. */
export async function uploadPhoto(kind: PhotoKind, id: string, file: File): Promise<PhotoResult> {
  const problem = checkPhoto(file);
  if (problem) return { ok: false, message: problem };

  const path = `${kind}/${id}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  const storage = supabase().storage.from(BUCKET);
  const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) {
    console.error("uploadPhoto: upload failed", error.message);
    return { ok: false, message: "We couldn't upload that photo. Please try again." };
  }
  return { ok: true, url: storage.getPublicUrl(path).data.publicUrl, path };
}

/** Delete an uploaded file by its path. Best effort: used to clean up after a failed save or a replaced photo. */
export async function removePhotoFile(path: string): Promise<void> {
  await supabase().storage.from(BUCKET).remove([path]);
}

/** Best effort: delete a previous photo by its public URL. Ignores URLs that aren't in our bucket. */
export async function removePhotoByUrl(url: string | null | undefined): Promise<void> {
  const marker = `/${BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  if (!url || i < 0) return;
  await removePhotoFile(decodeURIComponent(url.slice(i + marker.length)));
}
