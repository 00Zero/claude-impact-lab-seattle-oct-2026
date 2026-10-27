import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { listAvailableSpaces, type AvailableSpace } from "@/lib/spaces";
import { formatDate, formatTimeRange, seattleDateKey } from "@/lib/time";

// AI event planner (Phase 8). Claude turns a plain-language request into
// searches over available spaces, then submits up to three recommendations
// and a drafted event. It never books anything: the result is a link to the
// normal create-event form, which goes through createEventForSpace().

const MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 6;
const MAX_RECOMMENDATIONS = 3;

export type PlanStep = { type: "step"; message: string };

export type PlanRecommendation = {
  space: AvailableSpace;
  reason: string;
  spots: number; // drafted spots, capped at this space's capacity
  createEventUrl: string; // prefilled create-event form
};

export type Plan = {
  recommendations: PlanRecommendation[];
  event: { title: string; description: string; spots: number };
  note: string | null; // e.g. why nothing matched, or a compromise made
};

export class PlannerError extends Error {}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_spaces",
    description:
      "Search restaurant spaces in Seattle that are available to book for an event. Every filter is optional: pass null to skip it. " +
      "Returns matching spaces with their id, restaurant, area, day, time, seat capacity, features and minimum spend. " +
      "If a search returns nothing, try again with looser filters (wider dates, fewer seats, no price cap) before giving up.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        date_from: { ...nullable({ type: "string", format: "date" }), description: "Earliest Seattle calendar day, YYYY-MM-DD." },
        date_to: { ...nullable({ type: "string", format: "date" }), description: "Latest Seattle calendar day, YYYY-MM-DD, inclusive." },
        min_seats: { ...nullable({ type: "integer" }), description: "The space must seat at least this many people." },
        max_price_per_person: {
          ...nullable({ type: "number" }),
          description: "Maximum minimum-spend per person in US dollars. Spaces with no minimum always match.",
        },
        time_of_day: {
          ...nullable({ type: "string", enum: ["morning", "lunch", "afternoon", "evening", "late"] }),
          description: "Start time bucket: morning before 11, lunch 11-14, afternoon 14-17, evening 17-21, late 21 or after.",
        },
      },
      required: ["date_from", "date_to", "min_seats", "max_price_per_person", "time_of_day"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_plan",
    description:
      "Submit your final answer. Call this exactly once, after searching. Recommend at most 3 spaces, best first, using only ids returned by search_spaces. " +
      "If nothing suitable exists, submit an empty recommendations list and explain in note.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              space_id: { type: "string", description: "An id returned by search_spaces." },
              reason: { type: "string", description: "One sentence on why this space fits the request." },
            },
            required: ["space_id", "reason"],
            additionalProperties: false,
          },
        },
        event: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short, inviting event title." },
            description: { type: "string", description: "2-3 sentences for guests: what happens and who it's for." },
            spots: { type: "integer", description: "How many guests the organizer wants." },
          },
          required: ["title", "description", "spots"],
          additionalProperties: false,
        },
        note: { ...nullable({ type: "string" }), description: "Optional short note to the organizer, e.g. a compromise you made." },
      },
      required: ["recommendations", "event", "note"],
      additionalProperties: false,
    },
  },
];

type SearchInput = {
  date_from: string | null;
  date_to: string | null;
  min_seats: number | null;
  max_price_per_person: number | null;
  time_of_day: "morning" | "lunch" | "afternoon" | "evening" | "late" | null;
};

type SubmitInput = {
  recommendations: { space_id: string; reason: string }[];
  event: { title: string; description: string; spots: number };
  note: string | null;
};

/** "$25 minimum spend per person" -> 25. No price info means no minimum. */
function pricePerPerson(priceInfo: string | null): number {
  const match = priceInfo?.match(/\$\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function seattleHour(iso: string): number {
  return Number(
    new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }),
  );
}

const TIME_BUCKETS: Record<NonNullable<SearchInput["time_of_day"]>, [number, number]> = {
  morning: [0, 11],
  lunch: [11, 14],
  afternoon: [14, 17],
  evening: [17, 21],
  late: [21, 24],
};

function searchSpaces(all: AvailableSpace[], input: SearchInput): AvailableSpace[] {
  return all.filter((s) => {
    const day = seattleDateKey(new Date(s.startsAt));
    if (input.date_from && day < input.date_from) return false;
    if (input.date_to && day > input.date_to) return false;
    if (input.min_seats && s.capacity < input.min_seats) return false;
    if (input.max_price_per_person != null && pricePerPerson(s.priceInfo) > input.max_price_per_person) return false;
    if (input.time_of_day) {
      const [from, to] = TIME_BUCKETS[input.time_of_day];
      const hour = seattleHour(s.startsAt);
      if (hour < from || hour >= to) return false;
    }
    return true;
  });
}

