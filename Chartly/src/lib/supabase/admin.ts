import "server-only";
import { createClient } from "@supabase/supabase-js";

// Bypasses RLS and storage policies. Use it only after the caller has been
// authorized some other way (for intake, by a database function that checks
// the link token), and only for the specific objects that check covered.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY must be set. Copy a secret key from Supabase dashboard → Project Settings → API Keys.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
