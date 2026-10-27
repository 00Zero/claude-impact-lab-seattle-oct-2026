import "server-only";
import { z } from "zod";
import { AI_MODEL, callStructured } from "@/lib/ai/client";
import { ESTIMATE_PROMPT_VERSION, ESTIMATE_SYSTEM, estimateSchema } from "@/lib/ai/prompts/estimate";
import {
  currentQuestions,
  labelMap,
  latestAnswers,
  loadPhotos,
  mapLabels,
  REQUEST_COLUMNS,
  requestContext,
  resolveIntake,
  type RequestRow,
  type StoredBrief,
} from "@/lib/intake-ai";
import { estimateTotals, lineRange, type PricedInput } from "@/lib/estimate-math";
import { formatAnswer } from "@/lib/intake-questions";
import { parseMoney } from "@/lib/money";
import { activePriceBookItems, type PriceBookItem } from "@/lib/price-book";
import type { PriceUnit } from "@/lib/price-book-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Estimates (spec §6 stage 5, B9, C10). The model picks price-book items and
// quantities without ever seeing prices; this module copies unit prices
// from the price book and calculates every total. Contractors edit drafts,
// then approve and release them; customers only ever see a released one.

const MAX_LINES = 20;
const MAX_QUANTITY = 999;
const STALE_JOB_MS = 10 * 60 * 1000;

export type EstimateStatus = "draft" | "approved" | "released" | "superseded";

export type EstimateLine = {
  id: string;
  priceBookItemId: string | null;
  description: string;
  quantityLow: number;
  quantityHigh: number;
  unit: PriceUnit;
  unitPriceLowMinor: number | null;
  unitPriceHighMinor: number | null;
  aiReason: string | null;
  evidencePhotoIds: string[];
  evidenceQuestionIds: string[];
  contractorEdited: boolean;
};

export type Estimate = {
  id: string;
  version: number;
  status: EstimateStatus;
  briefVersion: number | null;
  currency: string;
  totalLowMinor: number;
  totalHighMinor: number;
  unpricedLines: number;
  assumptions: string[];
  exclusions: string[];
  draftedByAi: boolean;
  createdAt: string;
  approvedAt: string | null;
  releasedAt: string | null;
  lines: EstimateLine[];
};

// ---------- pricing (server-calculated, never by the model) ----------

function totals(lines: PricedInput[]) {
  const { low, high, unpriced } = estimateTotals(lines);
  return { total_low_minor: low, total_high_minor: high, unpriced_lines: unpriced };
}

function cleanQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.round(value * 100) / 100, 0.25), MAX_QUANTITY);
}

// ---------- readiness ----------

export type EstimateReadiness =
  | { ready: true }
  | { ready: false; reason: "disabled" | "no_items" | "no_service_fee" };

export async function estimateReadiness(organizationId: string): Promise<EstimateReadiness> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("estimates_enabled")
    .eq("id", organizationId)
    .single<{ estimates_enabled: boolean }>();
  if (!org?.estimates_enabled) return { ready: false, reason: "disabled" };
  const items = await activePriceBookItems(organizationId, admin);
  if (items.length === 0) return { ready: false, reason: "no_items" };
  // Spec B8: a service-call or diagnostic fee is required before drafting.
  if (!items.some((i) => i.category === "service_fee")) return { ready: false, reason: "no_service_fee" };
  return { ready: true };
}

// ---------- drafting ----------

async function latestBrief(requestId: string, client: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>) {
  const { data } = await client
    .from("ai_briefs")
    .select("id, version, brief")
    .eq("service_request_id", requestId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; version: number; brief: StoredBrief }>();
  return data;
}

async function createEstimateJob(organizationId: string, requestId: string, briefVersion: number) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("processing_jobs")
    .select("id", { count: "exact", head: true })
    .eq("service_request_id", requestId)
    .eq("kind", "estimate");
  const { data, error } = await admin
    .from("processing_jobs")
    .insert({
      organization_id: organizationId,
      service_request_id: requestId,
      kind: "estimate",
      input_revision: briefVersion,
      idempotency_key: `estimate:${requestId}:${briefVersion}:${(count ?? 0) + 1}`,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("Failed to create estimate job", error?.message);
    return null;
  }
  return data.id;
}

