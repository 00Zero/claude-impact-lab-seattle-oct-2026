import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { callStructured } from "@/lib/ai/client";
import {
  PRICE_EXTRACTION_PROMPT_VERSION,
  PRICE_EXTRACTION_SYSTEM,
  priceExtractionSchema,
} from "@/lib/ai/prompts/price-extraction";
import { toMinor } from "@/lib/money";
import {
  PRICE_DOCUMENT_MAX_BYTES,
  type PriceCategory,
  type PriceUnit,
} from "@/lib/price-book-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The workspace price book (spec B8). Contractors manage items through RLS
// (owners and admins). Uploaded documents are stored privately and read by
// the AI only to suggest items, which wait for the contractor's review.

const BUCKET = "price-documents";
const MAX_SUGGESTIONS_PER_DOCUMENT = 150;

export type PriceBookItem = {
  id: string;
  name: string;
  description: string | null;
  category: PriceCategory;
  unit: PriceUnit;
  priceLowMinor: number | null;
  priceHighMinor: number | null;
  status: "suggested" | "active" | "archived";
  sourceNote: string | null;
  sourceDocumentId: string | null;
};

export type PriceDocument = {
  id: string;
  fileName: string;
  status: "processing" | "succeeded" | "failed";
  errorCode: string | null;
  itemsFound: number;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  category: PriceCategory;
  unit: PriceUnit;
  price_low_minor: number | null;
  price_high_minor: number | null;
  status: PriceBookItem["status"];
  source_note: string | null;
  source_document_id: string | null;
};

const ITEM_COLUMNS =
  "id, name, description, category, unit, price_low_minor, price_high_minor, status, source_note, source_document_id";

function toItem(row: ItemRow): PriceBookItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    unit: row.unit,
    priceLowMinor: row.price_low_minor,
    priceHighMinor: row.price_high_minor,
    status: row.status,
    sourceNote: row.source_note,
    sourceDocumentId: row.source_document_id,
  };
}

export async function getPriceBook(organizationId: string) {
  const supabase = await createClient();
  const [{ data: items, error }, { data: documents }] = await Promise.all([
    supabase
      .from("price_book_items")
      .select(ITEM_COLUMNS)
      .eq("organization_id", organizationId)
      .order("category")
      .order("name"),
    supabase
      .from("price_documents")
      .select("id, file_name, status, error_code, items_found, notes, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (error) throw new Error(`Failed to load price book: ${error.message}`);
  return {
    items: ((items ?? []) as ItemRow[]).map(toItem),
    documents: (
      (documents ?? []) as {
        id: string;
        file_name: string;
        status: PriceDocument["status"];
        error_code: string | null;
        items_found: number;
        notes: string[];
        created_at: string;
        updated_at: string;
      }[]
    ).map((d) => ({
      id: d.id,
      fileName: d.file_name,
      status: d.status,
      errorCode: d.error_code,
      itemsFound: d.items_found,
      notes: d.notes ?? [],
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })),
  };
}

// What estimate drafting can use: active, priced items.
// Takes the caller's client: the secret-key client in background jobs, or
// the contractor's session (RLS) on pages.
export async function activePriceBookItems(
  organizationId: string,
  client: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>,
) {
  const { data, error } = await client
    .from("price_book_items")
    .select(ITEM_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("category")
    .order("name");
  if (error) throw new Error(`Failed to load price book: ${error.message}`);
  return ((data ?? []) as ItemRow[]).map(toItem);
}

// ---------- documents ----------

type DetectedType = "application/pdf" | "text/plain" | "text/csv" | "image/jpeg" | "image/png" | "image/webp";

// Checks the actual file contents, not the browser-reported type.
async function detectType(file: File, bytes: Buffer): Promise<DetectedType | null> {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  try {
    const { format } = await sharp(bytes).metadata();
    if (format === "jpeg") return "image/jpeg";
    if (format === "png") return "image/png";
    if (format === "webp") return "image/webp";
  } catch {
    // Not an image; check for text below.
  }
  const text = bytes.toString("utf8");
  // Text files decode cleanly and have no NUL bytes.
  if (!text.includes("�") && !text.includes("\u0000")) {
    return file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "text/plain";
  }
  return null;
}

export async function storePriceDocument(
  organizationId: string,
  userId: string,
  file: File,
): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > PRICE_DOCUMENT_MAX_BYTES) {
    return { ok: false, error: "Choose a file smaller than 10 MB." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = await detectType(file, bytes);
  if (!type) {
    return {
      ok: false,
      error: "Use a PDF, a text or CSV file, or a photo of your price list. For Word files, save as PDF first.",
    };
  }

  const admin = createAdminClient();
  const id = randomUUID();
  const path = `${organizationId}/${id}`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "We couldn't save that file. Please try again." };

  const { error } = await admin.from("price_documents").insert({
    id,
    organization_id: organizationId,
    file_name: file.name.slice(0, 200) || "Document",
    storage_path: path,
    mime_type: type,
    size_bytes: file.size,
    uploaded_by: userId,
  });
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: "We couldn't save that file. Please try again." };
  }
  return { ok: true, documentId: id };
}

async function documentBlock(type: string, bytes: Buffer): Promise<Anthropic.Beta.BetaContentBlockParam> {
  if (type === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } };
  }
  if (type.startsWith("image/")) {
    // Downscaled so a phone photo of a price sheet stays a reasonable size.
    const image = await sharp(bytes).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).webp().toBuffer();
    return { type: "image", source: { type: "base64", media_type: "image/webp", data: image.toString("base64") } };
  }
  return { type: "document", source: { type: "text", media_type: "text/plain", data: bytes.toString("utf8") } };
}

