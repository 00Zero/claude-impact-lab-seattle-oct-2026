import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, callStructured, type AiCallResult } from "@/lib/ai/client";
import {
  INTAKE_ANALYSIS_PROMPT_VERSION,
  INTAKE_ANALYSIS_SYSTEM,
  intakeAnalysisSchema,
  type IntakeAnalysisOutput,
} from "@/lib/ai/prompts/intake-analysis";
import {
  SERVICE_BRIEF_PROMPT_VERSION,
  SERVICE_BRIEF_SYSTEM,
  serviceBriefSchema,
  type ServiceBriefOutput,
} from "@/lib/ai/prompts/service-brief";
import { hashIntakeToken } from "@/lib/intake-links";
import { INTAKE_PHOTO_MAX_COUNT } from "@/lib/intake-photo-rules";
import {
  formatAnswer,
  INITIAL_QUESTION_COUNT,
  MAX_OPTIONS,
  validateAnswer,
  YES_NO_UNKNOWN_OPTIONS,
  type AnswerValue,
  type IntakeAnalysisView,
  type IntakeQuestion,
  type PhotoIssue,
} from "@/lib/intake-questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tradeLabel } from "@/lib/trades";

// Server side of the AI intake. Customer entry points take the link token
// and resolve it to one active request before anything else; the secret-key
// client is then used only for that request's rows. The model never picks
// ids or writes to the database: its output is validated and mapped here.

const PHOTO_BUCKET = "intake-photos";
// Jobs stuck "running" longer than this are treated as failed (a crashed
// worker), so the contractor can retry.
const STALE_JOB_MS = 10 * 60 * 1000;

export type IntakeActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const AI_ERRORS: Record<Exclude<AiCallResult<unknown>, { ok: true }>["code"], string> = {
  budget: "We can’t look at your photos right now. You can still send what you have.",
  refused: "We couldn’t look at these photos automatically. You can still send what you have.",
  invalid_output: "Something went wrong looking at your photos. Please try again.",
  api_error: "Something went wrong looking at your photos. Please try again.",
  not_configured: "Automatic photo review isn’t set up yet. You can still send what you have.",
};

export type RequestRow = {
  id: string;
  organization_id: string;
  customer_name: string;
  trade: string;
  trade_other: string | null;
  issue_description: string | null;
  customer_description: string | null;
  customer_note: string | null;
  intake_status: "draft" | "shared" | "in_progress" | "submitted";
  current_intake_revision: number;
};

export const REQUEST_COLUMNS =
  "id, organization_id, customer_name, trade, trade_other, issue_description, customer_description, customer_note, intake_status, current_intake_revision";

// Possession of a valid link is access to its intake (spec C7). Returns the
// request only if the link is unrevoked and unexpired.
export async function resolveIntake(token: string): Promise<RequestRow | null> {
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("intake_links")
    .select("service_request_id, expires_at, revoked_at")
    .eq("token_hash", hashIntakeToken(token))
    .maybeSingle<{ service_request_id: string; expires_at: string; revoked_at: string | null }>();
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) {
    return null;
  }
  const { data: request } = await admin
    .from("service_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", link.service_request_id)
    .single<RequestRow>();
  return request ?? null;
}

const LINK_INACTIVE = { ok: false as const, error: "This link is no longer active. Ask the business for a new one." };
const ALREADY_SENT = { ok: false as const, error: "These details were already sent." };

type StoredPhoto = { id: string; storage_path: string; caption: string | null };

export async function loadPhotos(requestId: string): Promise<StoredPhoto[]> {
  const { data, error } = await createAdminClient()
    .from("intake_photos")
    .select("id, storage_path, caption")
    .eq("service_request_id", requestId)
    .eq("status", "ready")
    .is("removed_at", null)
    .order("sort_key")
    .order("created_at")
    .limit(INTAKE_PHOTO_MAX_COUNT);
  if (error) throw new Error(`Failed to load intake photos: ${error.message}`);
  return (data ?? []) as StoredPhoto[];
}

