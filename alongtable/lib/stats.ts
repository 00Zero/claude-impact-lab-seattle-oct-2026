import type { Space } from "@/lib/spaces";
import { seattleDateKey } from "@/lib/time";

/**
 * V0 has no payments: `price_info` is free text such as "$30 minimum spend per person".
 * Take the first dollar amount in it as the per-guest price. No amount means no revenue counted.
 */
export function pricePerGuest(priceInfo: string | null): number {
  const m = priceInfo?.match(/\$\s?(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

export type DayStats = {
  /** Spaces published that day, booked or not. */
  spaces: number;
  /** Events booked that day. */
  events: number;
  /** Seats on offer: a booked space counts its event's capacity, an open one its full capacity. */
  seats: number;
  /** Seats already reserved by guests. */
  guests: number;
};

/** Spaces, events, seats and reserved seats per Seattle calendar day (keyed "YYYY-MM-DD"). */
export function statsByDay(spaces: Space[]): Record<string, DayStats> {
  const out: Record<string, DayStats> = {};
  for (const s of spaces) {
    const key = seattleDateKey(new Date(s.startsAt));
    const day = (out[key] ??= { spaces: 0, events: 0, seats: 0, guests: 0 });
    day.spaces += 1;
    day.seats += s.event?.capacity ?? s.capacity;
    if (s.event) {
      day.events += 1;
      day.guests += s.event.seatsTaken;
    }
  }
  return out;
}

export function summarize(spaces: Space[]) {
  const booked = spaces.filter((s) => s.event);
  return {
    available: spaces.filter((s) => s.status === "available").length,
    events: booked.length,
    guests: booked.reduce((n, s) => n + (s.event?.seatsTaken ?? 0), 0),
    /** Estimated: guests booked × the price in each space's price_info. */
    revenue: booked.reduce((n, s) => n + (s.event?.seatsTaken ?? 0) * pricePerGuest(s.priceInfo), 0),
  };
}
