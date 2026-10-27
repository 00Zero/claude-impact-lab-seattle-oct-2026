import "server-only";
import convertHeic from "heic-convert";
import sharp from "sharp";
import { hashIntakeToken } from "@/lib/intake-links";
import {
  INTAKE_CAPTION_MAX_LENGTH,
  INTAKE_DESCRIPTION_MAX_LENGTH,
  INTAKE_PHOTO_MAX_BYTES,
  INTAKE_PHOTO_MAX_COUNT,
  type IntakePhoto,
} from "@/lib/intake-photo-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "intake-photos";
const FULL_SIZE = 2048;
const THUMBNAIL_SIZE = 480;
// Smaller images can't show enough of the problem to be useful.
const MIN_SIZE = 200;
const SIGNED_URL_SECONDS = 60 * 60;
// Formats detected from the file contents, not the browser-reported type.
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);

export type IntakeResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type StoredFiles = { object_path: string; thumb_path: string };

// Errors raised by the intake database functions, as the customer sees them.
const DATABASE_ERRORS: Record<string, string> = {
  link_inactive: "This link is no longer active. Ask the business for a new one.",
  photo_limit: `You can add up to ${INTAKE_PHOTO_MAX_COUNT} photos. Remove one to add another.`,
  upload_limit:
    "This request has had too many uploads. Contact the business directly.",
  photo_not_found:
    "That photo is no longer here. Refresh the page and try again.",
};

function databaseError(message: string) {
  return (
    DATABASE_ERRORS[message] ?? "Something went wrong. Please try again."
  );
}

type ProcessedPhoto = {
  full: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
};

// Validates the actual image contents, applies EXIF orientation, and
// re-encodes as WebP. Re-encoding drops all metadata, including location.
async function processIntakePhoto(
  file: File,
): Promise<IntakeResult<{ photo: ProcessedPhoto }>> {
  if (file.size > INTAKE_PHOTO_MAX_BYTES) {
    return { ok: false, error: "Choose a photo smaller than 10 MB." };
  }

  try {
    let input = Buffer.from(await file.arrayBuffer());
    const { format, compression } = await sharp(input).metadata();
    if (!format || !SUPPORTED_FORMATS.has(format)) {
      return { ok: false, error: "Use a JPEG, PNG, or WebP photo." };
    }
    // Sharp's prebuilt binaries can't decode HEVC, which iPhone HEIC photos
    // use (AVIF, the other HEIF codec, works). Convert those to JPEG first;
    // libheif applies the photo's rotation while decoding.
    if (format === "heif" && compression === "hevc") {
      input = Buffer.from(await convertHeic({ buffer: input, format: "JPEG", quality: 0.92 }));
    }

    const { data: full, info } = await sharp(input, {
      limitInputPixels: 100_000_000,
    })
      .rotate()
      .resize(FULL_SIZE, FULL_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < MIN_SIZE) {
      return {
        ok: false,
        error: "That photo is too small to show the problem. Try a larger one.",
      };
    }

    const thumbnail = await sharp(full)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
    return {
      ok: true,
      photo: { full, thumbnail, width: info.width, height: info.height },
    };
  } catch {
    return {
      ok: false,
      error:
        "We couldn't read that photo. Try taking it again, or choose a different one.",
    };
  }
}

