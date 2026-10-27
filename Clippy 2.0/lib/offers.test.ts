import { describe, expect, it } from "vitest";
import { buildPrompt, cleanOffers } from "./offers";
import type { LineItem } from "./types";

const item: LineItem = { id: "i1", name: "bread flour", searchQuery: "bread flour 50 lb bag", packSize: 50, unit: "lb", qtyPerOrder: 2 };
const urls = ["https://store.com/flour", "https://other.com/p/1"];
const now = new Date("2026-10-25T12:00:00Z");
const good = { store: "Store", title: "Bread Flour 50 lb", url: "https://store.com/flour", price: 32.5, packSize: 50, unit: "lb", shipping: null, confidence: "high" };

describe("cleanOffers", () => {
  it("adds itemId and checkedAt", () => {
    expect(cleanOffers({ offers: [good] }, item, urls, now)).toEqual([{ ...good, itemId: "i1", checkedAt: "2026-10-25T12:00:00.000Z" }]);
  });
  it("accepts a bare array", () => expect(cleanOffers([good], item, urls, now)).toHaveLength(1));
  it("drops unknown URLs", () => expect(cleanOffers([{ ...good, url: "https://fake.com/x" }], item, urls, now)).toEqual([]));
  it("matches URLs ignoring trailing slash and maps to the given URL", () => {
    expect(cleanOffers([{ ...good, url: "https://store.com/flour/" }], item, urls, now)[0].url).toBe("https://store.com/flour");
  });
  it("drops missing or non-positive prices", () => {
    expect(cleanOffers([{ ...good, price: 0 }, { ...good, price: null }, { ...good, price: "12" }], item, urls, now)).toEqual([]);
  });
  it("drops bad confidence and missing fields", () => {
    const { store: _s, ...noStore } = good;
    expect(cleanOffers([{ ...good, confidence: "sure" }, noStore], item, urls, now)).toEqual([]);
  });
  it("normalizes unit aliases and drops unknown units", () => {
    const r = cleanOffers([{ ...good, unit: "count", packSize: 1000 }, { ...good, unit: "bags" }], item, urls, now);
    expect(r).toHaveLength(1);
    expect(r[0].unit).toBe("each");
  });
  it("keeps shipping 0 and null, drops negative", () => {
    const r = cleanOffers([{ ...good, shipping: 0 }, { ...good, url: urls[1], shipping: -1 }], item, urls, now);
    expect(r).toHaveLength(1);
    expect(r[0].shipping).toBe(0);
  });
  it("dedupes identical offers", () => expect(cleanOffers([good, good], item, urls, now)).toHaveLength(1));
  it("returns [] for garbage", () => {
    expect(cleanOffers(null, item, urls, now)).toEqual([]);
    expect(cleanOffers({ offers: "x" }, item, urls, now)).toEqual([]);
  });
});

describe("buildPrompt", () => {
  const pages = [{ url: "https://store.com/flour", title: "Flour", text: "$32.50", publishedDate: "2026-09-01T00:00:00Z" }];
  it("gives today's date, the page date and the freshness rule", () => {
    const p = buildPrompt(item, pages, undefined, now);
    expect(p).toContain("Today is 2026-10-25.");
    expect(p).toContain("PAGE DATE: 2026-09-01");
    expect(p).toContain("more than 12 months before today");
    expect(p).not.toContain("The buyer is in");
  });
  it("adds the buyer's location when given", () => {
    const p = buildPrompt(item, pages, "Austin, TX", now);
    expect(p).toContain("The buyer is in Austin, TX.");
    expect(p).toContain("not available in Austin, TX");
  });
});
