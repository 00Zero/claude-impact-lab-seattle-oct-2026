import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Photo uploads (/i/<token>/photos) skip the proxy: customers aren't signed
// in, and the proxy would buffer and cap the request body.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|i/[^/]+/photos$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
