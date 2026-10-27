"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { parseMoney } from "@/lib/money";
import { extractPriceDocument, HVAC_TEMPLATE, storePriceDocument } from "@/lib/price-book";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canManageWorkspace, requireWorkspace } from "@/lib/workspace";

const PATH = "/app/settings/price-book";
const NOT_ALLOWED = { error: "Only owners and admins can change the price book." };

async function requireManager() {
  const { user, workspace } = await requireWorkspace();
  return canManageWorkspace(workspace) ? { user, workspace } : null;
}

export type UploadState = { error?: string; uploaded?: string };

// Stores the document, then has the AI read it after the response. The
// document's status shows progress; suggestions appear when it's done.
export async function uploadPriceDocument(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const auth = await requireManager();
  if (!auth) return NOT_ALLOWED;
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };

  const result = await storePriceDocument(auth.workspace.id, auth.user.id, file);
  if (!result.ok) return { error: result.error };
  after(() => extractPriceDocument(result.documentId));
  revalidatePath(PATH);
  return { uploaded: file.name };
}

export async function retryPriceDocument(documentId: string) {
  const auth = await requireManager();
  if (!auth) return NOT_ALLOWED;
  const { data } = await createAdminClient()
    .from("price_documents")
    .update({ status: "processing", error_code: null })
    .eq("id", documentId)
    .eq("organization_id", auth.workspace.id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  if (!data) return { error: "That document can’t be retried." };
  after(() => extractPriceDocument(documentId));
  revalidatePath(PATH);
  return {};
}

const itemSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  name: z.string().trim().min(1, { error: "Enter a name." }).max(120, { error: "Keep the name under 120 characters." }),
  description: z.string().trim().max(300, { error: "Keep the description under 300 characters." }),
  category: z.enum(["service_fee", "labor", "repair", "part"], { error: "Choose a category." }),
  unit: z.enum(["each", "hour", "flat"], { error: "Choose a unit." }),
  priceLow: z.string(),
  priceHigh: z.string(),
  // "save" keeps a suggestion a suggestion; "activate" approves it.
  intent: z.enum(["save", "activate"]),
});

export type ItemFormState = { error?: string; saved?: boolean };

export async function savePriceItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const auth = await requireManager();
  if (!auth) return NOT_ALLOWED;
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the item and try again." };
  const data = parsed.data;

  let low = data.priceLow.trim() ? parseMoney(data.priceLow) : null;
  let high = data.priceHigh.trim() ? parseMoney(data.priceHigh) : null;
  if ((data.priceLow.trim() && low === null) || (data.priceHigh.trim() && high === null)) {
    return { error: "Enter prices as numbers, like 89 or 89.50." };
  }
  // One price is a fixed price.
  low ??= high;
  high ??= low;
  if (low !== null && high !== null && low > high) return { error: "The low price is higher than the high price." };

  const supabase = await createClient();
  const existing = data.id
    ? await supabase
        .from("price_book_items")
        .select("status")
        .eq("id", data.id)
        .eq("organization_id", auth.workspace.id)
        .maybeSingle<{ status: string }>()
    : null;
  if (data.id && !existing?.data) return { error: "This item no longer exists." };

  const status =
    data.intent === "activate" || !existing ? "active" : (existing.data!.status as "suggested" | "active" | "archived");
  if (status === "active" && (low === null || high === null)) {
    return { error: "Add a price before using this item." };
  }

  const row = {
    name: data.name,
    description: data.description || null,
    category: data.category,
    unit: data.unit,
    price_low_minor: low,
    price_high_minor: high,
    status,
  };
  // RLS limits both to owners and admins of this workspace.
  const { error } = data.id
    ? await supabase.from("price_book_items").update(row).eq("id", data.id).eq("organization_id", auth.workspace.id)
    : await supabase
        .from("price_book_items")
        .insert({ ...row, organization_id: auth.workspace.id, created_by: auth.user.id });
  if (error) return { error: "We couldn’t save that item. Please try again." };

  revalidatePath(PATH);
  return { saved: true };
}

// Approves every suggestion that already has a price.
export async function approvePricedSuggestions() {
  const auth = await requireManager();
  if (!auth) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("price_book_items")
    .update({ status: "active" })
    .eq("organization_id", auth.workspace.id)
    .eq("status", "suggested")
    .not("price_low_minor", "is", null)
    .not("price_high_minor", "is", null);
  if (error) return { error: "We couldn’t approve the suggestions. Please try again." };
  revalidatePath(PATH);
  return {};
}

export async function setPriceItemStatus(itemId: string, status: "active" | "archived") {
  const auth = await requireManager();
  if (!auth) return NOT_ALLOWED;
  const supabase = await createClient();
  // Archiving never changes existing estimates: their lines keep a copy of
  // the price (spec B8).
  const { error } = await supabase
    .from("price_book_items")
    .update({ status })
    .eq("id", itemId)
    .eq("organization_id", auth.workspace.id)
    .neq("status", "suggested");
  if (error) {
    return { error: status === "active" ? "Couldn’t restore it. Check it has a price." : "Couldn’t archive it." };
  }
  revalidatePath(PATH);
  return {};
}

export async function deleteSuggestion(itemId: string) {
  const auth = await requireManager();
  if (!auth) return NOT_ALLOWED;
  const supabase = await createClient();
  await supabase
    .from("price_book_items")
    .delete()
    .eq("id", itemId)
    .eq("organization_id", auth.workspace.id)
    .eq("status", "suggested");
  revalidatePath(PATH);
  return {};
}

// Adds the HVAC starter items as unpriced suggestions to review.
export async function addStarterTemplate() {
  const auth = await requireManager();
  if (!auth) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("price_book_items")
    .select("name")
    .eq("organization_id", auth.workspace.id)
    .neq("status", "archived");
  const names = new Set(((existing ?? []) as { name: string }[]).map((r) => r.name.toLowerCase()));
  const rows = HVAC_TEMPLATE.filter((item) => !names.has(item.name.toLowerCase())).map((item) => ({
    ...item,
    organization_id: auth.workspace.id,
    status: "suggested",
    created_by: auth.user.id,
  }));
  if (rows.length) {
    const { error } = await supabase.from("price_book_items").insert(rows);
    if (error) return { error: "We couldn’t add the starter items. Please try again." };
  }
  revalidatePath(PATH);
  return {};
}
