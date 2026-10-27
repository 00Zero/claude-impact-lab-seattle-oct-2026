import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

// The signed-in user's email, or null. Session refresh happens in proxy.ts, so cookies are only read here.
export async function currentUserEmail(): Promise<string | null> {
  if (!authEnabled) return null;
  const store = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => store.getAll() },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}
