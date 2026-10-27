import { describe, expect, it } from "vitest";
import { analyzeItem, bestCostPerOrder, buildResult, orderTotals, rankOffers, storePlan, withPricePaid } from "./compare";
import type { ItemResult, LineItem, Offer } from "./types";
import { sameDimension, toBase, unitLabel } from "./units";

describe("toBase", () => {
  it("keeps lb as lb", () => expect(toBase(5, "lb")).toEqual({ qty: 5, baseUnit: "lb" }));
  it("converts oz to lb", () => expect(toBase(32, "oz")).toEqual({ qty: 2, baseUnit: "lb" }));
  it("converts kg to lb", () => {
    const r = toBase(10, "kg");
    expect(r.baseUnit).toBe("lb");
    expect(r.qty).toBeCloseTo(22.0462, 4);
  });
  it("converts g to lb", () => {
    const r = toBase(453.592, "g");
    expect(r.baseUnit).toBe("lb");
    expect(r.qty).toBeCloseTo(1, 6);
  });
  it("keeps fl_oz as fl_oz", () => expect(toBase(12, "fl_oz")).toEqual({ qty: 12, baseUnit: "fl_oz" }));
  it("converts gal to fl_oz", () => expect(toBase(2, "gal")).toEqual({ qty: 256, baseUnit: "fl_oz" }));
  it("converts l to fl_oz", () => {
    const r = toBase(1, "l");
    expect(r.baseUnit).toBe("fl_oz");
    expect(r.qty).toBeCloseTo(33.814, 3);
  });
  it("converts ml to fl_oz", () => {
    const r = toBase(29.5735, "ml");
    expect(r.baseUnit).toBe("fl_oz");
    expect(r.qty).toBeCloseTo(1, 6);
  });
  it("keeps each as each", () => expect(toBase(1000, "each")).toEqual({ qty: 1000, baseUnit: "each" }));
});

describe("sameDimension", () => {
  it("weight units match", () => expect(sameDimension("lb", "g")).toBe(true));
  it("volume units match", () => expect(sameDimension("gal", "ml")).toBe(true));
  it("weight and volume differ", () => expect(sameDimension("lb", "fl_oz")).toBe(false));
  it("each and weight differ", () => expect(sameDimension("each", "kg")).toBe(false));
});

describe("unitLabel", () => {
  it("lb", () => expect(unitLabel("lb", "Flour")).toBe("per lb"));
  it("fl_oz", () => expect(unitLabel("fl_oz", "Olive oil")).toBe("per fl oz"));
  it("cup", () => expect(unitLabel("each", "16 oz Paper Cups")).toBe("per cup"));
  it("lid", () => expect(unitLabel("each", "Dome lids")).toBe("per lid"));
  it("cup lids are lids", () => expect(unitLabel("each", "12 oz Hot Cup Lids, Black Sip-Thru")).toBe("per lid"));
  it("cups with lids are cups", () => expect(unitLabel("each", "Lidded Hot Cups")).toBe("per cup"));
  it("napkin", () => expect(unitLabel("each", "Napkin dispenser refill")).toBe("per napkin"));
  it("glove", () => expect(unitLabel("each", "Nitrile Gloves L")).toBe("per glove"));
  it("falls back to item", () => expect(unitLabel("each", "Straws")).toBe("per item"));
  it("does not match cup inside cupcake", () => expect(unitLabel("each", "Cupcake liners")).toBe("per item"));
});

const flour: LineItem = { id: "flour", name: "Flour", searchQuery: "all purpose flour 50 lb", packSize: 50, unit: "lb", qtyPerOrder: 2 };

function offer(over: Partial<Offer> = {}): Offer {
  return {
    itemId: "flour", store: "Store", title: "Flour 50 lb", url: "https://example.com/flour", price: 60, packSize: 50,
    unit: "lb", shipping: 12, confidence: "high", checkedAt: "2026-10-25T12:00:00Z", ...over,
  };
}