// Called at the end of a successful brief job. Skips quietly when the
// workspace doesn't use estimates or the price book isn't ready; the
// request page then explains what to set up.
export async function draftEstimateAfterBrief(organizationId: string, requestId: string) {
  const readiness = await estimateReadiness(organizationId);
  if (!readiness.ready) return;
  const brief = await latestBrief(requestId, createAdminClient());
  if (!brief) return;
  const jobId = await createEstimateJob(organizationId, requestId, brief.version);
  if (jobId) await runEstimateJob(jobId);
}

function briefText(brief: StoredBrief, photoLabels: Map<string, string>, questionLabels: Map<string, string>) {
  const p = (ids: string[]) => ids.map((id) => photoLabels.get(id)).filter(Boolean).join(", ");
  const q = (ids: string[]) => ids.map((id) => questionLabels.get(id)).filter(Boolean).join(", ");
  const lines = [`Summary: ${brief.summary}`];
  if (brief.urgent_concern) lines.push(`Possible safety concern: ${brief.urgent_concern}`);
  for (const r of brief.customer_reported) lines.push(`Customer reported: <customer_input>${r.fact}</customer_input> ${q(r.question_ids)}`);
  for (const o of brief.visual_observations) lines.push(`Visible: ${o.observation} (${p(o.photo_ids)})`);
  for (const e of brief.equipment) {
    lines.push(`Equipment: ${e.description}; make ${e.make ?? "unknown"}; model ${e.model ?? "unknown"} (${p(e.photo_ids)})`);
  }
  if (brief.symptom_timeline) lines.push(`Timeline: ${brief.symptom_timeline}`);
  for (const e of brief.possible_explanations) lines.push(`Possible cause (unconfirmed): ${e.explanation}`);
  for (const u of brief.unresolved_questions) lines.push(`Still unknown: ${u}`);
  return lines.join("\n");
}

function priceBookText(items: PriceBookItem[]) {
  // Names, descriptions, categories and units only. No prices (spec §6).
  return items
    .map((item, i) => `E${i + 1}. ${item.name}${item.description ? ` — ${item.description}` : ""} (category: ${item.category}, unit: ${item.unit})`)
    .join("\n");
}

