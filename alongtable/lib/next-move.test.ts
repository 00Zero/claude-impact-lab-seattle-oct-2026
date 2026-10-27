import assert from "node:assert/strict";
import { test } from "node:test";
import { nextMove, prefill } from "@/lib/next-move";
import type { Space } from "@/lib/spaces";
import { seattleToUtc } from "@/lib/time";

// Sunday, Oct 25 2026, noon in Seattle.
const NOW = seattleToUtc("2026-10-25", "12:00");

function space(date: string, opts: { taken?: number; eventCapacity?: number; label?: string; start?: string; capacity?: number; priceInfo?: string | null } = {}): Space {
  const { taken, label = "Main dining", start = "18:00", capacity = 10, priceInfo = "$25 minimum spend per person" } = opts;
  const booked = taken !== undefined;
  return {
    id: `${date}-${label}`,
    restaurantName: "Test",
    location: "Fremont, Seattle, WA",
    label,
    startsAt: seattleToUtc(date, start).toISOString(),
    endsAt: seattleToUtc(date, "21:00").toISOString(),
    capacity,
    description: null,
    priceInfo,
    status: booked ? "booked" : "available",
    event: booked
      ? { id: `e-${date}`, title: "Supper", organizerName: "Host", seatsTaken: taken, capacity: opts.eventCapacity ?? capacity }
      : null,
  };
}

test("1. no spaces: publish your first space", () => {
  const m = nextMove([], NOW, false);
  assert.equal(m?.title, "Publish your first space");
  assert.equal(m?.action?.href, "/restaurant/new");
  assert.equal(m?.tone, "info");
});

test("2. an upcoming event at 75% or more but not full: filling up, copy it a week later", () => {
  const m = nextMove([space("2026-10-27"), space("2026-10-29", { taken: 8 })], NOW, true);
  assert.equal(m?.title, "Thursday's event is filling up");
  assert.equal(m?.body, "8 of 10 seats are taken. Add the same night next week?");
  assert.equal(m?.tone, "filling");
  assert.equal(m?.action?.label, "Add Thursday, Nov 5");
  const q = new URL(m!.action!.href, "http://x").searchParams;
  assert.equal(q.get("date"), "2026-11-05");
  assert.equal(q.get("slot"), "dinner");
});

test("2b. a full event is not filling up", () => {
  const m = nextMove([space("2026-10-29", { taken: 10 })], NOW, true);
  assert.equal(m?.title, "Add your next date");
});

test("3. every upcoming space booked: add your next date, copying the last space", () => {
  const m = nextMove([space("2026-10-20", { taken: 3 }), space("2026-10-27", { taken: 2 })], NOW, true);
  assert.equal(m?.title, "Add your next date");
  assert.equal(m?.action?.label, "Add Tuesday, Nov 3");
  const q = new URL(m!.action!.href, "http://x").searchParams;
  assert.deepEqual(Object.fromEntries(q), { area: "Main dining", slot: "dinner", capacity: "10", price: "25", date: "2026-11-03" });
});

test("3b. nothing upcoming: next same weekday the form offers", () => {
  const m = nextMove([space("2026-09-01", { taken: 4 })], NOW, false);
  assert.equal(m?.title, "Add your next date");
  assert.equal(m?.action?.label, "Add Tuesday, Oct 27");
});

test("4. upcoming open spaces and no photo: add a photo", () => {
  const m = nextMove([space("2026-10-27")], NOW, false);
  assert.equal(m?.title, "Add a photo");
  assert.equal(m?.action?.href, "#restaurant-photo");
});

test("5. upcoming open spaces and a photo: no card", () => {
  assert.equal(nextMove([space("2026-10-27"), space("2026-10-29", { taken: 2 })], NOW, true), null);
});

test("prefill drops values the publish form wouldn't accept", () => {
  const q = new URL(prefill(space("2026-10-27", { label: "Long Table", start: "18:30", capacity: 16, priceInfo: "$45 tasting menu" }), NOW).href, "http://x")
    .searchParams;
  assert.deepEqual(Object.fromEntries(q), { date: "2026-11-03" });
});

test("prefill: no price maps to 'No minimum'", () => {
  const q = new URL(prefill(space("2026-10-27", { priceInfo: null }), NOW).href, "http://x").searchParams;
  assert.equal(q.get("price"), "none");
});

test("prefill: a week later past the form's 14 days falls back to the next same weekday", () => {
  // Nov 6 (Fri) + 7 = Nov 13, beyond Nov 7 (last of 14 days from Oct 25).
  const p = prefill(space("2026-11-06"), NOW);
  assert.equal(p.date, "2026-10-30");
});