describe("rankOffers", () => {
  it("computes unit cost including shipping", () => {
    const [r] = rankOffers(flour, [offer()]);
    expect(r.unitCost).toBeCloseTo(1.44, 10);
    expect(r.baseUnit).toBe("lb");
  });
  it("drops a 5 lb offer for a 50 lb item", () => {
    expect(rankOffers(flour, [offer({ packSize: 5, price: 6 })])).toEqual([]);
  });
  it("drops packs over 400%", () => {
    expect(rankOffers(flour, [offer({ packSize: 250 })])).toEqual([]);
  });
  it("keeps packs at the 25% and 400% edges", () => {
    expect(rankOffers(flour, [offer({ packSize: 12.5 }), offer({ packSize: 200 })])).toHaveLength(2);
  });
  it("drops low confidence", () => {
    expect(rankOffers(flour, [offer({ confidence: "low" })])).toEqual([]);
  });
  it("treats null shipping as 0", () => {
    const [r] = rankOffers(flour, [offer({ shipping: null })]);
    expect(r.unitCost).toBeCloseTo(1.2, 10);
  });
  it("drops a different dimension", () => {
    expect(rankOffers(flour, [offer({ unit: "fl_oz" })])).toEqual([]);
  });
  it("drops price <= 0", () => {
    expect(rankOffers(flour, [offer({ price: 0 }), offer({ price: -5 })])).toEqual([]);
  });
  it("converts units and sorts cheapest first", () => {
    const ranked = rankOffers(flour, [
      offer({ store: "A", price: 70, shipping: 0 }),
      offer({ store: "B", packSize: 20, unit: "kg", price: 40, shipping: 0 }),
      offer({ store: "C", price: 55, shipping: 0, confidence: "medium" }),
    ]);
    expect(ranked.map((r) => r.store)).toEqual(["B", "C", "A"]);
    expect(ranked[0].unitCost).toBeCloseTo(40 / 44.0924, 10);
  });
});

function itemResult(savingsPerOrder: number | null): ItemResult {
  return { item: flour, best: null, offers: [], currentUnitCost: null, savingsPerOrder };
}

describe("analyzeItem", () => {
  it("computes current unit cost and savings per order", () => {
    // paid $80 + $10 shipping for 50 lb = $1.80/lb; best $1.44/lb; 50 lb x 2 packs -> $36.00
    const r = analyzeItem({ ...flour, pricePaid: 80, shippingPaid: 10 }, [offer()]);
    expect(r.currentUnitCost).toBeCloseTo(1.8, 10);
    expect(r.best?.unitCost).toBeCloseTo(1.44, 10);
    expect(r.savingsPerOrder).toBe(36);
  });
  it("treats missing shippingPaid as 0", () => {
    const r = analyzeItem({ ...flour, pricePaid: 90 }, [offer()]);
    expect(r.currentUnitCost).toBeCloseTo(1.8, 10);
  });
  it("never returns negative savings", () => {
    const r = analyzeItem({ ...flour, pricePaid: 40 }, [offer()]);
    expect(r.savingsPerOrder).toBe(0);
  });
  it("returns null without pricePaid", () => {
    const r = analyzeItem(flour, [offer()]);
    expect(r.currentUnitCost).toBeNull();
    expect(r.savingsPerOrder).toBeNull();
    expect(r.best).not.toBeNull();
  });
  it("returns null savings when no offer survives", () => {
    const r = analyzeItem({ ...flour, pricePaid: 80 }, [offer({ confidence: "low" })]);
    expect(r.best).toBeNull();
    expect(r.offers).toEqual([]);
    expect(r.savingsPerOrder).toBeNull();
  });
  it("rounds savings to cents", () => {
    const r = analyzeItem({ ...flour, qtyPerOrder: 1, pricePaid: 72.333 }, [offer()]);
    expect(r.savingsPerOrder).toBe(0.33);
  });
});

