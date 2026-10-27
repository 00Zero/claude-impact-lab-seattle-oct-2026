// The account application made at checkout is stored on the server
// (lib/db.js); payment details are never stored or sent anywhere. Older
// applications were kept in the browser under ACCOUNT_KEY: readAccount and
// clearBrowserAccount let that copy be moved to the server once. The draft and
// pending-request flags below stay in the browser: they're about this device.
export const ACCOUNT_KEY = "ringaround:account:v1";
export const REQUEST_DRAFT_KEY = "ringaround:request-draft:v1";
export const PENDING_REQUEST_KEY = "ringaround:pending-request";

export function readAccount() {
  try {
    const account = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) ?? "null");
    return account && typeof account.email === "string" && typeof account.plan === "string" ? account : null;
  } catch {
    return null;
  }
}

export function clearBrowserAccount() {
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Storage blocked: nothing was stored here either.
  }
}

export function hasRequestDraft() {
  try {
    if (window.sessionStorage.getItem(PENDING_REQUEST_KEY)) return true;
    // Drafts are stored per signed-in user under REQUEST_DRAFT_KEY:<user id>.
    return Object.keys(window.localStorage).some((key) => key.startsWith(REQUEST_DRAFT_KEY));
  } catch {
    return false;
  }
}

export function formatSubmittedDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