// Image blocks with a P1… label ahead of each, so the model can cite photos
// without ever seeing (or inventing) real ids.
async function photoBlocks(photos: StoredPhoto[]): Promise<Anthropic.Beta.BetaContentBlockParam[] | null> {
  const storage = createAdminClient().storage.from(PHOTO_BUCKET);
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [index, photo] of photos.entries()) {
    const { data, error } = await storage.download(photo.storage_path);
    if (error || !data) return null;
    const caption = photo.caption ? `Customer's caption: <customer_input>${photo.caption}</customer_input>` : "No caption.";
    blocks.push({ type: "text", text: `Photo P${index + 1}. ${caption}` });
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: "image/webp", data: Buffer.from(await data.arrayBuffer()).toString("base64") },
    });
  }
  return blocks;
}

export function requestContext(request: RequestRow) {
  const parts = [`Trade: ${tradeLabel(request.trade, request.trade_other)}`];
  if (request.issue_description) {
    parts.push(`What the business already knows (from the contractor): <customer_input>${request.issue_description}</customer_input>`);
  }
  if (request.customer_description) {
    parts.push(`The customer's own description: <customer_input>${request.customer_description}</customer_input>`);
  }
  return parts.join("\n");
}

function photoSet(photos: StoredPhoto[]) {
  return photos.length ? photos.map((p) => p.id).sort().join(",") : "none";
}

// ---------- validated, id-mapped shapes we store ----------

type StoredAnalysis = {
  photo_issues: (PhotoIssue & { quality: string })[];
  visible_observations: { photo_id: string; observation: string }[];
  possible_explanations: { explanation: string; photo_ids: string[] }[];
  equipment: { description: string; make: string | null; model: string | null; serial: string | null; photo_id: string | null }[];
  error_codes: { code: string; photo_id: string }[];
  missing_information: string[];
  urgent_concern: string | null;
};

export type StoredBrief = {
  summary: string;
  customer_reported: { fact: string; question_ids: string[]; sources: string[] }[];
  /** x/y: approximate pin in the first photo, percent; absent on briefs before prompt .2. */
  visual_observations: { observation: string; photo_ids: string[]; x?: number | null; y?: number | null }[];
  equipment: { description: string; make: string | null; model: string | null; serial: string | null; photo_ids: string[] }[];
  symptom_timeline: string | null;
  /** Most likely first. confidence is absent on briefs before prompt .2. */
  possible_explanations: { explanation: string; basis: string; confidence?: "high" | "med" | "low" }[];
  bring?: { item: string; why: string }[];
  confirm_on_site?: string | null;
  unresolved_questions: string[];
  contradictions: string[];
  urgent_concern: string | null;
};

const clip = (text: string, max: number) => text.trim().slice(0, max);
const clipOrNull = (text: string | null, max: number) => (text && text.trim() ? clip(text, max) : null);
const percentOrNull = (n: number | null) => (n !== null && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null);

export function labelMap(ids: string[], prefix: string) {
  return new Map(ids.map((id, index) => [`${prefix}${index + 1}`, id]));
}

export function mapLabels(labels: string[], map: Map<string, string>) {
  return [...new Set(labels.map((label) => map.get(label.trim().toUpperCase())).filter((id): id is string => !!id))];
}

