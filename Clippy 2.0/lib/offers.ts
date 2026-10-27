import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { extractPages, searchItem, type Page } from "./tavily";
import type { LineItem, Offer, Unit } from "./types";

const MODEL = "claude-sonnet-5-5";
const TIME_LIMIT_MS = 25_000;

const UNIT_ALIASES: Record<string, Unit> = {
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  oz: "oz", ounce: "oz", ounces: "oz",
  kg: "kg", g: "g", gram: "g", grams: "g",
  each: "each", ct: "each", count: "each", pc: "each", pcs: "each", piece: "each", pieces: "each", ea: "each",
  gal: "gal", gallon: "gal", gallons: "gal",
  fl_oz: "fl_oz", "fl oz": "fl_oz", floz: "fl_oz",
  l: "l", liter: "l", litre: "l", ml: "ml",
};

const RawOffer = z.object({
  store: z.string().min(1),
  title: z.string().min(1),
  url: z.string().min(1),
  price: z.number().positive(),
  packSize: z.number().positive(),
  unit: z.string().transform((u, ctx) => {
    const unit = UNIT_ALIASES[u.trim().toLowerCase()];
    if (!unit) { ctx.addIssue({ code: "custom", message: `unknown unit ${u}` }); return z.NEVER; }
    return unit;
  }),
  shipping: z.number().min(0).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

const SAVE_OFFERS_TOOL: Anthropic.Tool = {
  name: "save_offers",
  description: "Save the store offers found on the given pages.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      offers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            store: { type: "string", description: "Retailer name, e.g. WebstaurantStore" },
            title: { type: "string", description: "Product title from the page" },
            url: { type: "string", description: "Exactly one of the given URLs" },
            price: { type: "number", description: "USD price for ONE pack, as shown on the page" },
            packSize: { type: "number", description: "Amount in one pack, e.g. 50 for a 50 lb bag, 1000 for 1000 count" },
            unit: { type: "string", enum: ["lb", "oz", "kg", "g", "each", "gal", "fl_oz", "l", "ml"] },
            shipping: { type: ["number", "null"], description: "Shipping in USD if stated (free = 0), else null" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["store", "title", "url", "price", "packSize", "unit", "shipping", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["offers"],
    additionalProperties: false,
  },
};

function normUrl(url: string): string {
  return url.trim().replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();
}

// Pure: validate raw tool output, keep only offers for given URLs, stamp itemId and checkedAt.
export function cleanOffers(raw: unknown, item: LineItem, allowedUrls: string[], now: Date): Offer[] {
  const list = Array.isArray(raw) ? raw : (raw as { offers?: unknown })?.offers;
  if (!Array.isArray(list)) return [];
  const allowed = new Map(allowedUrls.map((u) => [normUrl(u), u]));
  const seen = new Set<string>();
  const offers: Offer[] = [];
  for (const entry of list) {
    const parsed = RawOffer.safeParse(entry);
    if (!parsed.success) continue;
    const url = allowed.get(normUrl(parsed.data.url));
    if (!url) continue;
    const key = `${url}|${parsed.data.price}|${parsed.data.packSize}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({ ...parsed.data, url, itemId: item.id, checkedAt: now.toISOString() });
  }
  return offers;
}

export function buildPrompt(item: LineItem, pages: Page[], location?: string, now = new Date()): string {
  const pageText = pages
    .map((p) => `URL: ${p.url}\nTITLE: ${p.title}\n${p.publishedDate ? `PAGE DATE: ${p.publishedDate.slice(0, 10)}\n` : ""}${p.text}`)
    .join("\n\n-----\n\n");
  const today = now.toISOString().slice(0, 10);
  const place = location?.trim();
  return `Find store offers for this product: "${item.name}" (${item.packSize} ${item.unit} per pack).
Today is ${today}.${place ? ` The buyer is in ${place}.` : ""}

Rules:
- Only current prices. Skip a page whose price is dated, "as of", "last updated" or in a report or price list from more than 12 months before today, or whose PAGE DATE is that old. Skip archived, discontinued and "no longer available" pages.${place ? `
- Skip a page that says the product is not sold, not delivered or not available in ${place}.` : ""}
- Only the same product type and a similar pack size.
- Only use a page about ONE specific product. Skip search results, category, brand or "shop all" pages that list several products, even if they show prices: their URL does not open the product you would be pricing.
- price = USD for ONE pack exactly as shown on the page. NEVER invent or estimate a price; skip the page if no price is shown.
- packSize and unit come from the page ("1000 count" → packSize 1000, unit "each"; "50 lb" → 50, "lb").
- shipping only if the page states it (free shipping → 0), otherwise null.
- confidence "high" only if both price and pack size are clearly stated; "medium" if one needs light inference; else "low".
- url must be exactly one of the URLs below.
- store = the retailer name (e.g. "WebstaurantStore", "Walmart"), not the brand.
- Return an empty list if nothing qualifies.
- Answer ONLY by calling the save_offers tool once.

PAGES:

${pageText}`;
}

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

export async function findOffers(item: LineItem, location?: string): Promise<Offer[]> {
  const deadline = Date.now() + TIME_LIMIT_MS;
  try {
    const hits = await searchItem(item.searchQuery || item.name, location);
    if (!hits.length) return [];
    const pages = await extractPages(hits);
    const remaining = deadline - Date.now();
    if (remaining < 3000) return [];
    const msg = await anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: "low" },
        tools: [SAVE_OFFERS_TOOL],
        // Sonnet 5.5 rejects forced tool_choice; strict tool + prompt instruction + zod instead.
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: buildPrompt(item, pages, location) }],
      },
      { timeout: remaining, maxRetries: 0 },
    );
    const block = msg.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return [];
    return cleanOffers(block.input, item, pages.map((p) => p.url), new Date());
  } catch (err) {
    console.error(`findOffers failed for "${item.name}":`, (err as Error).message);
    return [];
  }
}