export async function runEstimateJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("processing_jobs")
    .select("id, organization_id, service_request_id, status, attempts, updated_at")
    .eq("id", jobId)
    .eq("kind", "estimate")
    .maybeSingle<{ id: string; organization_id: string; service_request_id: string; status: string; attempts: number; updated_at: string }>();
  if (!job) return;
  const stale = job.status === "running" && Date.now() - new Date(job.updated_at).getTime() > STALE_JOB_MS;
  if (job.status === "succeeded" || (job.status === "running" && !stale) || job.attempts >= 3) return;

  const { data: claimed } = await admin
    .from("processing_jobs")
    .update({ status: "running", attempts: job.attempts + 1, error_code: null })
    .eq("id", job.id)
    .eq("status", job.status)
    .eq("attempts", job.attempts)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const fail = (code: string) =>
    admin.from("processing_jobs").update({ status: "failed", error_code: code }).eq("id", job.id);

  try {
    const [{ data: request }, { data: org }, brief, items, photos] = await Promise.all([
      admin.from("service_requests").select(REQUEST_COLUMNS).eq("id", job.service_request_id).single<RequestRow>(),
      admin.from("organizations").select("currency").eq("id", job.organization_id).single<{ currency: string }>(),
      latestBrief(job.service_request_id, admin),
      activePriceBookItems(job.organization_id, admin),
      loadPhotos(job.service_request_id),
    ]);
    if (!request || !org || !brief) return void (await fail("missing_input"));
    if (!items.some((i) => i.category === "service_fee")) return void (await fail("no_service_fee"));

    const questions = await currentQuestions(request.id, admin);
    const answers = await latestAnswers(questions.map((q) => q.id), admin);
    // Labels the model sees, and the reverse maps used to validate output.
    const photoLabels = new Map(photos.map((ph, i) => [ph.id, `P${i + 1}`]));
    const questionLabels = new Map(questions.map((q, i) => [q.id, `Q${i + 1}`]));
    const itemLabels = labelMap(items.map((i) => i.id), "E");
    const photoIds = labelMap(photos.map((ph) => ph.id), "P");
    const questionIds = labelMap(questions.map((q) => q.id), "Q");

    const qa = questions
      .map((q, i) => `Q${i + 1}. ${q.label}\nAnswer: <customer_input>${formatAnswer(answers[q.id])}</customer_input>`)
      .join("\n");

    const result = await callStructured({
      kind: "estimate",
      scope: { organizationId: job.organization_id, serviceRequestId: request.id },
      promptVersion: ESTIMATE_PROMPT_VERSION,
      system: ESTIMATE_SYSTEM,
      content: [
        { type: "text", text: requestContext(request) },
        { type: "text", text: `Service brief:\n${briefText(brief.brief, photoLabels, questionLabels)}` },
        { type: "text", text: qa ? `Customer answers:\n${qa}` : "No answers." },
        { type: "text", text: `Price book:\n${priceBookText(items)}` },
      ],
      schema: estimateSchema,
      effort: "medium",
    });
    if (!result.ok) return void (await fail(result.code));

    const byId = new Map(items.map((i) => [i.id, i]));
    const used = new Set<string>();
    const lines = result.data.lines.flatMap((line) => {
      const itemId = line.item ? itemLabels.get(line.item.trim().toUpperCase()) : undefined;
      const item = itemId ? byId.get(itemId) : undefined;
      if (item && used.has(item.id)) return [];
      if (item) used.add(item.id);
      const description = (line.description.trim() || item?.description || item?.name || "").slice(0, 300);
      if (!description) return [];
      let low = cleanQuantity(line.quantity_low);
      let high = cleanQuantity(line.quantity_high);
      if (low > high) [low, high] = [high, low];
      return [{
        price_book_item_id: item?.id ?? null,
        description,
        quantity_low: low,
        quantity_high: high,
        unit: item?.unit ?? "each",
        // Copied now so later price-book edits don't change this estimate.
        unit_price_low_minor: item?.priceLowMinor ?? null,
        unit_price_high_minor: item?.priceHighMinor ?? null,
        ai_reason: line.reason.trim().slice(0, 500) || null,
        evidence_photo_ids: mapLabels(line.evidence_photos, photoIds),
        evidence_question_ids: mapLabels(line.evidence_answers, questionIds),
      }];
    });

    // Every estimate carries the service-call fee (spec B8).
    if (!lines.some((l) => l.price_book_item_id && byId.get(l.price_book_item_id)?.category === "service_fee")) {
      const fee = items.find((i) => i.category === "service_fee")!;
      lines.unshift({
        price_book_item_id: fee.id,
        description: fee.description || fee.name,
        quantity_low: 1,
        quantity_high: 1,
        unit: fee.unit,
        unit_price_low_minor: fee.priceLowMinor,
        unit_price_high_minor: fee.priceHighMinor,
        ai_reason: "Standard service call fee.",
        evidence_photo_ids: [],
        evidence_question_ids: [],
      });
    }
    const kept = lines.slice(0, MAX_LINES);

    const estimateId = await insertEstimate({
      organizationId: job.organization_id,
      requestId: request.id,
      currency: org.currency,
      brief: { id: brief.id, version: brief.version },
      assumptions: result.data.assumptions,
      exclusions: result.data.exclusions,
      lines: kept,
      ai: true,
      userId: null,
    });
    if (!estimateId) return void (await fail("store_failed"));
    await admin.from("processing_jobs").update({ status: "succeeded" }).eq("id", job.id);
  } catch (error) {
    console.error("Estimate job failed", error instanceof Error ? error.message : "unknown");
    await fail("unexpected");
  }
}