// Semantic checks on top of the schema: references must exist, question
// shapes must fit their type, and limits are enforced here, not trusted.
function validateAnalysis(output: IntakeAnalysisOutput, photos: StoredPhoto[]) {
  const photoIds = labelMap(photos.map((p) => p.id), "P");
  const one = (label: string | null) => (label ? (photoIds.get(label.trim().toUpperCase()) ?? null) : null);

  const analysis: StoredAnalysis = {
    photo_issues: output.photos.flatMap((p) => {
      const photoId = one(p.photo);
      if (!photoId || p.quality === "usable") return [];
      return [{
        photoId,
        quality: p.quality,
        message: clipOrNull(p.customer_message, 300) ?? "This photo is hard to use.",
        requestedView: clipOrNull(p.requested_view, 200),
      }];
    }),
    visible_observations: output.visible_observations.flatMap((o) => {
      const photoId = one(o.photo);
      return photoId ? [{ photo_id: photoId, observation: clip(o.observation, 500) }] : [];
    }),
    possible_explanations: output.possible_explanations.slice(0, 5).map((e) => ({
      explanation: clip(e.explanation, 500),
      photo_ids: mapLabels(e.based_on_photos, photoIds),
    })),
    equipment: output.equipment.slice(0, 5).map((e) => ({
      description: clip(e.description, 200),
      make: clipOrNull(e.make, 100),
      model: clipOrNull(e.model, 100),
      serial: clipOrNull(e.serial, 100),
      photo_id: one(e.photo),
    })),
    error_codes: output.error_codes.flatMap((c) => {
      const photoId = one(c.photo);
      return photoId ? [{ code: clip(c.code, 40), photo_id: photoId }] : [];
    }),
    missing_information: output.missing_information.slice(0, 10).map((m) => clip(m, 300)),
    urgent_concern: clipOrNull(output.urgent_concern, 500),
  };

  let photoRequests = 0;
  const questions = output.questions.flatMap((q) => {
    const label = clip(q.label, 300);
    if (!label) return [];
    let type = q.type;
    let options: string[] = [];
    if (type === "single_select" || type === "multi_select") {
      options = [...new Set(q.options.map((o) => clip(o, 100)).filter(Boolean))].slice(0, MAX_OPTIONS);
      if (options.length < 2) type = "short_text";
    }
    if (type === "yes_no_unknown") options = [...YES_NO_UNKNOWN_OPTIONS];
    const unit = type === "number_with_units" ? clipOrNull(q.unit, 40) : null;
    if (type === "number_with_units" && !unit) type = "short_text";
    if (type === "photo_request") {
      // A photo request only makes sense if there's room for another photo.
      if (photoRequests >= 1 || photos.length >= INTAKE_PHOTO_MAX_COUNT) return [];
      photoRequests++;
    }
    if (type !== "single_select" && type !== "multi_select" && type !== "yes_no_unknown") options = [];
    return [{
      type,
      label,
      help: clipOrNull(q.help, 500),
      options,
      unit,
      required: q.required,
      allow_unknown: q.allow_unknown || type === "yes_no_unknown",
      reason: clip(q.reason, 500) || "This helps them prepare for the visit.",
      evidence_photo_ids: mapLabels(q.evidence_photos, photoIds),
    }];
  });

  // The model always gets something to ask; if every question failed
  // validation, fall back to one safe, generic question.
  if (questions.length === 0) {
    questions.push({
      type: "long_text",
      label: "When did this start, and is it happening all the time or on and off?",
      help: null,
      options: [],
      unit: null,
      required: false,
      allow_unknown: true,
      reason: "Timing helps them figure out what to bring.",
      evidence_photo_ids: [],
    });
  }

  return { analysis, questions: questions.slice(0, INITIAL_QUESTION_COUNT) };
}

type QuestionRow = {
  id: string;
  type: IntakeQuestion["type"];
  label: string;
  help: string | null;
  options: string[];
  unit: string | null;
  required: boolean;
  allow_unknown: boolean;
  reason: string;
};

const QUESTION_COLUMNS = "id, type, label, help, options, unit, required, allow_unknown, reason";

function toQuestion(row: QuestionRow): IntakeQuestion {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    help: row.help,
    options: row.options ?? [],
    unit: row.unit,
    required: row.required,
    allowUnknown: row.allow_unknown,
    reason: row.reason,
  };
}

// What the AI read, for the customer's "We read…" confirmation: equipment
// first, then a visible observation or two. Never causes or repair advice.
function seenLines(result: StoredAnalysis) {
  const equipment = result.equipment.map((e) =>
    [[e.make, e.description].filter(Boolean).join(" "), e.model ? `model ${e.model}` : null].filter(Boolean).join(" · "),
  );
  const observed = result.visible_observations.map((o) => o.observation);
  return [...equipment, ...observed].filter(Boolean).slice(0, 3);
}

async function analysisView(analysisId: string, result: StoredAnalysis): Promise<IntakeAnalysisView> {
  const { data } = await createAdminClient()
    .from("intake_questions")
    .select(QUESTION_COLUMNS)
    .eq("analysis_id", analysisId)
    .order("position");
  return {
    seen: seenLines(result),
    questions: ((data ?? []) as QuestionRow[]).map(toQuestion),
    photoIssues: result.photo_issues.map(({ photoId, message, requestedView }) => ({ photoId, message, requestedView })),
    urgentConcern: result.urgent_concern,
  };
}

