import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LineItem, Offer, ProgressEvent } from "./types";

vi.mock("./input", () => ({
  readInvoice: vi.fn(),
  parseList: vi.fn(),
  NotAnInvoiceError: class NotAnInvoiceError extends Error {},
}));
vi.mock("./offers", () => ({ findOffers: vi.fn() }));
vi.mock("./compare", () => ({
  analyzeItem: vi.fn((item: LineItem, offers: Offer[]) => ({
    item, best: null, offers, currentUnitCost: null, savingsPerOrder: null,
  })),
  buildResult: vi.fn((items, ordersPerMonth: number, suggestions: string[], notice?: string) => ({
    items, ordersPerMonth, suggestions, notice,
    totalSavingsPerOrder: 0, totalSavingsPerMonth: 0, totalSavingsPerYear: 0, generatedAt: "test",
  })),
}));
vi.mock("./suggest", () => ({ writeSuggestions: vi.fn() }));

import { analyzeItem } from "./compare";
import { parseList, readInvoice } from "./input";
import { findOffers } from "./offers";
import { LIMIT_NOTICE, runAnalysis, TIMEOUT_NOTICE } from "./pipeline";
import { writeSuggestions } from "./suggest";

const item = (n: number): LineItem => ({
  id: `i${n}`, name: `Item ${n}`, searchQuery: `item ${n}`, packSize: 1, unit: "each", qtyPerOrder: 1,
});
const offer = (itemId: string): Offer => ({
  itemId, store: "Shop", title: "Thing", url: "https://shop.example/x", price: 1, packSize: 1, unit: "each",
  shipping: 0, confidence: "high", checkedAt: "2026-10-25T00:00:00.000Z",
});

function collect() {
  const events: ProgressEvent[] = [];
  const messages = () => events.map((e) => (e.type === "progress" ? e.message : e.type));
  return { events, messages, emit: (e: ProgressEvent) => events.push(e) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findOffers).mockImplementation(async (it) => [offer(it.id)]);
  vi.mocked(writeSuggestions).mockResolvedValue(["Buy cups in bulk."]);
});

describe("runAnalysis", () => {
  it("emits progress events in order for an invoice", async () => {
    vi.mocked(readInvoice).mockResolvedValue([item(1), item(2)]);
    const { emit, messages } = collect();
    const result = await runAnalysis({ image: { base64: "AAAA", mediaType: "image/png" }, ordersPerMonth: 4 }, emit);

    expect(readInvoice).toHaveBeenCalledWith("AAAA", "image/png");
    expect(messages()).toEqual([
      "Reading your invoice…",
      "Found 2 items",
      "Searching Item 1…",
      "Searching Item 2…",
      "Comparing 2 offers…",
      "Writing suggestions…",
    ]);
    expect(result.suggestions).toEqual(["Buy cups in bulk."]);
    expect(result.notice).toBeUndefined();
    expect(writeSuggestions).toHaveBeenCalledWith(expect.any(Array), 4);
  });

  it("reads a typed list", async () => {
    vi.mocked(parseList).mockResolvedValue([item(1)]);
    const { emit, messages } = collect();
    await runAnalysis({ text: "50 lb flour", ordersPerMonth: 2 }, emit);
    expect(parseList).toHaveBeenCalledWith("50 lb flour");
    expect(messages()[0]).toBe("Reading your list…");
  });

  it("keeps only the first 6 items and says so", async () => {
    vi.mocked(parseList).mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8].map(item));
    const { emit, messages } = collect();
    const result = await runAnalysis({ text: "lots", ordersPerMonth: 4 }, emit);

    expect(findOffers).toHaveBeenCalledTimes(6);
    expect(result.items.map((r) => r.item.id)).toEqual(["i1", "i2", "i3", "i4", "i5", "i6"]);
    expect(result.notice).toBe(LIMIT_NOTICE);
    expect(messages()).not.toContain("Searching Item 7…");
  });

  it("gives a failing item no offers and keeps the rest", async () => {
    vi.mocked(parseList).mockResolvedValue([item(1), item(2), item(3)]);
    vi.mocked(findOffers).mockImplementation(async (it) => {
      if (it.id === "i2") throw new Error("search failed");
      return [offer(it.id)];
    });
    const { emit, messages } = collect();
    const result = await runAnalysis({ text: "three", ordersPerMonth: 4 }, emit);

    expect(result.items).toHaveLength(3);
    expect(vi.mocked(analyzeItem).mock.calls.map(([it, offers]) => [it.id, offers.length])).toEqual([
      ["i1", 1], ["i2", 0], ["i3", 1],
    ]);
    expect(messages()).toContain("Comparing 2 offers…");
    expect(result.notice).toBeUndefined();
  });

  it("stops waiting at the time limit and uses what is done", async () => {
    vi.mocked(parseList).mockResolvedValue([item(1), item(2)]);
    vi.mocked(findOffers).mockImplementation((it) =>
      it.id === "i2" ? new Promise(() => {}) : Promise.resolve([offer(it.id)]),
    );
    const { emit, messages } = collect();
    const started = Date.now();
    const result = await runAnalysis({ text: "two", ordersPerMonth: 4 }, emit, { timeoutMs: 100, suggestReserveMs: 20 });

    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.notice).toBe(TIMEOUT_NOTICE);
    expect(vi.mocked(analyzeItem).mock.calls.map(([it, offers]) => [it.id, offers.length])).toEqual([
      ["i1", 1], ["i2", 0],
    ]);
    expect(messages()).toContain("Comparing 1 offer…");
  });

  it("combines the item-limit and timeout notices", async () => {
    vi.mocked(parseList).mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map(item));
    vi.mocked(findOffers).mockImplementation(() => new Promise(() => {}));
    const { emit } = collect();
    const result = await runAnalysis({ text: "seven", ordersPerMonth: 4 }, emit, { timeoutMs: 50, suggestReserveMs: 10 });
    expect(result.notice).toBe(`${LIMIT_NOTICE} ${TIMEOUT_NOTICE}`);
  });

  it("still returns a result when suggestions fail", async () => {
    vi.mocked(parseList).mockResolvedValue([item(1)]);
    vi.mocked(writeSuggestions).mockRejectedValue(new Error("model down"));
    const { emit } = collect();
    const result = await runAnalysis({ text: "one", ordersPerMonth: 4 }, emit);
    expect(result.suggestions).toEqual([]);
  });

  it("rejects when no items are found", async () => {
    vi.mocked(parseList).mockResolvedValue([]);
    const { emit } = collect();
    await expect(runAnalysis({ text: "hello", ordersPerMonth: 4 }, emit)).rejects.toThrow("No items found");
  });
});