type LineRow = {
  price_book_item_id: string | null;
  description: string;
  quantity_low: number;
  quantity_high: number;
  unit: PriceUnit;
  unit_price_low_minor: number | null;
  unit_price_high_minor: number | null;
  ai_reason: string | null;
  evidence_photo_ids: string[];
  evidence_question_ids: string[];
  contractor_edited?: boolean;
  edited_by?: string | null;
  edited_at?: string | null;
};

const cleanList = (items: string[]) => items.map((s) => s.trim().slice(0, 200)).filter(Boolean).slice(0, 10);

// Inserts a new draft version. Earlier drafts are superseded so only one
// draft is open at a time; approved and released versions are never touched.
async function insertEstimate(input: {
  organizationId: string;
  requestId: string;
  currency: string;
  brief: { id: string; version: number } | null;
  assumptions: string[];
  exclusions: string[];
  lines: LineRow[];
  ai: boolean;
  userId: string | null;
}) {
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("estimates")
    .select("version")
    .eq("service_request_id", input.requestId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>();

  await admin.from("estimates").update({ status: "superseded" }).eq("service_request_id", input.requestId).eq("status", "draft");

  const sums = totals(
    input.lines.map((l) => ({
      quantityLow: l.quantity_low,
      quantityHigh: l.quantity_high,
      unitPriceLowMinor: l.unit_price_low_minor,
      unitPriceHighMinor: l.unit_price_high_minor,
    })),
  );
  const { data: estimate, error } = await admin
    .from("estimates")
    .insert({
      organization_id: input.organizationId,
      service_request_id: input.requestId,
      version: (last?.version ?? 0) + 1,
      brief_id: input.brief?.id ?? null,
      brief_version: input.brief?.version ?? null,
      status: "draft",
      currency: input.currency,
      ...sums,
      assumptions: cleanList(input.assumptions),
      exclusions: cleanList(input.exclusions),
      model: input.ai ? AI_MODEL : null,
      prompt_version: input.ai ? ESTIMATE_PROMPT_VERSION : null,
      created_by: input.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !estimate) return null;

  if (input.lines.length) {
    const { error: lineError } = await admin.from("estimate_line_items").insert(
      input.lines.map((line, position) => ({ ...line, organization_id: input.organizationId, estimate_id: estimate.id, position })),
    );
    if (lineError) {
      await admin.from("estimates").delete().eq("id", estimate.id);
      return null;
    }
  }
  return estimate.id;
}

// ---------- contractor ----------

type EstimateRow = {
  id: string;
  version: number;
  status: EstimateStatus;
  brief_version: number | null;
  currency: string;
  total_low_minor: number;
  total_high_minor: number;
  unpriced_lines: number;
  assumptions: string[];
  exclusions: string[];
  model: string | null;
  created_at: string;
  approved_at: string | null;
  released_at: string | null;
  estimate_line_items: (LineRow & { id: string; position: number; contractor_edited: boolean })[];
};

const ESTIMATE_COLUMNS =
  "id, version, status, brief_version, currency, total_low_minor, total_high_minor, unpriced_lines, assumptions, exclusions, model, created_at, approved_at, released_at, estimate_line_items (id, position, price_book_item_id, description, quantity_low, quantity_high, unit, unit_price_low_minor, unit_price_high_minor, ai_reason, evidence_photo_ids, evidence_question_ids, contractor_edited)";

function toEstimate(row: EstimateRow): Estimate {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    briefVersion: row.brief_version,
    currency: row.currency,
    totalLowMinor: row.total_low_minor,
    totalHighMinor: row.total_high_minor,
    unpricedLines: row.unpriced_lines,
    assumptions: row.assumptions ?? [],
    exclusions: row.exclusions ?? [],
    draftedByAi: row.model !== null,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    releasedAt: row.released_at,
    lines: [...row.estimate_line_items]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        id: l.id,
        priceBookItemId: l.price_book_item_id,
        description: l.description,
        quantityLow: Number(l.quantity_low),
        quantityHigh: Number(l.quantity_high),
        unit: l.unit,
        unitPriceLowMinor: l.unit_price_low_minor,
        unitPriceHighMinor: l.unit_price_high_minor,
        aiReason: l.ai_reason,
        evidencePhotoIds: l.evidence_photo_ids ?? [],
        evidenceQuestionIds: l.evidence_question_ids ?? [],
        contractorEdited: l.contractor_edited,
      })),
  };
}