async function markInProgress(request: RequestRow) {
  if (request.intake_status === "draft" || request.intake_status === "shared") {
    await createAdminClient()
      .from("service_requests")
      .update({ intake_status: "in_progress" })
      .eq("id", request.id)
      .in("intake_status", ["draft", "shared"]);
  }
}

// ---------- customer: analysis and questions (C4, C5) ----------

export async function analyzeIntake(token: string): Promise<IntakeActionResult<{ analysis: IntakeAnalysisView }>> {
  const request = await resolveIntake(token);
  if (!request) return LINK_INACTIVE;
  if (request.intake_status === "submitted") return ALREADY_SENT;

  const photos = await loadPhotos(request.id);
  if (photos.length === 0 && !request.customer_description) {
    return { ok: false, error: "Add a photo, or describe the problem, to continue." };
  }

  const admin = createAdminClient();
  const set = photoSet(photos);

  // Same photos as last time: reuse the questions instead of paying again
  // (and so a reload or "back" doesn't change what the customer sees).
  const { data: previous } = await admin
    .from("intake_analyses")
    .select("id, result")
    .eq("service_request_id", request.id)
    .eq("intake_revision", request.current_intake_revision)
    .eq("photo_set", set)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; result: StoredAnalysis }>();
  if (previous) {
    return { ok: true, analysis: await analysisView(previous.id, previous.result) };
  }

  const images = await photoBlocks(photos);
  if (!images) return { ok: false, error: "We couldn’t load your photos. Please try again." };

  const { data: run, error: runError } = await admin
    .from("intake_analyses")
    .insert({
      organization_id: request.organization_id,
      service_request_id: request.id,
      intake_revision: request.current_intake_revision,
      photo_set: set,
      status: "running",
      model: AI_MODEL,
      prompt_version: INTAKE_ANALYSIS_PROMPT_VERSION,
    })
    .select("id")
    .single<{ id: string }>();
  if (runError || !run) return { ok: false, error: "Something went wrong. Please try again." };

  const scope = { organizationId: request.organization_id, serviceRequestId: request.id };
  const intro = photos.length
    ? `The customer sent ${photos.length} photo${photos.length === 1 ? "" : "s"}.`
    : "The customer couldn't take a photo and wrote a description instead. There are no photos, so the photos array is empty and no question should refer to photos.";
  const result = await callStructured({
    kind: "analysis",
    scope,
    promptVersion: INTAKE_ANALYSIS_PROMPT_VERSION,
    system: INTAKE_ANALYSIS_SYSTEM,
    content: [{ type: "text", text: `${requestContext(request)}\n\n${intro}` }, ...images],
    schema: intakeAnalysisSchema,
    // The customer is waiting on this screen; keep it quick.
    effort: "low",
  });

  if (!result.ok) {
    await admin
      .from("intake_analyses")
      .update({ status: "failed", error_code: result.code, completed_at: new Date().toISOString() })
      .eq("id", run.id);
    return { ok: false, error: AI_ERRORS[result.code] };
  }

  const { analysis, questions } = validateAnalysis(result.data, photos);
  const { error: questionError } = await admin.from("intake_questions").insert(
    questions.map((q, position) => ({
      ...q,
      organization_id: request.organization_id,
      service_request_id: request.id,
      analysis_id: run.id,
      position,
    })),
  );
  if (questionError) {
    await admin.from("intake_analyses").update({ status: "failed", error_code: "store_failed" }).eq("id", run.id);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  await admin
    .from("intake_analyses")
    .update({ status: "succeeded", result: analysis, completed_at: new Date().toISOString() })
    .eq("id", run.id);
  await markInProgress(request);

  return { ok: true, analysis: await analysisView(run.id, analysis) };
}

// Saved questions and answers, so a reload or another device picks up where
// the customer left off (C7).
export async function getIntakeProgress(token: string): Promise<{
  analysis: IntakeAnalysisView | null;
  answers: Record<string, AnswerValue>;
}> {
  const request = await resolveIntake(token);
  if (!request) return { analysis: null, answers: {} };
  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("intake_analyses")
    .select("id, result")
    .eq("service_request_id", request.id)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; result: StoredAnalysis }>();
  if (!latest) return { analysis: null, answers: {} };

  const analysis = await analysisView(latest.id, latest.result);
  return { analysis, answers: await latestAnswers(analysis.questions.map((q) => q.id), admin) };
}

