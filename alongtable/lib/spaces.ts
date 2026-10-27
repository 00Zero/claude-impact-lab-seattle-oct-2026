import "server-only";
import { parseHouseRules, serializeHouseRules } from "@/lib/house-rules";
import { supabase } from "@/lib/supabase";

export type Space = {
  id: string;
  restaurantName: string;
  location: string;
  /** The restaurant's photo; missing or null until it uploads one. */
  photoUrl?: string | null;
  label: string;
  startsAt: string; // ISO, UTC
  endsAt: string; // ISO, UTC
  capacity: number;
  description: string | null;
  priceInfo: string | null;
  /** The restaurant's map pin; null when it has none (or before add-coordinates.sql). */
  lat?: number | null;
  lng?: number | null;
  status: "available" | "booked";
  event: {
    id: string;
    /** The event's own photo, if it has one. */
    photoUrl?: string | null;
    title: string;
    organizerName: string;
    seatsTaken: number;
    capacity: number;
  } | null;
};

export type NewSpace = Omit<Space, "id" | "status" | "event" | "photoUrl">;

type SpaceWithBookingRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_location: string;
  /** Absent until supabase/add-photos.sql has been run. */
  restaurant_photo_url?: string | null;
  event_photo_url?: string | null;
  label: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  description: string | null;
  price_info: string | null;
  status: "available" | "booked";
  event_id: string | null;
  event_title: string | null;
  organizer_name: string | null;
  event_capacity: number | null;
  seats_taken: number | null;
};

/** A space shown to organizers: available and in the future. */
export type AvailableSpace = Omit<Space, "status" | "event">;

type AvailableSpaceRow = Pick<
  SpaceWithBookingRow,
  "id" | "restaurant_name" | "restaurant_location" | "restaurant_photo_url" | "label" | "starts_at" | "ends_at" | "capacity" | "description" | "price_info"
> & {
  /** Both absent until supabase/add-coordinates.sql has been run (and on spaces_with_booking). */
  restaurant_lat?: number | null;
  restaurant_lng?: number | null;
};

/**
 * Restaurant dashboard (/restaurant): every space, including past and booked ones.
 * Pass `restaurantId` to see only one restaurant's spaces.
 */
export async function listSpaces(restaurantId?: string): Promise<Space[]> {
  let query = supabase().from("spaces_with_booking").select("*");
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { data, error } = await query
    .order("starts_at")
    .order("label")
    .returns<SpaceWithBookingRow[]>();
  if (error) throw new Error(`listSpaces: ${error.message}`);

  return data.map(toSpace);
}

/** Browse spaces (/spaces): only available spaces that haven't started, soonest first. */
export async function listAvailableSpaces(): Promise<AvailableSpace[]> {
  const { data, error } = await supabase()
    .from("available_spaces")
    .select("*")
    .order("starts_at")
    .order("label")
    .returns<AvailableSpaceRow[]>();
  if (error) throw new Error(`listAvailableSpaces: ${error.message}`);

  return data.map(toAvailableSpace);
}

/**
 * Space details (/spaces/[id]). Returns booked and past spaces too, so the page
 * can say "already booked" instead of 404. Check `status` before offering to book.
 */
export async function getSpace(id: string): Promise<Space | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase()
    .from("spaces_with_booking")
    .select("*")
    .eq("id", id)
    .returns<SpaceWithBookingRow[]>()
    .maybeSingle();
  if (error) throw new Error(`getSpace: ${error.message}`);

  return data ? toSpace(data) : null;
}

function toAvailableSpace(r: AvailableSpaceRow): AvailableSpace {
  return {
    id: r.id,
    restaurantName: r.restaurant_name,
    location: r.restaurant_location,
    photoUrl: r.restaurant_photo_url ?? null,
    label: r.label,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    capacity: r.capacity,
    description: r.description,
    priceInfo: r.price_info,
    lat: r.restaurant_lat ?? null,
    lng: r.restaurant_lng ?? null,
  };
}

