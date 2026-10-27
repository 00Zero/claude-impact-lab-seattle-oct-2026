import type { AnalysisResult, ItemResult } from "../lib/types";
import { unitLabel } from "../lib/units";
import { money, safeHref, shortDate, unitMoney } from "./format";

export type Finding = ItemResult & { best: NonNullable<ItemResult["best"]> };

// The 3 items worth acting on first: biggest savings per order, then items with a store price but no known current price.
export function topFindings(result: AnalysisResult, count = 3): Finding[] {
  return result.items
    .filter((r): r is Finding => r.best !== null)
    .sort((a, b) => (b.savingsPerOrder ?? -1) - (a.savingsPerOrder ?? -1))
    .slice(0, count);
}

export function findingLine(r: Finding): string {
  const per = unitLabel(r.best.baseUnit, r.item.name);
  const price = `${unitMoney(r.best.unitCost)} ${per}`;
  if (r.savingsPerOrder !== null && r.savingsPerOrder >= 0.01) {
    return `Buy at ${r.best.store} for ${price} instead of ${unitMoney(r.currentUnitCost)} and save ${money(r.savingsPerOrder)} per order.`;
  }
  if (r.currentUnitCost !== null) return `You already pay a good price. Best found: ${r.best.store} at ${price}.`;
  return `Best price found: ${r.best.store} at ${price}.`;
}

// Plain text that reads well in a text message, email or chat.
export function shareText(result: AnalysisResult): string {
  const top = topFindings(result);
  const head =
    result.totalSavingsPerMonth >= 0.01
      ? `Clippy found ${money(result.totalSavingsPerMonth)} a month (${money(result.totalSavingsPerYear)} a year) in savings on our supplies. Top ${top.length}:`
      : `Clippy's top ${top.length} supply price findings:`;
  const lines = top.map((r, i) => {
    const href = safeHref(r.best.url);
    return `${i + 1}. ${r.item.name}: ${findingLine(r)}${href ? `\n   ${href}` : ""}`;
  });
  return [head, ...lines, `Prices checked ${shortDate(result.generatedAt)}. Check before you buy.`].join("\n");
}

// Share sheet on phones, clipboard elsewhere. Returns what happened so the button can say so.
export async function shareFindings(result: AnalysisResult): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const text = shareText(result);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Clippy: top savings", text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
