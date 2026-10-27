import { describe, expect, it, vi } from "vitest";
import { ADD_PRICES_TIP, buildSuggestionInput, GOOD_PRICES_TIP, NO_PRICES_TIP, templateSuggestions, writeSuggestions } from "./suggest";
import type { ItemResult, LineItem, RankedOffer } from "./types";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: () => Promise.reject(new Error("network down")) };
  },
}));

function result(name: string, savingsPerOrder: number | null, currentUnitCost: number | null, bestUnitCost = 0.1): ItemResult {
  const item: LineItem = { id: name, name, searchQuery: name, packSize: 1000, unit: "each", qtyPerOrder: 1 };
  const best: RankedOffer = {
    itemId: name, store: `${name} Store`, title: name, url: "https://example.com", price: 100, packSize: 1000,
    unit: "each", shipping: 0, confidence: "high", checkedAt: "2026-10-25", unitCost: bestUnitCost, baseUnit: "each",
  };
  return { item, best, offers: [best], currentUnitCost, savingsPerOrder };
}

describe("buildSuggestionInput", () => {
  it("keeps only items with savings, biggest first, numbers as text", () => {
    const rows = buildSuggestionInput([
      result("napkins", 4.5, 0.02, 0.0155),
      result("hot cups", 20, 0.122, 0.102),
      result("lids", 0, 0.07),
      result("flour", null, null),
    ]);
    expect(rows.map((r) => r.item)).toEqual(["hot cups", "napkins"]);
    expect(rows[0]).toEqual({
      item: "hot cups", store: "hot cups Store", savingsPerOrder: "$20.00",
      youPayNow: "$0.122 per cup", bestPrice: "$0.102 per cup",
    });
    expect(rows[1].youPayNow).toBe("$0.020 per napkin");
  });

  it("skips items with no best offer", () => {
    expect(buildSuggestionInput([{ ...result("cups", 5, 0.1), best: null }])).toEqual([]);
  });
});

describe("templateSuggestions", () => {
  it("says prices are good when there are no savings", () => {
    expect(templateSuggestions([])).toEqual([GOOD_PRICES_TIP]);
  });

  it("writes at most 3 short tips in order", () => {
    const rows = buildSuggestionInput([1, 2, 3, 4].map((n) => result(`item ${n}`, n, 0.2)));
    const tips = templateSuggestions(rows);
    expect(tips).toHaveLength(3);
    expect(tips[0]).toBe("Buy item 4 at item 4 Store and save $4.00 per order.");
    for (const t of tips) expect(t.split(/\s+/).length).toBeLessThan(25);
  });
});

describe("writeSuggestions", () => {
  it("falls back to template sentences when the Claude call fails", async () => {
    const results = [result("hot cups", 20, 0.122, 0.102)];
    expect(await writeSuggestions(results, 4)).toEqual(templateSuggestions(buildSuggestionInput(results)));
  });

  it("returns the good-prices line without calling Claude when nothing saves money", async () => {
    expect(await writeSuggestions([result("lids", 0, 0.07)], 4)).toEqual([GOOD_PRICES_TIP]);
  });

  it("gives the best price per item and asks for prices when the owner gave none", async () => {
    expect(await writeSuggestions([result("cups", null, null), result("lids", null, null, 0.05)], 4)).toEqual([
      "Best price I found for cups: $0.100 per cup at cups Store.",
      "Best price I found for lids: $0.050 per lid at lids Store.",
      ADD_PRICES_TIP,
    ]);
  });

  it("adds a line for items with no reliable price after the saving tips", async () => {
    const tips = await writeSuggestions(
      [result("hot cups", 20, 0.122, 0.102), { ...result("sugar", null, 1.1), best: null }, { ...result("flour", null, 1.5), best: null }],
      4,
    );
    expect(tips).toEqual([
      ...templateSuggestions(buildSuggestionInput([result("hot cups", 20, 0.122, 0.102)])),
      "I could not find a reliable price for sugar and flour.",
    ]);
  });

  it("says no reliable prices when no store price was found", async () => {
    expect(await writeSuggestions([{ ...result("flour", null, 1.5), best: null, offers: [] }], 4)).toEqual([NO_PRICES_TIP]);
  });
});
