import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

// Keeps the Supabase session fresh and guards the tool: /app and the API need a signed-in user.
export async function proxy(request: NextRequest) {
  if (!authEnabled) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!data.user) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Please log in to use Clippy." }, { status: 401 });
    }
    if (path.startsWith("/app")) return NextResponse.redirect(new URL("/login", request.url));
  } else if (path === "/login") {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login", "/api/analyze", "/api/transcribe"],
};