export type RequestEstimates = {
  estimates: Estimate[];
  job: { status: string; stale: boolean; errorCode: string | null } | null;
  latestBriefVersion: number | null;
  readiness: EstimateReadiness;
  priceBook: PriceBookItem[];
};

// Read through RLS with the contractor's own session.
export async function getRequestEstimates(organizationId: string, requestId: string): Promise<RequestEstimates> {
  const supabase = await createClient();
  const [{ data: rows, error }, { data: job }, brief, readiness, priceBook] = await Promise.all([
    supabase
      .from("estimates")
      .select(ESTIMATE_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("service_request_id", requestId)
      .order("version", { ascending: false }),
    supabase
      .from("processing_jobs")
      .select("status, error_code, updated_at")
      .eq("organization_id", organizationId)
      .eq("service_request_id", requestId)
      .eq("kind", "estimate")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string; error_code: string | null; updated_at: string }>(),
    latestBrief(requestId, supabase),
    estimateReadiness(organizationId),
    activePriceBookItems(organizationId, supabase),
  ]);
  if (error) throw new Error(`Failed to load estimates: ${error.message}`);
  return {
    estimates: ((rows ?? []) as EstimateRow[]).map(toEstimate),
    job: job
      ? {
          status: job.status,
          stale: (job.status === "running" || job.status === "pending") && Date.now() - new Date(job.updated_at).getTime() > STALE_JOB_MS,
          errorCode: job.error_code,
        }
      : null,
    latestBriefVersion: brief?.version ?? null,
    readiness,
    priceBook,
  };
}

async function ownEstimate(organizationId: string, estimateId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("estimates")
    .select(ESTIMATE_COLUMNS + ", service_request_id")
    .eq("organization_id", organizationId)
    .eq("id", estimateId)
    .maybeSingle<EstimateRow & { service_request_id: string }>();
  return data;
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Manual regeneration from the latest brief (B9).
export async function startEstimateRegeneration(organizationId: string, requestId: string): Promise<ActionResult<{ jobId: string }>> {
  const readiness = await estimateReadiness(organizationId);
  if (!readiness.ready) {
    return {
      ok: false,
      error:
        readiness.reason === "disabled"
          ? "Turn on estimates in Business settings first."
          : "Add a priced service call fee to your price book first.",
    };
  }
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Request not found." };
  const brief = await latestBrief(requestId, supabase);
  if (!brief) return { ok: false, error: "An estimate needs a service brief first." };
  const jobId = await createEstimateJob(organizationId, requestId, brief.version);
  return jobId ? { ok: true, jobId } : { ok: false, error: "Couldn’t start a new estimate. Please try again." };
}

const editSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        priceBookItemId: z.uuid().nullable(),
        description: z.string().trim().min(1, { error: "Each line needs a description." }).max(300),
        quantityLow: z.number().min(0.25, { error: "Quantities must be at least 0.25." }).max(MAX_QUANTITY),
        quantityHigh: z.number().min(0.25).max(MAX_QUANTITY),
        unit: z.enum(["each", "hour", "flat"]),
        unitPriceLow: z.string().max(20),
        unitPriceHigh: z.string().max(20),
      }),
    )
    .max(MAX_LINES, { error: `An estimate can have up to ${MAX_LINES} lines.` }),
  assumptions: z.array(z.string().max(200)).max(10),
  exclusions: z.array(z.string().max(200)).max(10),
});

export type EstimateEdit = z.infer<typeof editSchema>;

