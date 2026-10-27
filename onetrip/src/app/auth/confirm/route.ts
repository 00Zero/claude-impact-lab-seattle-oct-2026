import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the link in Supabase confirmation emails. Supports both the PKCE
// `code` redirect and the `token_hash` email template format.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  let failed = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    failed = Boolean(error);
  }

  const url = request.nextUrl.clone();
  url.search = "";
  if (failed && next === "/reset-password") {
    url.pathname = "/forgot-password";
    url.searchParams.set("error", "expired");
  } else if (failed) {
    url.pathname = "/login";
    url.searchParams.set("error", "confirmation");
  } else {
    url.pathname = next;
  }
  return NextResponse.redirect(url);
}

function safeNextPath(next: string | null) {
  // Only allow same-site relative paths to avoid open redirects.
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
}