export async function latestAnswers(
  questionIds: string[],
  supabase: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>,
) {
  if (questionIds.length === 0) return {};
  const { data } = await supabase
    .from("intake_answers")
    .select("question_id, value, created_at")
    .in("question_id", questionIds)
    .order("created_at", { ascending: false });
  const answers: Record<string, AnswerValue> = {};
  for (const row of (data ?? []) as { question_id: string; value: AnswerValue }[]) {
    answers[row.question_id] ??= row.value;
  }
  return answers;
}

export async function saveIntakeAnswer(
  token: string,
  questionId: string,
  input: unknown,
): Promise<IntakeActionResult<{ value: AnswerValue }>> {
  const request = await resolveIntake(token);
  if (!request) return LINK_INACTIVE;
  if (request.intake_status === "submitted") return ALREADY_SENT;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("intake_questions")
    .select(QUESTION_COLUMNS)
    .eq("id", questionId)
    .eq("service_request_id", request.id)
    .maybeSingle<QuestionRow>();
  if (!row) return { ok: false, error: "This question is no longer here. Refresh the page." };

  const checked = validateAnswer(toQuestion(row), input);
  if (!checked.ok) return checked;
  if (checked.value.kind === "photo") {
    const { data: photo } = await admin
      .from("intake_photos")
      .select("id")
      .eq("id", checked.value.photoId)
      .eq("service_request_id", request.id)
      .eq("status", "ready")
      .is("removed_at", null)
      .maybeSingle();
    if (!photo) return { ok: false, error: "That photo didn’t save. Please add it again." };
  }

  const { error } = await admin.from("intake_answers").insert({
    organization_id: request.organization_id,
    service_request_id: request.id,
    question_id: row.id,
    value: checked.value,
  });
  if (error) return { ok: false, error: "Your answer didn’t save. Please try again." };
  await markInProgress(request);
  return { ok: true, value: checked.value };
}

// ---------- customer: submit (exactly once) and the brief job ----------

export async function submitIntake(
  token: string,
  note: string,
): Promise<IntakeActionResult<{ jobId: string | null }>> {
  const request = await resolveIntake(token);
  if (!request) return LINK_INACTIVE;
  // A retry or double tap after success is fine: report success again.
  if (request.intake_status === "submitted") return { ok: true, jobId: null };

  const photos = await loadPhotos(request.id);
  if (photos.length === 0 && !request.customer_description) {
    return { ok: false, error: "Add a photo, or describe the problem, before sending." };
  }

  const admin = createAdminClient();
  // The status condition makes this a single atomic transition; a racing
  // second submit updates nothing.
  const { data: submitted, error } = await admin
    .from("service_requests")
    .update({
      intake_status: "submitted",
      customer_note: note.trim() ? note.trim().slice(0, 2000) : null,
      analysis_status: "pending",
    })
    .eq("id", request.id)
    .neq("intake_status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Your details didn’t send. Please try again." };
  if (!submitted) return { ok: true, jobId: null };

  const job = await createBriefJob(request.organization_id, request.id, request.current_intake_revision);
  return { ok: true, jobId: job };
}

async function createBriefJob(organizationId: string, requestId: string, revision: number) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("processing_jobs")
    .select("id", { count: "exact", head: true })
    .eq("service_request_id", requestId)
    .eq("kind", "brief");
  const { data, error } = await admin
    .from("processing_jobs")
    .insert({
      organization_id: organizationId,
      service_request_id: requestId,
      kind: "brief",
      input_revision: revision,
      idempotency_key: `brief:${requestId}:${revision}:${(count ?? 0) + 1}`,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("Failed to create brief job", error?.message);
    return null;
  }
  return data.id;
}

async function setAnalysisStatus(requestId: string, status: "pending" | "running" | "succeeded" | "failed") {
  await createAdminClient().from("service_requests").update({ analysis_status: status }).eq("id", requestId);
}