// Saves a contractor's changes to a draft. Edited lines are marked with
// author and time; the AI's reason and evidence stay with unchanged lines.
export async function saveEstimateDraft(
  organizationId: string,
  userId: string,
  estimateId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the estimate and try again." };
  const estimate = await ownEstimate(organizationId, estimateId);
  if (!estimate) return { ok: false, error: "Estimate not found." };
  if (estimate.status !== "draft") return { ok: false, error: "Only drafts can be edited. Create a new version to make changes." };

  const supabase = await createClient();
  const itemIds = parsed.data.lines.map((l) => l.priceBookItemId).filter((id): id is string => !!id);
  if (itemIds.length) {
    const { data: owned } = await supabase
      .from("price_book_items")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", itemIds);
    if ((owned ?? []).length !== new Set(itemIds).size) return { ok: false, error: "A price-book item is no longer available." };
  }

  const previous = new Map(estimate.estimate_line_items.map((l) => [l.id, l]));
  const now = new Date().toISOString();
  const lines: LineRow[] = [];
  for (const line of parsed.data.lines) {
    let low = line.unitPriceLow.trim() ? parseMoney(line.unitPriceLow) : null;
    let high = line.unitPriceHigh.trim() ? parseMoney(line.unitPriceHigh) : null;
    if ((line.unitPriceLow.trim() && low === null) || (line.unitPriceHigh.trim() && high === null)) {
      return { ok: false, error: `Check the price on “${line.description}”.` };
    }
    // One price is a fixed price, same as in the editor.
    low ??= high;
    high ??= low;
    if (low !== null && high !== null && low > high) {
      return { ok: false, error: `The low price on “${line.description}” is higher than the high price.` };
    }
    const quantityLow = Math.min(line.quantityLow, line.quantityHigh);
    const quantityHigh = Math.max(line.quantityLow, line.quantityHigh);
    const before = line.id ? previous.get(line.id) : undefined;
    const changed =
      !before ||
      before.description !== line.description ||
      Number(before.quantity_low) !== quantityLow ||
      Number(before.quantity_high) !== quantityHigh ||
      before.unit !== line.unit ||
      before.unit_price_low_minor !== low ||
      before.unit_price_high_minor !== high ||
      before.price_book_item_id !== line.priceBookItemId;
    lines.push({
      price_book_item_id: line.priceBookItemId,
      description: line.description,
      quantity_low: quantityLow,
      quantity_high: quantityHigh,
      unit: line.unit,
      unit_price_low_minor: low,
      unit_price_high_minor: high,
      ai_reason: before?.ai_reason ?? null,
      evidence_photo_ids: before?.evidence_photo_ids ?? [],
      evidence_question_ids: before?.evidence_question_ids ?? [],
      contractor_edited: changed || (before?.contractor_edited ?? false),
      edited_by: changed ? userId : null,
      edited_at: changed ? now : null,
    });
  }

  const admin = createAdminClient();
  // Replace the draft's lines, then its totals. The draft is checked again
  // in the update so a concurrent approval can't be overwritten.
  const { data: still } = await admin
    .from("estimates")
    .update({
      ...totals(lines.map((l) => ({ quantityLow: l.quantity_low, quantityHigh: l.quantity_high, unitPriceLowMinor: l.unit_price_low_minor, unitPriceHighMinor: l.unit_price_high_minor }))),
      assumptions: cleanList(parsed.data.assumptions),
      exclusions: cleanList(parsed.data.exclusions),
    })
    .eq("id", estimateId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (!still) return { ok: false, error: "This estimate was approved in the meantime. Refresh the page." };
  await admin.from("estimate_line_items").delete().eq("estimate_id", estimateId);
  if (lines.length) {
    const { error } = await admin
      .from("estimate_line_items")
      .insert(lines.map((line, position) => ({ ...line, organization_id: organizationId, estimate_id: estimateId, position })));
    if (error) return { ok: false, error: "Your changes didn’t save. Please try again." };
  }
  return { ok: true };
}

// Approved and released estimates never change (B9); this copies one into
// a new draft version to edit.
export async function newEstimateVersion(organizationId: string, userId: string, estimateId: string): Promise<ActionResult> {
  const estimate = await ownEstimate(organizationId, estimateId);
  if (!estimate) return { ok: false, error: "Estimate not found." };
  const supabase = await createClient();
  const brief = await latestBrief(estimate.service_request_id, supabase);
  const id = await insertEstimate({
    organizationId,
    requestId: estimate.service_request_id,
    currency: estimate.currency,
    brief: brief ? { id: brief.id, version: brief.version } : null,
    assumptions: estimate.assumptions,
    exclusions: estimate.exclusions,
    lines: [...estimate.estimate_line_items]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        price_book_item_id: l.price_book_item_id,
        description: l.description,
        quantity_low: Number(l.quantity_low),
        quantity_high: Number(l.quantity_high),
        unit: l.unit,
        unit_price_low_minor: l.unit_price_low_minor,
        unit_price_high_minor: l.unit_price_high_minor,
        ai_reason: l.ai_reason,
        evidence_photo_ids: l.evidence_photo_ids,
        evidence_question_ids: l.evidence_question_ids,
        contractor_edited: l.contractor_edited,
      })),
    ai: false,
    userId,
  });
  return id ? { ok: true } : { ok: false, error: "Couldn’t create a new version. Please try again." };
}

