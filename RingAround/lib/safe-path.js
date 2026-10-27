const PLACEHOLDER_ORIGIN = "https://placeholder.invalid";

// Where to send someone after sign-in: a path on this site, or the default.
// /requests itself moves people with no requests yet on to /requests/new.
// The value is resolved with the URL parser and the path it rebuilds is
// returned, never the raw input. Checking the raw string isn't enough:
// browsers drop tabs and newlines, so "/\t/evil.com" would become
// "//evil.com". Anything that resolves off-site falls back.
export function safeNextPath(value, fallback = "/requests") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  let url;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  const path = url.pathname + url.search + url.hash;
  // The rebuilt path can still start with "//" (from "/.//evil.com", say),
  // which a browser would treat as another host.
  return path.startsWith("//") ? fallback : path;
}