// Runs one brief job. Safe to call more than once: only a pending or failed
// job can be claimed, and a stale "running" job is reclaimable.
export async function runBriefJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("processing_jobs")
    .select("id, organization_id, service_request_id, input_revision, status, attempts, updated_at")
    .eq("id", jobId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      service_request_id: string;
      input_revision: number;
      status: string;
      attempts: number;
      updated_at: string;
    }>();
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
  await setAnalysisStatus(job.service_request_id, "running");

  const fail = async (code: string) => {
    await admin.from("processing_jobs").update({ status: "failed", error_code: code }).eq("id", job.id);
    await setAnalysisStatus(job.service_request_id, "failed");
  };

  try {
    const { data: request } = await admin
      .from("service_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", job.service_request_id)
      .single<RequestRow>();
    if (!request) return fail("request_missing");

    const photos = await loadPhotos(request.id);
    const images = await photoBlocks(photos);
    if (!images) return fail("photo_load_failed");

    const questions = await currentQuestions(request.id, admin);
    const answers = await latestAnswers(questions.map((q) => q.id), admin);
    const qa = questions.length
      ? questions
          .map((q, i) => `Q${i + 1}. ${q.label}\nAnswer: <customer_input>${formatAnswer(answers[q.id])}</customer_input>`)
          .join("\n\n")
      : "No questions were answered.";
    const note = request.customer_note
      ? `Customer's closing note: <customer_input>${request.customer_note}</customer_input>`
      : "No closing note.";

    const result = await callStructured({
      kind: "brief",
      scope: { organizationId: request.organization_id, serviceRequestId: request.id },
      promptVersion: SERVICE_BRIEF_PROMPT_VERSION,
      system: SERVICE_BRIEF_SYSTEM,
      content: [
        { type: "text", text: `${requestContext(request)}\n\nCustomer name: ${request.customer_name}` },
        { type: "text", text: `Questions and answers:\n${qa}\n\n${note}` },
        { type: "text", text: photos.length ? `${photos.length} photo(s) follow.` : "The customer sent no photos." },
        ...images,
      ],
      schema: serviceBriefSchema,
      effort: "medium",
    });
    if (!result.ok) return fail(result.code);

    const brief = validateBrief(result.data, photos, questions);
    const { data: last } = await admin
      .from("ai_briefs")
      .select("version")
      .eq("service_request_id", request.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<{ version: number }>();
    const { error: insertError } = await admin.from("ai_briefs").insert({
      organization_id: request.organization_id,
      service_request_id: request.id,
      version: (last?.version ?? 0) + 1,
      intake_revision: job.input_revision,
      state: "final",
      brief,
      model: AI_MODEL,
      prompt_version: SERVICE_BRIEF_PROMPT_VERSION,
    });
    if (insertError) return fail("store_failed");

    await admin.from("processing_jobs").update({ status: "succeeded" }).eq("id", job.id);
    await setAnalysisStatus(request.id, "succeeded");

    // Spec §6 stage 5: a final brief starts estimate drafting when the
    // workspace uses estimates. Imported here to avoid a module cycle.
    const { draftEstimateAfterBrief } = await import("@/lib/estimates");
    await draftEstimateAfterBrief(request.organization_id, request.id);
  } catch (error) {
    console.error("Brief job failed", error instanceof Error ? error.message : "unknown");
    await fail("unexpected");
  }
}

// Questions from the newest successful analysis: the ones the customer saw.
export async function currentQuestions(
  requestId: string,
  supabase: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>,
): Promise<IntakeQuestion[]> {
  const { data: latest } = await supabase
    .from("intake_analyses")
    .select("id")
    .eq("service_request_id", requestId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!latest) return [];
  const { data } = await supabase
    .from("intake_questions")
    .select(QUESTION_COLUMNS)
    .eq("analysis_id", latest.id)
    .order("position");
  return ((data ?? []) as QuestionRow[]).map(toQuestion);
}