describe("buildResult", () => {
  it("$10.00 + $5.50 per order x 4 orders", () => {
    const r = buildResult([itemResult(10), itemResult(5.5)], 4, ["tip"]);
    expect(r.totalSavingsPerOrder).toBe(15.5);
    expect(r.totalSavingsPerMonth).toBe(62);
    expect(r.totalSavingsPerYear).toBe(744);
    expect(r.ordersPerMonth).toBe(4);
    expect(r.suggestions).toEqual(["tip"]);
  });
  it("leaves items without savings out of totals", () => {
    const r = buildResult([itemResult(10), itemResult(null)], 1, []);
    expect(r.totalSavingsPerOrder).toBe(10);
    expect(r.items).toHaveLength(2);
  });
  it("has no float noise", () => {
    const r = buildResult([itemResult(0.1), itemResult(0.2)], 3, []);
    expect(r.totalSavingsPerOrder).toBe(0.3);
    expect(r.totalSavingsPerMonth).toBe(0.9);
    expect(r.totalSavingsPerYear).toBe(10.8);
  });
  it("sets generatedAt to now and passes notice through", () => {
    const before = Date.now();
    const r = buildResult([], 4, [], "Using sample data");
    expect(Date.parse(r.generatedAt)).toBeGreaterThanOrEqual(before);
    expect(r.notice).toBe("Using sample data");
    expect(r.totalSavingsPerYear).toBe(0);
  });
  it("omits notice when not given", () => {
    expect(buildResult([], 4, [])).not.toHaveProperty("notice");
  });
});

describe("orderTotals and storePlan", () => {
  // Paid $100 + $0 shipping per 50 lb bag, 2 bags per order → $200 now. Best: $72 landed per bag → $144.
  const paid = analyzeItem({ ...flour, pricePaid: 100 }, [offer(), offer({ store: "Dear", price: 90 })]);
  const unknown = analyzeItem({ ...flour, id: "x" }, [offer({ store: "Other", price: 40, shipping: 0 })]);

  it("totals what you pay now and with Clippy", () => {
    expect(orderTotals([paid, unknown])).toEqual({ current: 200, withClippy: 144, savings: 56, percent: 28 });
  });
  it("is null when no prices were given", () => expect(orderTotals([unknown])).toBeNull());
  it("groups by best store, biggest spend first", () => {
    const plan = storePlan([unknown, paid]);
    expect(plan.map((p) => [p.store, p.costPerOrder, p.savingsPerOrder])).toEqual([
      ["Store", 144, 56],
      ["Other", 80, 0],
    ]);
  });
});

describe("withPricePaid", () => {
  // No price typed: best is $72 landed per 50 lb bag, 2 bags per order.
  const unpriced = buildResult([analyzeItem(flour, [offer()])], 4, ["tip"], "note");

  it("adds savings once the owner types what they pay", () => {
    expect(unpriced.totalSavingsPerOrder).toBe(0);
    const priced = withPricePaid(unpriced, "flour", 100);
    expect(priced.items[0].savingsPerOrder).toBe(56);
    expect(priced.totalSavingsPerOrder).toBe(56);
    expect(priced.totalSavingsPerMonth).toBe(224);
    expect(priced.totalSavingsPerYear).toBe(2688);
    expect(priced.generatedAt).toBe(unpriced.generatedAt);
    expect(priced.suggestions).toEqual(["tip"]);
    expect(priced.notice).toBe("note");
  });
  it("clears the price again", () => {
    const cleared = withPricePaid(withPricePaid(unpriced, "flour", 100), "flour", undefined);
    expect(cleared.items[0].item.pricePaid).toBeUndefined();
    expect(cleared.items[0].savingsPerOrder).toBeNull();
  });
  it("totals the best-price cost per order", () => expect(bestCostPerOrder(unpriced.items)).toBe(144));
});