const RPC_ERRORS: Record<string, string> = {
  not_allowed: "Only owners and admins can approve or release estimates.",
  not_draft: "Only drafts can be approved.",
  unpriced_lines: "Every line needs a price before you can approve.",
  no_lines: "Add at least one line before approving.",
  not_approved: "Approve the estimate before releasing it.",
  no_active_link: "The customer’s link has expired or was revoked. Create a new link on this request first.",
};

export async function approveEstimate(estimateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_estimate", { p_estimate_id: estimateId });
  return error ? { ok: false, error: RPC_ERRORS[error.message] ?? "Couldn’t approve the estimate." } : { ok: true };
}

export async function releaseEstimate(estimateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_estimate", { p_estimate_id: estimateId });
  return error ? { ok: false, error: RPC_ERRORS[error.message] ?? "Couldn’t release the estimate." } : { ok: true };
}

// ---------- customer (C10) ----------

export type ReleasedEstimate = {
  currency: string;
  totalLowMinor: number;
  totalHighMinor: number;
  lines: { description: string; quantityLow: number; quantityHigh: number; unit: PriceUnit; lowMinor: number; highMinor: number }[];
  assumptions: string[];
  exclusions: string[];
  releasedAt: string;
  replacesEarlier: boolean;
};

// The latest released estimate for a valid link, as a customer-visible
// projection: no AI reasons, evidence, drafts, or price-book records.
export async function getReleasedEstimate(token: string): Promise<ReleasedEstimate | null> {
  const request = await resolveIntake(token);
  if (!request) return null;
  const admin = createAdminClient();
  const [{ data: row }, { count: earlier }] = await Promise.all([
    admin
      .from("estimates")
      .select(ESTIMATE_COLUMNS)
      .eq("service_request_id", request.id)
      .eq("status", "released")
      .limit(1)
      .maybeSingle<EstimateRow>(),
    admin
      .from("estimates")
      .select("id", { count: "exact", head: true })
      .eq("service_request_id", request.id)
      .eq("status", "superseded")
      .not("released_at", "is", null),
  ]);
  if (!row?.released_at) return null;
  const estimate = toEstimate(row);
  return {
    currency: estimate.currency,
    totalLowMinor: estimate.totalLowMinor,
    totalHighMinor: estimate.totalHighMinor,
    lines: estimate.lines.flatMap((l) => {
      const range = lineRange(l);
      return range
        ? [{ description: l.description, quantityLow: l.quantityLow, quantityHigh: l.quantityHigh, unit: l.unit, lowMinor: range.low, highMinor: range.high }]
        : [];
    }),
    assumptions: estimate.assumptions,
    exclusions: estimate.exclusions,
    releasedAt: row.released_at,
    replacesEarlier: (earlier ?? 0) > 0,
  };
}

// Whether the business behind a valid link uses estimates, so the customer's
// confirmation can mention one may follow.
export async function intakeEstimatesEnabled(token: string): Promise<boolean> {
  const request = await resolveIntake(token);
  if (!request) return false;
  const { data } = await createAdminClient()
    .from("organizations")
    .select("estimates_enabled")
    .eq("id", request.organization_id)
    .maybeSingle<{ estimates_enabled: boolean }>();
  return data?.estimates_enabled ?? false;
}
