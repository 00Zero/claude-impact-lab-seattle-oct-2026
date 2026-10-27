// Saved addresses are stored on the server (lib/db.js). Older ones were kept
// in this browser per signed-in user; these read and clear that copy so it can
// be moved to the server once.
const LOCATIONS_KEY = "ringaround:locations:v1";

const storageKey = (userId) => (userId ? `${LOCATIONS_KEY}:${encodeURIComponent(userId)}` : LOCATIONS_KEY);

export function readLocations(userId) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (l) => l && typeof l.id === "string" && typeof l.label === "string" && typeof l.address === "string",
    );
  } catch {
    return [];
  }
}

export function clearBrowserLocations(userId) {
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Storage blocked: nothing was stored here either.
  }
}
