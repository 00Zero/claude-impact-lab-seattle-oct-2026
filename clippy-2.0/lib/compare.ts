import type { AnalysisResult, ItemResult, LineItem, Offer, RankedOffer } from "./types";
import { sameDimension, toBase } from "./units";

// Offers whose pack is far smaller or bigger than what the owner buys aren't a fair comparison.
const MIN_PACK_RATIO = 0.25;
const MAX_PACK_RATIO = 4;

export function rankOffers(item: LineItem, offers: Offer[]): RankedOffer[] {
  const itemBase = toBase(item.packSize, item.unit).qty;
  const ranked: RankedOffer[] = [];
  for (const offer of offers) {
    if (!sameDimension(offer.unit, item.unit)) continue;
    if (offer.confidence === "low") continue;
    if (offer.price <= 0) continue;
    const { qty, baseUnit } = toBase(offer.packSize, offer.unit);
    if (!(qty > 0)) continue;
    const ratio = qty / itemBase;
    if (ratio < MIN_PACK_RATIO || ratio > MAX_PACK_RATIO) continue;
    const unitCost = (offer.price + (offer.shipping ?? 0)) / qty;
    ranked.push({ ...offer, unitCost, baseUnit });
  }
  return ranked.sort((a, b) => a.unitCost - b.unitCost);
}

const toCents = (usd: number) => Math.round(usd * 100);

export function analyzeItem(item: LineItem, offers: Offer[]): ItemResult {
  const ranked = rankOffers(item, offers);
  const best = ranked[0] ?? null;
  const itemBase = toBase(item.packSize, item.unit).qty;
  const currentUnitCost =
    item.pricePaid !== undefined && itemBase > 0 ? (item.pricePaid + (item.shippingPaid ?? 0)) / itemBase : null;
  const savingsPerOrder =
    currentUnitCost !== null && best
      ? Math.max(0, toCents((currentUnitCost - best.unitCost) * itemBase * item.qtyPerOrder)) / 100
      : null;
  return { item, best, offers: ranked, currentUnitCost, savingsPerOrder };
}

export function buildResult(
  items: ItemResult[],
  ordersPerMonth: number,
  suggestions: string[],
  notice?: string,
): AnalysisResult {
  const perOrderCents = items.reduce((sum, r) => sum + (r.savingsPerOrder === null ? 0 : toCents(r.savingsPerOrder)), 0);
  const perMonthCents = Math.round(perOrderCents * ordersPerMonth);
  return {
    items,
    totalSavingsPerOrder: perOrderCents / 100,
    totalSavingsPerMonth: perMonthCents / 100,
    totalSavingsPerYear: (perMonthCents * 12) / 100,
    ordersPerMonth,
    suggestions,
    generatedAt: new Date().toISOString(),
    ...(notice ? { notice } : {}),
  };
}

// Units of the base measure the owner buys per order (e.g. 2 cases of 1000 cups = 2000 cups).
const baseQtyPerOrder = (r: ItemResult) => toBase(r.item.packSize, r.item.unit).qty * r.item.qtyPerOrder;

// What the owner pays now vs. with Clippy's picks, per order, over items where both prices are known.
export function orderTotals(items: ItemResult[]): { current: number; withClippy: number; savings: number; percent: number } | null {
  let currentCents = 0;
  let savingsCents = 0;
  for (const r of items) {
    if (r.currentUnitCost === null || r.savingsPerOrder === null) continue;
    currentCents += toCents(r.currentUnitCost * baseQtyPerOrder(r));
    savingsCents += toCents(r.savingsPerOrder);
  }
  if (currentCents <= 0) return null;
  return {
    current: currentCents / 100,
    withClippy: (currentCents - savingsCents) / 100,
    savings: savingsCents / 100,
    percent: Math.round((savingsCents / currentCents) * 1000) / 10,
  };
}

export interface StorePick { store: string; items: ItemResult[]; costPerOrder: number; savingsPerOrder: number }

// Group items by their cheapest store, biggest spend first.
export function storePlan(items: ItemResult[]): StorePick[] {
  const byStore = new Map<string, { items: ItemResult[]; cost: number; savings: number }>();
  for (const r of items) {
    if (!r.best) continue;
    const s = byStore.get(r.best.store) ?? { items: [], cost: 0, savings: 0 };
    s.items.push(r);
    s.cost += toCents(r.best.unitCost * baseQtyPerOrder(r));
    s.savings += r.savingsPerOrder === null ? 0 : toCents(r.savingsPerOrder);
    byStore.set(r.best.store, s);
  }
  return [...byStore]
    .map(([store, s]) => ({ store, items: s.items, costPerOrder: s.cost / 100, savingsPerOrder: s.savings / 100 }))
    .sort((a, b) => b.costPerOrder - a.costPerOrder);
}

// The owner typed what they pay for one pack after the search: redo that item and the totals with the same offers.
export function withPricePaid(result: AnalysisResult, itemId: string, pricePaid: number | undefined): AnalysisResult {
  const items = result.items.map((r) => {
    if (r.item.id !== itemId) return r;
    const item = { ...r.item, pricePaid: pricePaid !== undefined && pricePaid > 0 ? pricePaid : undefined };
    return analyzeItem(item, r.offers);
  });
  return { ...buildResult(items, result.ordersPerMonth, result.suggestions, result.notice), generatedAt: result.generatedAt };
}

// What one order costs if every priced item is bought at its best store.
export function bestCostPerOrder(items: ItemResult[]): number {
  return items.reduce((sum, r) => sum + (r.best ? toCents(r.best.unitCost * baseQtyPerOrder(r)) : 0), 0) / 100;
}