// Processes and stores a customer photo. The database function checks the
// link and limits before anything is written to storage.
export async function addIntakePhoto(
  token: string,
  file: File,
  options: { replacesPhotoId: string | null },
): Promise<IntakeResult<{ photo: IntakePhoto }>> {
  const processed = await processIntakePhoto(file);
  if (!processed.ok) {
    return processed;
  }
  const { full, thumbnail, width, height } = processed.photo;

  const tokenHash = hashIntakeToken(token);
  const supabase = await createClient();
  const { data: reserved, error: reserveError } = await supabase
    .rpc("reserve_intake_photo", {
      p_token_hash: tokenHash,
      // Photos are free-form now; prompt_id is kept for older rows.
      p_prompt_id: null,
      p_replaces_photo_id: options.replacesPhotoId,
    })
    .single<{ photo_id: string } & StoredFiles>();
  if (reserveError) {
    return { ok: false, error: databaseError(reserveError.message) };
  }

  const storage = createAdminClient().storage.from(BUCKET);
  const uploads = await Promise.all([
    storage.upload(reserved.object_path, full, { contentType: "image/webp" }),
    storage.upload(reserved.thumb_path, thumbnail, {
      contentType: "image/webp",
    }),
  ]);
  if (uploads.some((upload) => upload.error)) {
    await removeReservedPhoto(tokenHash, reserved.photo_id);
    return { ok: false, error: "We couldn't save that photo. Please try again." };
  }

  const { rows: replaced, error: finalizeError } = await rpcRows<StoredFiles>(
    "finalize_intake_photo",
    {
      p_token_hash: tokenHash,
      p_photo_id: reserved.photo_id,
      p_width: width,
      p_height: height,
      p_replaces_photo_id: options.replacesPhotoId,
    },
  );
  if (finalizeError) {
    await removeReservedPhoto(tokenHash, reserved.photo_id);
    return { ok: false, error: databaseError(finalizeError.message) };
  }
  await deleteFiles(replaced);

  const [thumbnailUrl] = await signThumbnails([reserved.thumb_path]);
  return {
    ok: true,
    photo: {
      id: reserved.photo_id,
      caption: "",
      thumbnailUrl: thumbnailUrl ?? "",
    },
  };
}

export async function getIntakePhotos(token: string): Promise<IntakePhoto[]> {
  const { rows: data, error } = await rpcRows<{
    id: string;
    thumb_path: string;
    caption: string | null;
  }>("get_intake_photos", { p_token_hash: hashIntakeToken(token) });
  if (error) {
    throw new Error(`Failed to load intake photos: ${error.message}`);
  }

  const urls = await signThumbnails(data.map((row) => row.thumb_path));
  return data.map((row, index) => ({
    id: row.id,
    caption: row.caption ?? "",
    thumbnailUrl: urls[index] ?? "",
  }));
}

export async function removeIntakePhoto(
  token: string,
  photoId: string,
): Promise<IntakeResult> {
  const { rows, error } = await rpcRows<StoredFiles>("remove_intake_photo", {
    p_token_hash: hashIntakeToken(token),
    p_photo_id: photoId,
  });
  if (error) {
    return { ok: false, error: databaseError(error.message) };
  }
  await deleteFiles(rows);
  return { ok: true };
}

export async function setIntakePhotoCaption(
  token: string,
  photoId: string,
  caption: string,
): Promise<IntakeResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_intake_photo_caption", {
    p_token_hash: hashIntakeToken(token),
    p_photo_id: photoId,
    p_caption: caption.trim().slice(0, INTAKE_CAPTION_MAX_LENGTH),
  });
  return error
    ? { ok: false, error: databaseError(error.message) }
    : { ok: true };
}

// Turns the stored photo 90° clockwise. The files themselves are rewritten
// so the contractor's view and later AI analysis see the corrected image.
export async function rotateIntakePhoto(
  token: string,
  photoId: string,
): Promise<IntakeResult<{ thumbnailUrl: string }>> {
  const { rows, error } = await rpcRows<StoredFiles>("rotate_intake_photo", {
    p_token_hash: hashIntakeToken(token),
    p_photo_id: photoId,
  });
  const files = rows[0];
  if (error || !files) {
    return { ok: false, error: databaseError(error?.message ?? "photo_not_found") };
  }

  const failed = { ok: false as const, error: "We couldn't rotate that photo. Please try again." };
  const storage = createAdminClient().storage.from(BUCKET);
  const { data: original, error: downloadError } = await storage.download(
    files.object_path,
  );
  if (downloadError || !original) {
    return failed;
  }

  try {
    const full = await sharp(Buffer.from(await original.arrayBuffer()))
      .rotate(90)
      .webp({ quality: 85 })
      .toBuffer();
    const thumbnail = await sharp(full)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
    const uploads = await Promise.all([
      storage.upload(files.object_path, full, { contentType: "image/webp", upsert: true }),
      storage.upload(files.thumb_path, thumbnail, { contentType: "image/webp", upsert: true }),
    ]);
    if (uploads.some((upload) => upload.error)) {
      return failed;
    }
  } catch {
    return failed;
  }

  // A fresh signature also makes the browser fetch the rotated thumbnail.
  const [thumbnailUrl] = await signThumbnails([files.thumb_path]);
  return { ok: true, thumbnailUrl: thumbnailUrl ?? "" };
}