function toSpace(r: SpaceWithBookingRow): Space {
  return {
    ...toAvailableSpace(r),
    status: r.status,
    event: r.event_id
      ? {
          id: r.event_id,
          photoUrl: r.event_photo_url ?? null,
          title: r.event_title!,
          organizerName: r.organizer_name!,
          seatsTaken: r.seats_taken ?? 0,
          capacity: r.event_capacity!,
        }
      : null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params come from the URL; a non-UUID would make Postgres error instead of returning nothing. */
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export async function createSpace(input: NewSpace): Promise<Space> {
  const restaurantId = await findOrCreateRestaurant(input.restaurantName, input.location);

  const { data, error } = await supabase()
    .from("spaces")
    .insert({
      restaurant_id: restaurantId,
      label: input.label,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      capacity: input.capacity,
      description: input.description,
      price_info: input.priceInfo,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createSpace: ${error.message}`);

  return { ...input, id: data.id, photoUrl: null, status: "available", event: null };
}

// The data model matches restaurants on lower(trim(name)) and lower(trim(location)).
async function findOrCreateRestaurant(name: string, location: string): Promise<string> {
  name = name.trim();
  location = location.trim();

  const existing = await findRestaurant(name, location);
  if (existing) return existing;

  const { data, error } = await supabase()
    .from("restaurants")
    .insert({ name, location })
    .select("id")
    .single();
  if (!error) return data.id;

  // Another request created it between our lookup and insert.
  if (error.code === "23505") {
    const raced = await findRestaurant(name, location);
    if (raced) return raced;
  }
  throw new Error(`findOrCreateRestaurant: ${error.message}`);
}

async function findRestaurant(name: string, location: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from("restaurants")
    .select("id, name, location")
    .ilike("name", escapeLike(name))
    .ilike("location", escapeLike(location));
  if (error) throw new Error(`findRestaurant: ${error.message}`);

  const key = (s: string) => s.trim().toLowerCase();
  const match = data.find((r) => key(r.name) === key(name) && key(r.location) === key(location));
  return match?.id ?? null;
}

// ilike without wildcards is a case-insensitive equality check.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Restaurant sign-up. V0 has no auth: a restaurant is identified by its name and
// location (the data model's uniqueness key), so registering twice with the same
// details simply signs the restaurant back in.
// ---------------------------------------------------------------------------

export type Restaurant = { id: string; name: string; location: string; photoUrl: string | null; houseRules: string[] };

type RestaurantRow = {
  id: string;
  name: string;
  location: string;
  photo_url?: string | null;
  lat?: number | null; // absent until supabase/add-coordinates.sql has run
  lng?: number | null;
  house_rules?: string | null; // absent until supabase/add-house-rules.sql has run
};

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  if (!isUuid(id)) return null;
  // select("*") rather than naming photo_url: the app keeps working before add-photos.sql has run.
  const { data, error } = await supabase()
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .returns<RestaurantRow[]>()
    .maybeSingle();
  if (error) throw new Error(`getRestaurant: ${error.message}`);
  return data
    ? { id: data.id, name: data.name, location: data.location, photoUrl: data.photo_url ?? null, houseRules: parseHouseRules(data.house_rules) }
    : null;
}

/** House rules of the restaurant that owns a space, for the space and event pages. */
export async function getHouseRulesForSpace(spaceId: string): Promise<string[]> {
  if (!isUuid(spaceId)) return [];
  const { data, error } = await supabase().from("spaces").select("restaurant_id").eq("id", spaceId).maybeSingle();
  if (error || !data) return [];
  return (await getRestaurant(data.restaurant_id))?.houseRules ?? [];
}

/** Save the restaurant's house rules (one per line). Fails until supabase/add-house-rules.sql has been run. */
export async function setHouseRules(id: string, rules: string[]): Promise<void> {
  const { error } = await supabase().from("restaurants").update({ house_rules: serializeHouseRules(rules) }).eq("id", id);
  if (error) throw new Error(`setHouseRules: ${error.message}`);
}

/** Save the restaurant's photo URL. Fails until supabase/add-photos.sql has been run. */
export async function setRestaurantPhoto(id: string, photoUrl: string): Promise<void> {
  const { error } = await supabase().from("restaurants").update({ photo_url: photoUrl }).eq("id", id);
  if (error) throw new Error(`setRestaurantPhoto: ${error.message}`);
}

/**
 * Set the restaurant's map pin. With `onlyIfMissing`, an existing pin is kept (used for
 * geocoded guesses, which shouldn't overwrite a pin from a Google Maps link).
 * Fails until supabase/add-coordinates.sql has been run.
 */
export async function setRestaurantCoordinates(
  id: string,
  pin: { lat: number; lng: number },
  { onlyIfMissing = false } = {},
): Promise<void> {
  let query = supabase().from("restaurants").update({ lat: pin.lat, lng: pin.lng }).eq("id", id);
  if (onlyIfMissing) query = query.is("lat", null);
  const { error } = await query;
  if (error) throw new Error(`setRestaurantCoordinates: ${error.message}`);
}

/** True if the restaurant has no map pin yet (or the columns don't exist yet). */
export async function restaurantNeedsCoordinates(id: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .returns<RestaurantRow[]>()
    .maybeSingle();
  if (error || !data || !("lat" in data)) return false; // columns missing: nothing to do
  return data.lat == null;
}

/** Find the restaurant with this name and location, or create it. */
export async function registerRestaurant(name: string, location: string): Promise<Restaurant> {
  const id = await findOrCreateRestaurant(name, location);
  const restaurant = await getRestaurant(id);
  if (!restaurant) throw new Error("registerRestaurant: restaurant disappeared after creation");
  return restaurant;
}

/** Delete a space. The database cascades to its event and that event's reservations. */
export async function deleteSpace(id: string): Promise<void> {
  const { error } = await supabase().from("spaces").delete().eq("id", id);
  if (error) throw new Error(`deleteSpace: ${error.message}`);
}
