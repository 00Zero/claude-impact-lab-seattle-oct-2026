import { fillingSpace } from "@/lib/next-move";
import type { Space } from "@/lib/spaces";
import { pricePerGuest } from "@/lib/stats";
import { seattleDateKey } from "@/lib/time";

// Insights preview (/restaurant/insights). Everything here is plain arithmetic on
// the restaurant's own past spaces and reservations: no AI, no causes claimed.
// Until there's enough history the page shows sampleInsights() instead, clearly
// labelled, and never mixes the two.

export type InsightsInput = {
  spaces: Space[]; // listSpaces(restaurantId)
  reservations: { eventId: string; email: string; createdAt: string }[];
};

export type WeekPoint = { weekStart: string; seatsBooked: number; seatsOffered: number };
export type ForecastPoint = { weekStart: string; expected: number; low: number; high: number };

export type Insights = {
  /** Past spaces with an event. */
  events: number;
  guests: number;
  seatsOffered: number;
  /** guests / seatsOffered, 0–1. */
  fillRate: number;
  /** Estimated: guests × price per guest from each space's price_info. */
  sales: number;
  /** Emails with reservations at 2 or more distinct events. */
  repeatGuests: number;
  distinctGuests: number;
  /** The last 8 completed Seattle weeks (Monday start), oldest first. */
  weeks: WeekPoint[];
  /** The current week and the 3 after it. */
  forecast: ForecastPoint[];
  bestWeekday: { name: string; fillRate: number; events: number } | null;
  lateWeekday: string | null;
  filling: { weekday: string; date: string; daysOut: number; taken: number; capacity: number } | null;
  /** Distinct weeks with a past event; real mode needs 4. */
  activeWeeks: number;
};

/** Real numbers once there are 8 past events across at least 4 weeks; otherwise the sample. */
export const hasEnoughHistory = (i: Insights) => i.events >= 8 && i.activeWeeks >= 4;

export async function getInsightsInput(restaurantId: string): Promise<InsightsInput> {
  // Imported here so computeInsights stays importable from plain Node tests.
  const [{ listSpaces }, { supabase }] = await Promise.all([import("@/lib/spaces"), import("@/lib/supabase")]);
  const spaces = await listSpaces(restaurantId);
  const eventIds = spaces.flatMap((s) => (s.event ? [s.event.id] : []));
  if (eventIds.length === 0) return { spaces, reservations: [] };
  const { data, error } = await supabase()
    .from("reservations")
    .select("event_id, email, created_at")
    .in("event_id", eventIds)
    .returns<{ event_id: string; email: string; created_at: string }[]>();
  if (error) throw new Error(`getInsightsInput: ${error.message}`);
  return { spaces, reservations: data.map((r) => ({ eventId: r.event_id, email: r.email, createdAt: r.created_at })) };
}

// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const keyToDate = (key: string) => new Date(`${key}T12:00:00Z`);
const addDays = (key: string, n: number) => new Date(keyToDate(key).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (iso: string) => WEEKDAYS[keyToDate(seattleDateKey(new Date(iso))).getUTCDay()];

/** Monday of the Seattle week containing `d`, as "YYYY-MM-DD". */
function weekStartOf(d: Date): string {
  const key = seattleDateKey(d);
  return addDays(key, -((keyToDate(key).getUTCDay() + 6) % 7));
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function computeInsights({ spaces, reservations }: InsightsInput, now: Date): Insights {
  const past = spaces.filter((s) => s.event && new Date(s.startsAt) <= now);
  const pastIds = new Set(past.map((s) => s.event!.id));
  const pastReservations = reservations.filter((r) => pastIds.has(r.eventId));

  const guests = past.reduce((n, s) => n + s.event!.seatsTaken, 0);
  const seatsOffered = past.reduce((n, s) => n + s.event!.capacity, 0);
  const sales = past.reduce((n, s) => n + s.event!.seatsTaken * pricePerGuest(s.priceInfo), 0);

  const eventsByEmail = new Map<string, Set<string>>();
  for (const r of pastReservations) {
    const email = r.email.trim().toLowerCase();
    if (!eventsByEmail.has(email)) eventsByEmail.set(email, new Set());
    eventsByEmail.get(email)!.add(r.eventId);
  }
  const repeatGuests = [...eventsByEmail.values()].filter((e) => e.size >= 2).length;

  // The 8 completed weeks before this one, then 4 forecast weeks starting with this one.
  // A half-finished week would read as a slump, so it's forecast, not history.
  const thisWeek = weekStartOf(now);
  const weeks: WeekPoint[] = Array.from({ length: 8 }, (_, i) => ({ weekStart: addDays(thisWeek, (i - 8) * 7), seatsBooked: 0, seatsOffered: 0 }));
  for (const s of past) {
    const w = weeks.find((x) => x.weekStart === weekStartOf(new Date(s.startsAt)));
    if (!w) continue;
    w.seatsBooked += s.event!.seatsTaken;
    w.seatsOffered += s.event!.capacity;
  }
  const recent = weeks.slice(-4).map((w) => w.seatsBooked);
  const expected = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const forecast: ForecastPoint[] = Array.from({ length: 4 }, (_, i) => ({
    weekStart: addDays(thisWeek, i * 7),
    expected,
    low: Math.min(...recent),
    high: Math.max(...recent),
  }));

  // Weekday patterns, from past events only.
  const byWeekday = new Map<string, { events: number; taken: number; offered: number; leads: number[] }>();
  const spaceByEvent = new Map(past.map((s) => [s.event!.id, s]));
  for (const s of past) {
    const d = byWeekday.get(weekdayOf(s.startsAt)) ?? { events: 0, taken: 0, offered: 0, leads: [] };
    d.events += 1;
    d.taken += s.event!.seatsTaken;
    d.offered += s.event!.capacity;
    byWeekday.set(weekdayOf(s.startsAt), d);
  }
  for (const r of pastReservations) {
    const s = spaceByEvent.get(r.eventId)!;
    byWeekday.get(weekdayOf(s.startsAt))!.leads.push((new Date(s.startsAt).getTime() - new Date(r.createdAt).getTime()) / DAY_MS);
  }
  const days = [...byWeekday.entries()];
  const best = days
    .filter(([, d]) => d.events >= 2 && d.offered > 0)
    .map(([name, d]) => ({ name, fillRate: d.taken / d.offered, events: d.events }))
    .sort((a, b) => b.fillRate - a.fillRate)[0];
  const late = days
    .filter(([, d]) => d.leads.length > 0 && median(d.leads) <= 3)
    .sort(([, a], [, b]) => median(a.leads) - median(b.leads))[0];

  const f = fillingSpace(spaces, now);
  const filling = f?.event
    ? {
        weekday: weekdayOf(f.startsAt),
        date: new Date(f.startsAt).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }),
        daysOut: Math.round((keyToDate(seattleDateKey(new Date(f.startsAt))).getTime() - keyToDate(seattleDateKey(now)).getTime()) / DAY_MS),
        taken: f.event.seatsTaken,
        capacity: f.event.capacity,
      }
    : null;

  return {
    events: past.length,
    guests,
    seatsOffered,
    fillRate: seatsOffered ? guests / seatsOffered : 0,
    sales,
    repeatGuests,
    distinctGuests: eventsByEmail.size,
    weeks,
    forecast,
    bestWeekday: best ?? null,
    lateWeekday: late?.[0] ?? null,
    filling,
    activeWeeks: new Set(past.map((s) => weekStartOf(new Date(s.startsAt)))).size,
  };
}

// ---------------------------------------------------------------------------
// The labelled sample (sample mode only). The numbers agree with each other:
// 16 events (a Tuesday and a Thursday each week, 10 seats each), 79 guests of
// 160 seats (49%), 79 × $45 = $3,555. Tuesdays: 2, 3, 4, 5, 9, 9, 9, 9 (50 of 80,
// last four at least 90% full); Thursdays: 5, 5, 5, 5, 2, 1, 3, 3 (29 of 80).
// Weekly totals 7, 8, 9, 10, 11, 10, 12, 12. Dates are relative to today so the
// sample never looks stale.
// ---------------------------------------------------------------------------

export const SAMPLE_NEXT_MOVE = {
  title: "Open Tuesday with 12 seats",
  body: "Your last four Tuesdays were at least 90% full.",
  action: { label: "Available with real data" },
  tone: "info" as const,
};

export function sampleInsights(now: Date): Insights {
  const thisWeek = weekStartOf(now);
  const booked = [7, 8, 9, 10, 11, 10, 12, 12];
  const high = [15, 15, 17, 17];
  const today = seattleDateKey(now);
  const toThursday = ((4 - keyToDate(today).getUTCDay() + 7) % 7) || 7;
  const thursday = addDays(today, toThursday);
  return {
    events: 16,
    guests: 79,
    seatsOffered: 160,
    fillRate: 79 / 160,
    sales: 79 * 45,
    repeatGuests: 22,
    distinctGuests: 79,
    weeks: booked.map((seatsBooked, i) => ({ weekStart: addDays(thisWeek, (i - 8) * 7), seatsBooked, seatsOffered: 20 })),
    forecast: [13, 13, 14, 14].map((expected, i) => ({ weekStart: addDays(thisWeek, i * 7), expected, low: 11, high: high[i] })),
    bestWeekday: { name: "Tuesday", fillRate: 50 / 80, events: 8 },
    lateWeekday: "Thursday",
    filling: {
      weekday: "Thursday",
      date: keyToDate(thursday).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
      daysOut: toThursday,
      taken: 5,
      capacity: 10,
    },
    activeWeeks: 8,
  };
}