// For customers who can't provide a usable photo. With no photos saved,
// the database flags the request as having limited visual information.
export async function saveIntakeDescription(
  token: string,
  description: string,
): Promise<IntakeResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_intake_description", {
    p_token_hash: hashIntakeToken(token),
    p_description: description.trim().slice(0, INTAKE_DESCRIPTION_MAX_LENGTH),
  });
  return error
    ? { ok: false, error: databaseError(error.message) }
    : { ok: true };
}

export type RequestPhoto = {
  id: string;
  thumbnailUrl: string | null;
  fullUrl: string | null;
  caption: string | null;
};

// The contractor's view. RLS and storage policies limit both the rows and
// the signed URLs to the user's workspace.
export async function listRequestPhotos(
  organizationId: string,
  requestId: string,
): Promise<RequestPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_photos")
    .select("id, storage_path, thumbnail_path, caption")
    .eq("organization_id", organizationId)
    .eq("service_request_id", requestId)
    .eq("status", "ready")
    .is("removed_at", null)
    .order("sort_key")
    .order("created_at")
    .overrideTypes<
      {
        id: string;
        storage_path: string;
        thumbnail_path: string;
        caption: string | null;
      }[],
      { merge: false }
    >();
  if (error) {
    throw new Error(`Failed to load photos: ${error.message}`);
  }
  if (data.length === 0) {
    return [];
  }

  const storage = supabase.storage.from(BUCKET);
  const [thumbnails, fulls] = await Promise.all([
    storage.createSignedUrls(
      data.map((row) => row.thumbnail_path),
      SIGNED_URL_SECONDS,
    ),
    storage.createSignedUrls(
      data.map((row) => row.storage_path),
      SIGNED_URL_SECONDS,
    ),
  ]);
  return data.map((row, index) => ({
    id: row.id,
    thumbnailUrl: thumbnails.data?.[index]?.signedUrl ?? null,
    fullUrl: fulls.data?.[index]?.signedUrl ?? null,
    caption: row.caption,
  }));
}

async function signThumbnails(paths: string[]) {
  if (paths.length === 0) {
    return [];
  }
  const { data } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  return paths.map((_, index) => data?.[index]?.signedUrl ?? null);
}

async function removeReservedPhoto(tokenHash: string, photoId: string) {
  const { rows } = await rpcRows<StoredFiles>("remove_intake_photo", {
    p_token_hash: tokenHash,
    p_photo_id: photoId,
  });
  await deleteFiles(rows);
}

// The client isn't generated from the schema, so rpc() types every result
// as a single row. These functions return sets.
async function rpcRows<T>(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  return { rows: (data ?? []) as T[], error };
}

// Best effort: a failure leaves an orphaned object, not a visible photo.
async function deleteFiles(files: StoredFiles[]) {
  const paths = files.flatMap((file) => [
    file.object_path,
    file.thumb_path,
  ]);
  if (paths.length === 0) {
    return;
  }
  const { error } = await createAdminClient().storage.from(BUCKET).remove(paths);
  if (error) {
    console.error("Failed to delete intake photo files", error.message);
  }
}
