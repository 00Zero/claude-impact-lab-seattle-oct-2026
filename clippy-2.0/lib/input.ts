import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { LineItem, Unit } from "./types";

const MAX_ITEMS = 6;
const UNITS = ["lb", "oz", "kg", "g", "each", "gal", "fl_oz", "l", "ml"] as const satisfies readonly Unit[];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export class NotAnInvoiceError extends Error {
  constructor() {
    super("This picture does not look like a supply invoice.");
    this.name = "NotAnInvoiceError";
  }
}

const ItemSchema = z.object({
  name: z.string().min(1),
  searchQuery: z.string().min(1),
  packSize: z.number().positive(),
  unit: z.enum(UNITS),
  qtyPerOrder: z.number().positive().default(1),
  pricePaid: z.number().positive().nullish(),
});
const SaveItemsSchema = z.object({
  items: z.array(ItemSchema),
  deliveryFee: z.number().nonnegative().nullish(),
});

const SAVE_ITEMS_TOOL: Anthropic.Tool = {
  name: "save_items",
  description: "Save the product lines found in the input.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", description: "Readable product name with size, e.g. 'Bread flour, 50 lb bag'" },
            searchQuery: {
              type: "string",
              description: "Short generic shopping search with size and count, e.g. 'bread flour 50 lb'. No item codes, no supplier name.",
            },
            packSize: { type: "number", description: "Amount in ONE pack, e.g. 50 for a 50 lb bag, 1000 for a 1000 ct case" },
            unit: { type: "string", enum: [...UNITS], description: "Unit of packSize. Use 'each' for counts." },
            qtyPerOrder: { type: "number", description: "How many packs are bought per order" },
            pricePaid: { type: "number", description: "USD for ONE pack (unit price, not line total). Omit if unknown." },
          },
          required: ["name", "searchQuery", "packSize", "unit", "qtyPerOrder"],
        },
      },
      deliveryFee: { type: "number", description: "Total delivery or shipping fee on the invoice in USD, if any" },
    },
    required: ["items"],
  },
};

const INVOICE_PROMPT = `Read this supply invoice and call save_items.
- One item per product line. Do NOT include tax, subtotal, total, discounts, deposits or delivery/shipping lines as items.
- pricePaid = USD for ONE pack: the unit price column, never the line total.
- qtyPerOrder = the quantity column.
- packSize and unit describe one pack (50 lb bag -> 50, "lb"; 1000 ct case -> 1000, "each").
- searchQuery = short generic phrase with size and count, like "12 oz paper hot cups 1000 count". Never include item codes, SKUs or the supplier name.
- Put any delivery or shipping fee in deliveryFee.
- If the image is not an invoice or receipt for products, call save_items with an empty items array.`;

const LIST_PROMPT = `The owner of a small business typed this shopping list. Call save_items with one item per product.
- Set pricePaid ONLY if the owner wrote a price for that item. Never guess a price.
- If the size is missing, use the most common wholesale size and add it to the name like "Granulated sugar (assumed 50 lb)".
- qtyPerOrder = the number of packs the owner wrote, or 1 if none.
- packSize and unit describe one pack ("1000 coffee cups 12oz" -> packSize 1000, unit "each").
- searchQuery = short generic phrase with size and count, no brand unless the owner named one.
- If there are no products, call save_items with an empty items array.

Shopping list:
`;

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

// Sonnet 5.5 rejects forced tool_choice, so it gets "auto" + a strict tool + an instruction, and one retry.
const FORCED_TOOL_MODELS = new Set(["claude-haiku-5-5"]);

async function callSaveItems(model: string, content: Anthropic.MessageParam["content"]) {
  const forced = FORCED_TOOL_MODELS.has(model);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().messages.create({
      model,
      max_tokens: 16000,
      system: "Always answer by calling the save_items tool exactly once.",
      tools: [SAVE_ITEMS_TOOL],
      tool_choice: forced ? { type: "tool", name: "save_items" } : { type: "auto", disable_parallel_tool_use: true },
      messages: [{ role: "user", content }],
    });
    const block = res.content.find((b) => b.type === "tool_use" && b.name === "save_items");
    if (block?.type === "tool_use") return SaveItemsSchema.parse(block.input);
  }
  throw new Error("Claude did not return items");
}

function toLineItems(items: z.infer<typeof ItemSchema>[], deliveryFee?: number | null): LineItem[] {
  const kept = items.slice(0, MAX_ITEMS);
  const shippingEach = deliveryFee && kept.length ? Math.round((deliveryFee / kept.length) * 100) / 100 : undefined;
  return kept.map((it, i) => ({
    id: `item-${i + 1}`,
    name: it.name,
    searchQuery: it.searchQuery,
    packSize: it.packSize,
    unit: it.unit,
    qtyPerOrder: it.qtyPerOrder,
    ...(it.pricePaid != null && { pricePaid: it.pricePaid }),
    ...(shippingEach != null && { shippingPaid: shippingEach }),
  }));
}

export async function readInvoice(base64: string, mediaType: string): Promise<LineItem[]> {
  const media_type: ImageType = (IMAGE_TYPES as readonly string[]).includes(mediaType)
    ? (mediaType as ImageType)
    : "image/jpeg";
  const out = await callSaveItems("claude-sonnet-5-5", [
    { type: "image", source: { type: "base64", media_type, data: base64 } },
    { type: "text", text: INVOICE_PROMPT },
  ]);
  const items = toLineItems(out.items, out.deliveryFee);
  if (items.length === 0) throw new NotAnInvoiceError();
  return items;
}

export async function parseList(text: string): Promise<LineItem[]> {
  if (!text.trim()) return [];
  const out = await callSaveItems("claude-haiku-5-5", LIST_PROMPT + text);
  return toLineItems(out.items);
}
