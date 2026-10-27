import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client using the service role key. It bypasses RLS, so never
// import this from a Client Component. See supabase/schema.sql for the access model.

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill them in.");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