function validateBrief(output: ServiceBriefOutput, photos: StoredPhoto[], questions: IntakeQuestion[]): StoredBrief {
  const photoIds = labelMap(photos.map((p) => p.id), "P");
  const questionIds = labelMap(questions.map((q) => q.id), "Q");
  return {
    summary: clip(output.summary, 1000),
    customer_reported: output.customer_reported.slice(0, 15).map((c) => ({
      fact: clip(c.fact, 500),
      question_ids: mapLabels(c.questions, questionIds),
      sources: [...new Set(c.sources)],
    })),
    visual_observations: output.visual_observations.slice(0, 15).flatMap((o) => {
      const ids = mapLabels(o.photos, photoIds);
      // An observation must point at a real photo.
      return ids.length ? [{ observation: clip(o.observation, 500), photo_ids: ids, x: percentOrNull(o.x), y: percentOrNull(o.y) }] : [];
    }),
    equipment: output.equipment.slice(0, 5).map((e) => ({
      description: clip(e.description, 200),
      make: clipOrNull(e.make, 100),
      model: clipOrNull(e.model, 100),
      serial: clipOrNull(e.serial, 100),
      photo_ids: mapLabels(e.photos, photoIds),
    })),
    symptom_timeline: clipOrNull(output.symptom_timeline, 500),
    possible_explanations: output.possible_explanations.slice(0, 5).map((e) => ({
      explanation: clip(e.explanation, 500),
      basis: clip(e.basis, 300),
      confidence: e.confidence,
    })),
    bring: output.bring.slice(0, 5).map((b) => ({ item: clip(b.item, 200), why: clip(b.why, 300) })),
    confirm_on_site: clipOrNull(output.confirm_on_site, 300),
    unresolved_questions: output.unresolved_questions.slice(0, 10).map((q) => clip(q, 300)),
    contradictions: output.contradictions.slice(0, 10).map((c) => clip(c, 300)),
    urgent_concern: clipOrNull(output.urgent_concern, 500),
  };
}

// ---------- contractor ----------

export type RequestIntakeView = {
  brief: { version: number; brief: StoredBrief; createdAt: string; model: string } | null;
  job: { status: "pending" | "running" | "succeeded" | "failed"; stale: boolean; errorCode: string | null } | null;
  questions: (IntakeQuestion & { answer: AnswerValue | null })[];
  customerNote: string | null;
};

// The contractor's view, read through RLS with the user's own session.
// Callers pass the organization from requireWorkspace().
export async function getRequestIntake(organizationId: string, requestId: string): Promise<RequestIntakeView> {
  const supabase = await createClient();
  const [{ data: brief }, { data: job }, { data: request }] = await Promise.all([
    supabase
      .from("ai_briefs")
      .select("version, brief, created_at, model")
      .eq("organization_id", organizationId)
      .eq("service_request_id", requestId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<{ version: number; brief: StoredBrief; created_at: string; model: string }>(),
    supabase
      .from("processing_jobs")
      .select("status, error_code, updated_at")
      .eq("organization_id", organizationId)
      .eq("service_request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: "pending" | "running" | "succeeded" | "failed"; error_code: string | null; updated_at: string }>(),
    supabase
      .from("service_requests")
      .select("customer_note")
      .eq("organization_id", organizationId)
      .eq("id", requestId)
      .maybeSingle<{ customer_note: string | null }>(),
  ]);

  const questions = await currentQuestions(requestId, supabase);
  const answers = await latestAnswers(questions.map((q) => q.id), supabase);
  return {
    brief: brief ? { version: brief.version, brief: brief.brief, createdAt: brief.created_at, model: brief.model } : null,
    job: job
      ? {
          status: job.status,
          stale:
            (job.status === "running" || job.status === "pending") &&
            Date.now() - new Date(job.updated_at).getTime() > STALE_JOB_MS,
          errorCode: job.error_code,
        }
      : null,
    questions: questions.map((q) => ({ ...q, answer: answers[q.id] ?? null })),
    customerNote: request?.customer_note ?? null,
  };
}

// Contractor-triggered retry. The caller has already checked the workspace;
// this re-checks that the request is in it and submitted.
export async function retryBrief(organizationId: string, requestId: string): Promise<IntakeActionResult<{ jobId: string }>> {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("id, organization_id, intake_status, current_intake_revision")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle<{ id: string; organization_id: string; intake_status: string; current_intake_revision: number }>();
  if (!request) return { ok: false, error: "Request not found." };
  if (request.intake_status !== "submitted") {
    return { ok: false, error: "The customer hasn’t sent their details yet." };
  }
  const jobId = await createBriefJob(request.organization_id, request.id, request.current_intake_revision);
  if (!jobId) return { ok: false, error: "Couldn’t start a new brief. Please try again." };
  await setAnalysisStatus(request.id, "pending");
  return { ok: true, jobId };
}
