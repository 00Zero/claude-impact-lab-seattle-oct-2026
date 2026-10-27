import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ItemResult } from "./types";
import { unitLabel } from "./units";

const MAX_TIPS = 3;
const MAX_WORDS = 24;
export const GOOD_PRICES_TIP = "Great news: you already pay good prices for these items. Keep it up!";
export const ADD_PRICES_TIP = "Add the price you pay now to each item, and Clippy will show how much you could save.";
export const NO_PRICES_TIP = "Clippy could not find reliable store prices for these items this time.";

const MAX_PRICE_TIPS = 3;

// Tips for items Clippy could not compare: the best price found, or that none was found. Template only, no Claude.
export function extraTips(results: ItemResult[], hasSavingTips: boolean): string[] {
  const compared = results.some((r) => r.best && r.currentUnitCost !== null);
  const priceOnly = results.filter((r) => r.best && r.currentUnitCost === null);
  const missing = results.filter((r) => !r.best).map((r) => r.item.name);
  if (!compared && priceOnly.length === 0) return [NO_PRICES_TIP];

  const tips: string[] = [];
  if (!hasSavingTips && compared) tips.push(GOOD_PRICES_TIP);
  for (const r of priceOnly.slice(0, MAX_PRICE_TIPS)) {
    const label = unitLabel(r.best!.baseUnit, r.item.name);
    tips.push(`Best price I found for ${r.item.name}: ${unitMoney(r.best!.unitCost)} ${label} at ${r.best!.store}.`);
  }
  if (missing.length) tips.push(`I could not find a reliable price for ${joinNames(missing)}.`);
  if (priceOnly.length) tips.push(ADD_PRICES_TIP);
  return tips;
}

function joinNames(names: string[]): string {
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export interface SuggestionRow {
  item: string;
  store: string;
  savingsPerOrder: string; // "$12.40"
  youPayNow: string; // "$0.119 per cup"
  bestPrice: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const unitMoney = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;

// Items with a real saving, biggest first, with every number already written as text.
export function buildSuggestionInput(results: ItemResult[]): SuggestionRow[] {
  return results
    .filter((r) => r.best && r.currentUnitCost !== null && (r.savingsPerOrder ?? 0) > 0)
    .sort((a, b) => (b.savingsPerOrder ?? 0) - (a.savingsPerOrder ?? 0))
    .map((r) => {
      const label = unitLabel(r.best!.baseUnit, r.item.name);
      return {
        item: r.item.name,
        store: r.best!.store,
        savingsPerOrder: money(r.savingsPerOrder!),
        youPayNow: `${unitMoney(r.currentUnitCost!)} ${label}`,
        bestPrice: `${unitMoney(r.best!.unitCost)} ${label}`,
      };
    });
}

export function templateSuggestions(rows: SuggestionRow[]): string[] {
  if (rows.length === 0) return [GOOD_PRICES_TIP];
  return rows
    .slice(0, MAX_TIPS)
    .map((r) => `Buy ${r.item} at ${r.store} and save ${r.savingsPerOrder} per order.`);
}

const numbersIn = (text: string) => text.match(/\d+(?:[.,]\d+)*/g)?.map((n) => n.replace(/,/g, "")) ?? [];
const wordCount = (text: string) => text.trim().split(/\s+/).length;

const TipsSchema = z.object({ tips: z.array(z.string().min(1)) });

const SAVE_TIPS_TOOL: Anthropic.Tool = {
  name: "save_tips",
  description: "Save the tips for the business owner.",
  input_schema: {
    type: "object",
    properties: { tips: { type: "array", items: { type: "string" }, maxItems: MAX_TIPS } },
    required: ["tips"],
  },
};

let client: Anthropic | undefined;

// Saving tips first (written by Claude, template fallback), then tips for the items Clippy could not compare.
export async function writeSuggestions(results: ItemResult[], ordersPerMonth: number): Promise<string[]> {
  const rows = buildSuggestionInput(results);
  const savingTips = rows.length ? await writeSavingTips(rows, ordersPerMonth) : [];
  return [...savingTips, ...extraTips(results, savingTips.length > 0)];
}

async function writeSavingTips(rows: SuggestionRow[], ordersPerMonth: number): Promise<string[]> {
  const input = JSON.stringify({ ordersPerMonth, items: rows }, null, 2);
  try {
    client ??= new Anthropic();
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      tools: [SAVE_TIPS_TOOL],
      tool_choice: { type: "tool", name: "save_tips" },
      messages: [
        {
          role: "user",
          content: `You are Clippy, a friendly helper for a small-business owner. Write at most ${MAX_TIPS} money-saving tips from the data below and call save_tips.
- One tip per item, one short sentence of at most 20 words, friendly, simple English. No greeting.
- Each tip names the store and the saving per order. Biggest saving first (the items are already in that order).
- Use ONLY numbers that appear in the data, copied exactly. Do not calculate new numbers (no monthly or yearly totals).

Data:
${input}`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("no tips returned");
    const allowed = new Set(numbersIn(input));
    const tips = TipsSchema.parse(block.input)
      .tips.map((t) => t.trim())
      .filter((t) => wordCount(t) <= MAX_WORDS && numbersIn(t).every((n) => allowed.has(n)))
      .slice(0, MAX_TIPS);
    if (tips.length === 0) throw new Error("no usable tips");
    return tips;
  } catch {
    return templateSuggestions(rows);
  }
}
