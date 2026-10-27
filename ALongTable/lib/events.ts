import "server-only";
import { connection } from "next/server";
import { supabase } from "@/lib/supabase";
import { isUuid } from "@/lib/spaces";

// Data layer for the Regular User UI: creating events, discovering them, and
// reserving seats. Server actions validate form input first (non-empty fields,
// email format), then call these functions. Booking rules that need a lock
// live in the database functions in supabase/schema.sql.

export type Event = {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  capacity: number; // spots the organizer offered
  seatsLeft: number; // 0 means sold out
  organizerName: string;
  restaurantName: string;
  location: string;
  /** The event's own photo, if its organizer or the restaurant added one. */
  photoUrl?: string | null;
  /** The restaurant's photo: the fallback when the event has none. */
  restaurantPhotoUrl?: string | null;
  /** The restaurant's map pin; null when it has none (or before add-coordinates.sql). */
  lat: number | null;
  lng: number | null;
  label: string;
  startsAt: string; // ISO, UTC
  endsAt: string; // ISO, UTC
  priceInfo: string | null;
  createdAt: string;
};

export type Reservation = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  confirmationCode: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Booking errors. The database raises these codes (see data-model/README.md).
// ---------------------------------------------------------------------------

export type BookingErrorCode =
  | "SPACE_NOT_FOUND"
  | "SPACE_NOT_AVAILABLE"
  | "CAPACITY_INVALID"
  | "EVENT_NOT_FOUND"
  | "EVENT_FULL"
  | "ALREADY_RESERVED";

export const bookingErrorMessages: Record<BookingErrorCode, string> = {
  SPACE_NOT_FOUND: "This space no longer exists.",
  SPACE_NOT_AVAILABLE: "Someone just booked this space. Please pick another one.",
  CAPACITY_INVALID: "The number of spots must be between 1 and the space's capacity.",
  EVENT_NOT_FOUND: "This event no longer exists.",
  EVENT_FULL: "This event is full.",
  ALREADY_RESERVED: "You've already reserved a seat at this event with this email.",
};

/** Expected failures come back as values so pages can show the message; anything else throws. */
export type BookingResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: BookingErrorCode; message: string };

