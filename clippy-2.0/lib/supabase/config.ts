// Login is on only when both Supabase values are set, so the app still runs before they are added.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const authEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
