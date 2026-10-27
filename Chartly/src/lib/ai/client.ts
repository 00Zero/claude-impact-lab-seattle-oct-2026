import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// The model is configurable so a tested model can be pinned per environment.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

// Budgets (spec §6). Counted from ai_usage, which records every call.
// Price extraction isn't tied to a request, so it has a per-workspace cap.
const PER_REQUEST_LIMIT = { analysis: 6, brief: 6, estimate: 6, price_extraction: null } as const;
const PRICE_EXTRACTION_DAILY_LIMIT = 30;
const WORKSPACE_DAILY_LIMIT = Number(process.env.AI_WORKSPACE_DAILY_LIMIT) || 200;
const GLOBAL_DAILY_LIMIT = Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 2000;

let client: Anthropic | null = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY must be set on the server.");
  }
  // Bounded retries for 429/5xx/connection errors; a hard timeout so a
  // stuck call can't hold a request open.
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

export type AiKind = keyof typeof PER_REQUEST_LIMIT;

export type AiCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "budget" | "refused" | "invalid_output" | "api_error" | "not_configured" };

type Scope = { organizationId: string; serviceRequestId: string | null };

async function withinBudget(kind: AiKind, scope: Scope) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const perRequestLimit = PER_REQUEST_LIMIT[kind];
  const [perRequest, perWorkspace, global] = await Promise.all([
    scope.serviceRequestId
      ? admin
          .from("ai_usage")
          .select("id", { count: "exact", head: true })
          .eq("service_request_id", scope.serviceRequestId)
          .eq("kind", kind)
      : admin
          .from("ai_usage")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", scope.organizationId)
          .eq("kind", kind)
          .gte("created_at", since),
    admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.organizationId)
      .gte("created_at", since),
    admin.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  return (
    (perRequest.count ?? 0) < (perRequestLimit ?? PRICE_EXTRACTION_DAILY_LIMIT) &&
    (perWorkspace.count ?? 0) < WORKSPACE_DAILY_LIMIT &&
    (global.count ?? 0) < GLOBAL_DAILY_LIMIT
  );
}

// Records metadata only: no prompts, photos, or customer text.
async function recordUsage(
  kind: AiKind,
  scope: Scope,
  promptVersion: string,
  outcome: "succeeded" | "failed" | "refused" | "invalid_output",
  latencyMs: number,
  usage?: { input_tokens: number; output_tokens: number },
) {
  const { error } = await createAdminClient().from("ai_usage").insert({
    organization_id: scope.organizationId,
    service_request_id: scope.serviceRequestId,
    kind,
    model: AI_MODEL,
    prompt_version: promptVersion,
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    latency_ms: latencyMs,
    outcome,
  });
  if (error) console.error("Failed to record AI usage", error.message);
}

// One structured-output call. The schema constrains the response format;
// callers still validate meaning (ids, limits) before storing anything.
export async function callStructured<Schema extends z.ZodType>(options: {
  kind: AiKind;
  scope: Scope;
  promptVersion: string;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Schema;
  effort: "low" | "medium" | "high";
}): Promise<AiCallResult<z.infer<Schema>>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, code: "not_configured" };
  }
  if (!(await withinBudget(options.kind, options.scope))) {
    return { ok: false, code: "budget" };
  }

  const started = Date.now();
  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      // Re-runs a safety-classifier decline on Anthropic's recommended
      // fallback model instead of failing the customer's intake.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: options.effort,
        format: betaZodOutputFormat(options.schema),
      },
      // The system prompt is identical across requests, so it's cached.
      system: [{ type: "text", text: options.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: options.content }],
    });
    const latency = Date.now() - started;

    if (response.stop_reason === "refusal") {
      await recordUsage(options.kind, options.scope, options.promptVersion, "refused", latency, response.usage);
      return { ok: false, code: "refused" };
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      await recordUsage(options.kind, options.scope, options.promptVersion, "invalid_output", latency, response.usage);
      return { ok: false, code: "invalid_output" };
    }
    await recordUsage(options.kind, options.scope, options.promptVersion, "succeeded", latency, response.usage);
    return { ok: true, data: response.parsed_output };
  } catch (error) {
    const latency = Date.now() - started;
    await recordUsage(options.kind, options.scope, options.promptVersion, "failed", latency);
    if (error instanceof Anthropic.APIError) {
      console.error(`AI ${options.kind} call failed`, error.status, error.name);
    } else {
      console.error(`AI ${options.kind} call failed`, error instanceof Error ? error.name : "unknown");
    }
    return { ok: false, code: "api_error" };
  }
}
