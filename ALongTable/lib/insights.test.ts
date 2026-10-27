import assert from "node:assert/strict";
import { test } from "node:test";
import { computeInsights, hasEnoughHistory, sampleInsights, type InsightsInput } from "@/lib/insights";
import type { Space } from "@/lib/spaces";
import { seattleToUtc } from "@/lib/time";

// Sunday, Oct 25 2026, noon in Seattle. This week starts Monday, Oct 19, so the
// chart's 8 completed weeks run from Aug 24 to Oct 12.
const NOW = seattleToUtc("2026-10-25", "12:00");
const DAY = 86_400_000;

function event(date: string, taken: number, capacity = 10): Space {
  return {
    id: `s-${date}`,
    restaurantName: "Test",
    location: "Fremont, Seattle, WA",
    label: "Main dining",
    startsAt: seattleToUtc(date, "18:00").toISOString(),
    endsAt: seattleToUtc(date, "21:00").toISOString(),
    capacity,
    description: null,
    priceInfo: "$25 minimum spend per person",
    status: "booked",
    event: { id: `e-${date}`, title: "Supper", organizerName: "Host", seatsTaken: taken, capacity },
  };
}

/** Reservations for a space: `taken` guests, each booking `leadDays` before it starts. */
function guests(s: Space, emails: string[], leadDays: number): InsightsInput["reservations"] {
  return emails.map((email) => ({ eventId: s.event!.id, email, createdAt: new Date(new Date(s.startsAt).getTime() - leadDays * DAY).toISOString() }));
}

test("sample numbers agree with each other", () => {
  const s = sampleInsights(NOW);
  assert.equal(s.weeks.reduce((n, w) => n + w.seatsBooked, 0), s.guests);
  assert.equal(s.weeks.reduce((n, w) => n + w.seatsOffered, 0), s.seatsOffered);
  assert.equal(Math.round(s.fillRate * 100), 49);
  assert.equal(s.sales, 3555);
  assert.equal(s.weeks[0].weekStart, "2026-08-24");
  assert.equal(s.forecast[0].weekStart, "2026-10-19");
  assert.deepEqual(s.filling && [s.filling.weekday, s.filling.date, s.filling.daysOut], ["Thursday", "Oct 29", 4]);
});

test("few events: not enough history for real mode", () => {
  const spaces = [event("2026-10-20", 5), event("2026-10-13", 6)];
  const i = computeInsights({ spaces, reservations: [] }, NOW);
  assert.equal(i.events, 2);
  assert.equal(hasEnoughHistory(i), false);
});

test("eight weeks of Tuesdays and Thursdays: real numbers", () => {
  const tue = ["2026-08-25", "2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"];
  const spaces: Space[] = [];
  const reservations: InsightsInput["reservations"] = [];
  tue.forEach((d, w) => {
    const t = event(d, 9);
    const thu = event(new Date(Date.parse(`${d}T12:00:00Z`) + 2 * DAY).toISOString().slice(0, 10), 4);
    spaces.push(t, thu);
    reservations.push(...guests(t, [...Array(9)].map((_, k) => (k === 0 ? "regular@example.com" : `t${w}-${k}@example.com`)), 6));
    reservations.push(...guests(thu, [...Array(4)].map((_, k) => `h${w}-${k}@example.com`), 1));
  });
  spaces.push(event("2026-10-29", 8)); // upcoming, filling up (80%)
  spaces.push(event("2026-08-18", 10)); // older than 8 weeks: counted in totals, not in the chart
  spaces.push(event("2026-10-20", 3)); // this week, already past: counted in totals, not in the chart

  const i = computeInsights({ spaces, reservations }, NOW);
  assert.equal(i.events, 18);
  assert.equal(i.guests, 8 * 13 + 10 + 3);
  assert.equal(i.seatsOffered, 180);
  assert.equal(i.sales, i.guests * 25);
  assert.equal(hasEnoughHistory(i), true);
  assert.deepEqual(i.weeks.map((w) => w.seatsBooked), [13, 13, 13, 13, 13, 13, 13, 13]);
  assert.equal(i.weeks.at(-1)!.weekStart, "2026-10-12");
  assert.equal(i.forecast[0].weekStart, "2026-10-19");
  assert.deepEqual(i.forecast.map((f) => [f.expected, f.low, f.high]), Array(4).fill([13, 13, 13]));
  assert.equal(i.bestWeekday?.name, "Tuesday");
  assert.equal(i.lateWeekday, "Thursday");
  assert.equal(i.repeatGuests, 1);
  assert.deepEqual(i.filling && [i.filling.weekday, i.filling.daysOut, i.filling.taken], ["Thursday", 4, 8]);
});
