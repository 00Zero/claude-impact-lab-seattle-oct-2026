import { NotAnInvoiceError } from "@/lib/input";
import { NoItemsError, runAnalysis } from "@/lib/pipeline";
import type { ProgressEvent } from "@/lib/types";

// No `runtime` export: cacheComponents rejects it, and Node.js is already the default.
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_LIST_CHARS = 5_000;
const MAX_LOCATION_CHARS = 80;

const NOT_AN_INVOICE = "That photo does not look like an invoice or receipt. Try another photo or type your list.";
const NO_ITEMS = "Clippy could not find any items. Try another photo or type your list, one item per line.";
const GENERIC_ERROR = "Something went wrong while checking prices. Please try again in a minute.";

const badRequest = (error: string) => Response.json({ error }, { status: 400 });

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Send a photo of your invoice or type your list.");
  }

  const listField = form.get("list");
  const text = typeof listField === "string" ? listField.trim() : "";
  const invoice = form.get("invoice");
  const file = invoice instanceof File && invoice.size > 0 ? invoice : null;

  if (!text && !file) return badRequest("Send a photo of your invoice or type your list.");
  if (text.length > MAX_LIST_CHARS) return badRequest("That list is too long. Keep it under 5,000 characters.");
  if (file && !IMAGE_TYPES.includes(file.type)) return badRequest("The photo must be a JPEG, PNG or WebP image.");
  if (file && file.size > MAX_IMAGE_BYTES) return badRequest("The photo is too large. Use one under 5 MB.");

  const ordersField = form.get("ordersPerMonth");
  const orders = typeof ordersField === "string" && ordersField.trim() ? Number(ordersField) : 4;
  if (!Number.isInteger(orders) || orders < 1 || orders > 30) {
    return badRequest("Orders per month must be a whole number from 1 to 30.");
  }

  const locationField = form.get("location");
  const location = typeof locationField === "string" ? locationField.trim() : "";
  if (location.length > MAX_LOCATION_CHARS) return badRequest("Keep your location short, like a city and state or a ZIP code.");

  const image = file
    ? { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType: file.type }
    : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const data = await runAnalysis({ text: image ? undefined : text, image, ordersPerMonth: orders, location: location || undefined }, send);
        send({ type: "result", data });
      } catch (err) {
        console.error("analyze failed:", err instanceof Error ? err.message : err);
        const message =
          err instanceof NotAnInvoiceError ? NOT_AN_INVOICE : err instanceof NoItemsError ? NO_ITEMS : GENERIC_ERROR;
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