// Runs in the background after upload. Suggestions are only stored, never
// activated; the contractor reviews each one.
export async function extractPriceDocument(documentId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("price_documents")
    .select("id, organization_id, storage_path, mime_type, status")
    .eq("id", documentId)
    .maybeSingle<{ id: string; organization_id: string; storage_path: string; mime_type: string; status: string }>();
  if (!doc || doc.status !== "processing") return;

  const fail = (code: string) =>
    admin.from("price_documents").update({ status: "failed", error_code: code }).eq("id", doc.id);

  try {
    const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(doc.storage_path);
    if (downloadError || !file) return void (await fail("download_failed"));
    const block = await documentBlock(doc.mime_type, Buffer.from(await file.arrayBuffer()));

    const result = await callStructured({
      kind: "price_extraction",
      scope: { organizationId: doc.organization_id, serviceRequestId: null },
      promptVersion: PRICE_EXTRACTION_PROMPT_VERSION,
      system: PRICE_EXTRACTION_SYSTEM,
      content: [block, { type: "text", text: "Extract the price-book items from this document." }],
      schema: priceExtractionSchema,
      effort: "medium",
    });
    if (!result.ok) return void (await fail(result.code));

    // Skip items the price book already has (by name), so re-uploading a
    // document doesn't duplicate suggestions.
    const { data: existing } = await admin
      .from("price_book_items")
      .select("name")
      .eq("organization_id", doc.organization_id)
      .neq("status", "archived");
    const seen = new Set(((existing ?? []) as { name: string }[]).map((r) => r.name.trim().toLowerCase()));

    const rows = result.data.items.flatMap((item) => {
      const name = item.name.trim().slice(0, 120);
      if (!name || seen.has(name.toLowerCase())) return [];
      seen.add(name.toLowerCase());
      let low = toMinor(item.price_low);
      let high = toMinor(item.price_high);
      low ??= high;
      high ??= low;
      if (low !== null && high !== null && low > high) [low, high] = [high, low];
      return [{
        organization_id: doc.organization_id,
        name,
        description: item.customer_description.trim().slice(0, 300) || null,
        category: item.category,
        unit: item.unit,
        price_low_minor: low,
        price_high_minor: high,
        status: "suggested",
        source_document_id: doc.id,
        source_note: item.source_quote?.trim().slice(0, 300) || null,
      }];
    }).slice(0, MAX_SUGGESTIONS_PER_DOCUMENT);

    if (rows.length) {
      const { error } = await admin.from("price_book_items").insert(rows);
      if (error) return void (await fail("store_failed"));
    }
    await admin
      .from("price_documents")
      .update({
        status: "succeeded",
        items_found: rows.length,
        notes: result.data.notes.map((n) => n.trim().slice(0, 300)).filter(Boolean).slice(0, 20),
      })
      .eq("id", doc.id);
  } catch (error) {
    console.error("Price extraction failed", error instanceof Error ? error.message : "unknown");
    await fail("unexpected");
  }
}

// ---------- starter template ----------

// Common HVAC items without prices: the contractor must price each one
// before it can be used (spec B8).
export const HVAC_TEMPLATE: { name: string; description: string; category: PriceCategory; unit: PriceUnit }[] = [
  { name: "Service call / diagnostic", description: "Visit to inspect the system and find the problem.", category: "service_fee", unit: "flat" },
  { name: "HVAC labor", description: "Technician labor.", category: "labor", unit: "hour" },
  { name: "Capacitor replacement", description: "Replace a failed start or run capacitor.", category: "repair", unit: "flat" },
  { name: "Contactor replacement", description: "Replace the outdoor unit's contactor.", category: "repair", unit: "flat" },
  { name: "Condensate drain clearing", description: "Clear a clogged condensate drain line.", category: "repair", unit: "flat" },
  { name: "Refrigerant recharge", description: "Add refrigerant after checking for leaks.", category: "repair", unit: "each" },
  { name: "Blower motor replacement", description: "Replace the indoor blower motor.", category: "repair", unit: "flat" },
  { name: "Thermostat replacement", description: "Install a new thermostat.", category: "repair", unit: "flat" },
  { name: "Air filter", description: "Replacement air filter.", category: "part", unit: "each" },
  { name: "Seasonal tune-up", description: "Clean and check the system for the season.", category: "repair", unit: "flat" },
];
