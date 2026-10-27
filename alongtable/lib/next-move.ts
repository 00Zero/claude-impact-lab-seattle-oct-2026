import type { Space } from "@/lib/spaces";
import { AREAS, CAPACITIES, PRICES, SLOTS } from "@/lib/space-options";
import { seattleDateKey, seattleHHMM } from "@/lib/time";

// "Your next move" on the owner dashboard: one suggestion, picked by plain rules
// from the restaurant's own spaces. Pure, so it can be unit-tested (next-move.test.ts).

export type NextMove = {
  title: string;
  body: string;
  action?: { label: string; href: string };
  tone: "info" | "filling";
};

/** Filling up = three quarters full or more, but not full (same rule as the dashboard chip). */
export function isFilling(s: Space): boolean {
  if (!s.event) return false;
  const { seatsTaken, capacity } = s.event;
  return seatsTaken / capacity >= 0.75 && seatsTaken < capacity;
}

/** The soonest upcoming space whose event is filling up. */
export function fillingSpace(spaces: Space[], now: Date): Space | null {
  return byStart(spaces.filter((s) => new Date(s.startsAt) > now && isFilling(s)))[0] ?? null;
}

export function nextMove(spaces: Space[], now: Date, hasPhoto: boolean): NextMove | null {
  if (spaces.length === 0) {
    return {
      title: "Publish your first space",
      body: "Pick a quiet night. It takes a minute.",
      action: { label: "Publish a space", href: "/restaurant/new" },
      tone: "info",
    };
  }

  const filling = fillingSpace(spaces, now);
  if (filling?.event) {
    const copy = prefill(filling, now);
    return {
      title: `${weekdayName(seattleDateKey(new Date(filling.startsAt)))}'s event is filling up`,
      body: `${filling.event.seatsTaken} of ${filling.event.capacity} seats are taken. Add the same night next week?`,
      action: { label: copy.label, href: copy.href },
      tone: "filling",
    };
  }

  const upcoming = spaces.filter((s) => new Date(s.startsAt) > now);
  if (upcoming.every((s) => s.event)) {
    const copy = prefill(byStart(spaces).at(-1)!, now);
    return {
      title: "Add your next date",
      body: "Hosts can only book what you publish. This copies your last space.",
      action: { label: copy.label, href: copy.href },
      tone: "info",
    };
  }

  if (!hasPhoto) {
    return {
      title: "Add a photo",
      body: "Your tables stand out when hosts can picture the room.",
      action: { label: "Add a photo", href: "#restaurant-photo" },
      tone: "info",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Prefill link: /restaurant/new with the tiles of `space` preselected, a week later.
// Any value the publish form wouldn't accept is left out, so that tile stays unselected.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const WINDOW = 14; // the publish form offers the next 14 days (upcomingDays(14))

const byStart = (spaces: Space[]) => [...spaces].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

/** Shift a "YYYY-MM-DD" key by whole days. */
function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const weekdayName = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });

const monthDay = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

/** A week after the space, or else the next same weekday the form offers (from tomorrow). */
function nextDate(spaceKey: string, now: Date): string {
  const today = seattleDateKey(now);
  const last = addDays(today, WINDOW - 1);
  const weekLater = addDays(spaceKey, 7);
  if (weekLater > today && weekLater <= last) return weekLater;
  const weekday = new Date(`${spaceKey}T12:00:00Z`).getUTCDay();
  for (let i = 1; i < WINDOW; i++) {
    const key = addDays(today, i);
    if (new Date(`${key}T12:00:00Z`).getUTCDay() === weekday) return key;
  }
  return weekLater; // unreachable: every weekday falls within 13 days
}

export function prefill(space: Space, now: Date): { href: string; label: string; date: string } {
  const date = nextDate(seattleDateKey(new Date(space.startsAt)), now);
  const params = new URLSearchParams();
  if ((AREAS as readonly string[]).includes(space.label)) params.set("area", space.label);
  const slot = SLOTS.find((s) => s.start === seattleHHMM(space.startsAt));
  if (slot) params.set("slot", slot.value);
  if ((CAPACITIES as readonly number[]).includes(space.capacity)) params.set("capacity", String(space.capacity));
  const price = PRICES.find((p) => p.info === space.priceInfo);
  if (price) params.set("price", price.value);
  params.set("date", date);
  return { href: `/restaurant/new?${params}`, label: `Add ${weekdayName(date)}, ${monthDay(date)}`, date };
}
