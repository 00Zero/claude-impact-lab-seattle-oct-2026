import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 100;

// Deletes storage objects queued in public.storage_deletions (for example
// by delete_service_request) and clears the entries that succeeded. Entries
// that fail stay queued, so every call also retries earlier failures.
// Returns how many objects are still queued.
export async function processStorageDeletions(): Promise<number> {
  const admin = createAdminClient();
  const { data: queued, error } = await admin
    .from("storage_deletions")
    .select("id, bucket_id, object_path")
    .order("id")
    .limit(BATCH_SIZE)
    .overrideTypes<
      { id: number; bucket_id: string; object_path: string }[],
      { merge: false }
    >();
  if (error) {
    console.error("Failed to read queued storage deletions", error.message);
    return -1;
  }

  const byBucket = Map.groupBy(queued, (row) => row.bucket_id);
  const done: number[] = [];
  for (const [bucket, rows] of byBucket) {
    // Removing a missing object isn't an error, so retries are safe.
    const { error: removeError } = await admin.storage
      .from(bucket)
      .remove(rows.map((row) => row.object_path));
    if (removeError) {
      console.error(`Failed to delete files from ${bucket}`, removeError.message);
    } else {
      done.push(...rows.map((row) => row.id));
    }
  }

  if (done.length > 0) {
    await admin.from("storage_deletions").delete().in("id", done);
  }
  return queued.length - done.length;
}
