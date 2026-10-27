import "server-only";
import { geocodeRestaurant, type LatLng } from "@/lib/geocode";
import { restaurantNeedsCoordinates, setRestaurantCoordinates } from "@/lib/spaces";

/**
 * Put a restaurant on the /events map, only if it has no pin yet: use the pin from its Google Maps
 * link when there is one (it comes from the browser, so it never overwrites an existing pin),
 * otherwise geocode the name and location. Best-effort: failures (including before
 * supabase/add-coordinates.sql has run) are logged and ignored. Call it inside after().
 *
 * Deliberately not in a "use server" file: exports there become callable from the browser.
 */
export async function pinRestaurant(id: string, name: string, location: string, pin: LatLng | null): Promise<void> {
  try {
    if (!(await restaurantNeedsCoordinates(id))) return;
    const found = pin ?? (await geocodeRestaurant(name, location));
    if (found) await setRestaurantCoordinates(id, found, { onlyIfMissing: true });
  } catch (err) {
    console.warn("pinRestaurant skipped", err);
  }
}