function bookingError<T>(message: string | undefined): BookingResult<T> | null {
  if (message && message in bookingErrorMessages) {
    const code = message as BookingErrorCode;
    return { ok: false, code, message: bookingErrorMessages[code] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Creating events
// ---------------------------------------------------------------------------

export type NewEvent = {
  spaceId: string;
  title: string;
  description: string | null;
  capacity: number;
  organizerName: string;
  organizerEmail: string;
};

/**
 * U2: claim the space and create its event in one transaction.
 * Fails with SPACE_NOT_FOUND, SPACE_NOT_AVAILABLE or CAPACITY_INVALID.
 */
export async function createEventForSpace(input: NewEvent): Promise<BookingResult<{ id: string }>> {
  if (!isUuid(input.spaceId)) return bookingError("SPACE_NOT_FOUND")!;

  const { data, error } = await supabase().rpc("create_event_for_space", {
    p_space_id: input.spaceId,
    p_title: input.title.trim(),
    p_description: input.description?.trim() || null,
    p_capacity: input.capacity,
    p_organizer_name: input.organizerName.trim(),
    p_organizer_email: input.organizerEmail,
  });
  if (error) {
    const known = bookingError<{ id: string }>(error.message);
    if (known) return known;
    throw new Error(`createEventForSpace: ${error.message}`);
  }

  return { ok: true, data: { id: (data as { id: string }).id } };
}

// ---------------------------------------------------------------------------
// Discovering events
// ---------------------------------------------------------------------------

type EventRow = {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  capacity: number;
  seats_left: number;
  organizer_name: string;
  restaurant_name: string;
  restaurant_location: string;
  /** Both absent until supabase/add-photos.sql has been run. */
  restaurant_photo_url?: string | null;
  event_photo_url?: string | null;
  /** Both absent until supabase/add-coordinates.sql has been run. */
  restaurant_lat?: number | null;
  restaurant_lng?: number | null;
  label: string;
  starts_at: string;
  ends_at: string;
  price_info: string | null;
  created_at: string;
};

function toEvent(r: EventRow): Event {
  return {
    id: r.id,
    spaceId: r.space_id,
    title: r.title,
    description: r.description,
    capacity: r.capacity,
    seatsLeft: Math.max(0, r.seats_left),
    organizerName: r.organizer_name,
    restaurantName: r.restaurant_name,
    location: r.restaurant_location,
    photoUrl: r.event_photo_url ?? null,
    restaurantPhotoUrl: r.restaurant_photo_url ?? null,
    lat: r.restaurant_lat ?? null,
    lng: r.restaurant_lng ?? null,
    label: r.label,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    priceInfo: r.price_info,
    createdAt: r.created_at,
  };
}

/**
 * U3 Discover (/events) and the landing page (pass `limit: 3`).
 * Upcoming events, soonest first. Sold-out events are included with seatsLeft 0.
 */
export async function listUpcomingEvents(opts: { limit?: number } = {}): Promise<Event[]> {
  // Reading the clock is request-time work under Cache Components; call this inside <Suspense>.
  await connection();
  let query = supabase()
    .from("events_with_availability")
    .select("*")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .order("title");
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query.returns<EventRow[]>();
  if (error) throw new Error(`listUpcomingEvents: ${error.message}`);

  return data.map(toEvent);
}

/** Event details (/events/[id]) and the event-created page. Past events are returned too. */
export async function getEvent(id: string): Promise<Event | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase()
    .from("events_with_availability")
    .select("*")
    .eq("id", id)
    .returns<EventRow[]>()
    .maybeSingle();
  if (error) throw new Error(`getEvent: ${error.message}`);

  return data ? toEvent(data) : null;
}

// ---------------------------------------------------------------------------
// Reserving seats
// ---------------------------------------------------------------------------

type ReservationRow = {
  id: string;
  event_id: string;
  name: string;
  email: string;
  confirmation_code: string;
  created_at: string;
};

function toReservation(r: ReservationRow): Reservation {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    email: r.email,
    confirmationCode: r.confirmation_code,
    createdAt: r.created_at,
  };
}

/**
 * U4: reserve one seat. Email is trimmed and lowercased by the database.
 * Fails with EVENT_NOT_FOUND, EVENT_FULL or ALREADY_RESERVED.
 */
export async function reserveSeat(input: {
  eventId: string;
  name: string;
  email: string;
}): Promise<BookingResult<Reservation>> {
  if (!isUuid(input.eventId)) return bookingError("EVENT_NOT_FOUND")!;

  const { data, error } = await supabase().rpc("reserve_seat", {
    p_event_id: input.eventId,
    p_name: input.name.trim(),
    p_email: input.email,
  });
  if (error) {
    const known = bookingError<Reservation>(error.message);
    if (known) return known;
    throw new Error(`reserveSeat: ${error.message}`);
  }

  return { ok: true, data: toReservation(data as ReservationRow) };
}

/** Booking confirmation (/reservations/[code]): the reservation and its event. */
export async function getReservation(
  code: string,
): Promise<{ reservation: Reservation; event: Event } | null> {
  const normalized = code.trim().toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(normalized)) return null;

  const { data, error } = await supabase()
    .from("reservations")
    .select("*")
    .eq("confirmation_code", normalized)
    .returns<ReservationRow[]>()
    .maybeSingle();
  if (error) throw new Error(`getReservation: ${error.message}`);
  if (!data) return null;

  const event = await getEvent(data.event_id);
  if (!event) return null;
  return { reservation: toReservation(data), event };
}

/** Save an event's own photo URL. Fails until supabase/add-photos.sql has been run. */
export async function setEventPhoto(id: string, photoUrl: string): Promise<void> {
  const { error } = await supabase().from("events").update({ photo_url: photoUrl }).eq("id", id);
  if (error) throw new Error(`setEventPhoto: ${error.message}`);
}

/**
 * Cancel an event: delete it (its reservations cascade) and put its space back on offer.
 * The space is reopened first, so a failure can never leave a space marked "booked" with no event.
 */
export async function cancelEvent(eventId: string, spaceId: string): Promise<void> {
  const reopen = await supabase().from("spaces").update({ status: "available" }).eq("id", spaceId);
  if (reopen.error) throw new Error(`cancelEvent: ${reopen.error.message}`);

  const removed = await supabase().from("events").delete().eq("id", eventId);
  if (removed.error) {
    await supabase().from("spaces").update({ status: "booked" }).eq("id", spaceId); // undo
    throw new Error(`cancelEvent: ${removed.error.message}`);
  }
}
