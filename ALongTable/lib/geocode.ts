import "server-only";

// Free geocoding with OpenStreetMap Nominatim, used to put manually registered
// restaurants on the /events map. Usage policy: identify the app, at most one
// request per second, no bulk jobs. Sign-ups are rare, so one lookup each is fine.
// https://operations.osmfoundation.org/policies/nominatim/

export type LatLng = { lat: number; lng: number };

const USER_AGENT = "ALongTable hackathon (https://github.com/amarjahin/alongtable)";

// Rough box around the Seattle area, so a vague location can't land in another state.
const SEATTLE_AREA = { minLat: 47.3, maxLat: 47.9, minLng: -122.6, maxLng: -121.9 };

export function isValidLatLng(v: unknown): v is LatLng {
  const p = v as LatLng;
  return (
    !!p && typeof p.lat === "number" && typeof p.lng === "number" &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
  );
}

async function search(q: string): Promise<LatLng | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "1",
    countrycodes: "us",
    viewbox: `${SEATTLE_AREA.minLng},${SEATTLE_AREA.maxLat},${SEATTLE_AREA.maxLng},${SEATTLE_AREA.minLat}`,
    bounded: "1",
  }).toString();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  const point = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  return isValidLatLng(point) ? point : null;
}

/**
 * Best-effort pin for a restaurant: try "name, location" (finds the venue when OSM knows it),
 * then the location alone (neighborhood centre). Never throws.
 */
export async function geocodeRestaurant(name: string, location: string): Promise<LatLng | null> {
  try {
    const exact = await search(`${name}, ${location}`);
    if (exact) return exact;
    await new Promise((r) => setTimeout(r, 1100)); // stay under 1 request/second
    return await search(location);
  } catch {
    return null;
  }
}