function describeSpace(s: AvailableSpace) {
  const start = new Date(s.startsAt);
  return {
    id: s.id,
    restaurant: s.restaurantName,
    neighborhood: s.location,
    area: s.label,
    day: `${formatDate(start)} (${seattleDateKey(start)})`,
    time: formatTimeRange(start, new Date(s.endsAt)),
    seats: s.capacity,
    features: s.description,
    minimum_spend: s.priceInfo ?? "No minimum",
  };
}

// ---------------------------------------------------------------------------
// Planner loop
// ---------------------------------------------------------------------------

function systemPrompt(): string {
  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return [
    "You help organizers in Seattle find a restaurant space for a small community event on ALongTable, then draft the event listing.",
    `Today is ${today} (${seattleDateKey(now)}) in Seattle. Resolve relative dates like "Wednesday" or "next weekend" against this date; "Wednesday" means the next upcoming one.`,
    "Use search_spaces to find candidates. Search more than once if the first search is too narrow or empty. Then call submit_plan exactly once with up to 3 spaces, best match first.",
    "Prefer spaces whose seat count fits the group without being far larger. Respect budgets and times the organizer gives; if you must compromise, say so in note.",
    "Write the event title and description for guests who might join: warm, specific, no hype. Keep the description to 2-3 sentences.",
    "Only recommend space ids that search_spaces returned. You can't book anything; the organizer reviews and publishes the event themselves.",
    "This is a single request with no follow-up conversation, so don't offer to search again or ask questions; if something is unclear, make a reasonable assumption and mention it in note.",
  ].join("\n");
}

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new PlannerError("ANTHROPIC_API_KEY is not set.");
  return (client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 }));
}

/**
 * Run the planner for one request. `onStep` receives progress messages for the UI.
 * Throws PlannerError for problems worth showing the user; anything else is a bug.
 */
export async function planEvent(request: string, onStep: (step: PlanStep) => void = () => {}): Promise<Plan> {
  const all = await listAvailableSpaces();
  const seen = new Map<string, AvailableSpace>(); // ids Claude has been shown

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: request }];
  onStep({ type: "step", message: "Understanding your request" });

  let nudged = false;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt(),
      tools,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });

    if (response.stop_reason === "refusal") throw new PlannerError("The planner couldn't help with that request.");
    if (response.stop_reason === "max_tokens") throw new PlannerError("The planner ran out of room. Try a shorter request.");

    // Append the whole assistant turn unchanged (thinking blocks included).
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    const submit = toolUses.find((t) => t.name === "submit_plan");
    if (submit) {
      onStep({ type: "step", message: "Drafting your event" });
      return buildPlan(submit.input as SubmitInput, seen);
    }

    if (toolUses.length === 0) {
      // auto tool choice doesn't guarantee a call; ask once for the final answer.
      if (nudged) throw new PlannerError("The planner didn't return a plan. Please try again.");
      nudged = true;
      messages.push({ role: "user", content: "Please finish by calling submit_plan." });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((t) => {
      if (t.name !== "search_spaces") {
        return { type: "tool_result", tool_use_id: t.id, content: `Unknown tool ${t.name}.`, is_error: true };
      }
      const matches = searchSpaces(all, t.input as SearchInput);
      for (const s of matches) seen.set(s.id, s);
      onStep({
        type: "step",
        message: matches.length
          ? `Searching spaces: found ${matches.length} ${matches.length === 1 ? "match" : "matches"}`
          : "Searching spaces: no matches, widening the search",
      });
      return {
        type: "tool_result",
        tool_use_id: t.id,
        content: JSON.stringify({ count: matches.length, spaces: matches.slice(0, 20).map(describeSpace) }),
      };
    });
    messages.push({ role: "user", content: results });
  }

  throw new PlannerError("The planner took too many steps. Try a more specific request.");
}

function buildPlan(input: SubmitInput, seen: Map<string, AvailableSpace>): Plan {
  const title = input.event.title.trim();
  const description = input.event.description.trim();
  const requestedSpots = Math.max(1, Math.round(input.event.spots));

  const recommendations: PlanRecommendation[] = [];
  for (const r of input.recommendations) {
    const space = seen.get(r.space_id); // drop ids Claude wasn't shown
    if (!space || recommendations.some((x) => x.space.id === space.id)) continue;
    const spots = Math.min(requestedSpots, space.capacity);
    const params = new URLSearchParams({ title, description, capacity: String(spots) });
    recommendations.push({
      space,
      reason: r.reason.trim(),
      spots,
      createEventUrl: `/spaces/${space.id}/create-event?${params}`,
    });
    if (recommendations.length === MAX_RECOMMENDATIONS) break;
  }

  return {
    recommendations,
    event: { title, description, spots: requestedSpots },
    note: input.note?.trim() || null,
  };
}
