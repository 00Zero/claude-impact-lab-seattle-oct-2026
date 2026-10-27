import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AREAS, CAPACITIES, FEATURES, PRICES, SLOTS } from "@/lib/space-options";
import { isValidLatLng } from "@/lib/geocode";
import { upcomingDays } from "@/lib/time";

// AI restaurant onboarding. A restaurant pastes its Google Maps link; we read
// the place name and coordinates from the link itself (no Maps page content is
// downloaded), Claude researches the restaurant on the public web, and then
// suggests open spots to publish. The owner reviews everything; nothing is
// published without their click.

const MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 6;

export class OnboardingError extends Error {}

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new OnboardingError("ANTHROPIC_API_KEY is not set.");
  return (client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }));
}

// ---------------------------------------------------------------------------
// 1. Google Maps link -> place name and coordinates
// ---------------------------------------------------------------------------

export type MapsPlace = { name: string; lat: number | null; lng: number | null };

const MAPS_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "maps.google.com"]);

function isMapsUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (!MAPS_HOSTS.has(url.hostname)) return false;
  if (url.hostname === "goo.gl") return url.pathname.startsWith("/maps");
  if (url.hostname === "google.com" || url.hostname === "www.google.com") return url.pathname.startsWith("/maps");
  return true;
}

/** Follow share-link redirects (Google Maps hosts only) without downloading page content. */
async function expandMapsUrl(input: URL): Promise<URL> {
  let url = input;
  for (let hop = 0; hop < 5; hop++) {
    if (url.hostname !== "maps.app.goo.gl" && url.hostname !== "goo.gl") return url;
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    await res.body?.cancel(); // only the redirect header matters
    const location = res.headers.get("location");
    if (!location) return url;
    const next = new URL(location, url);
    if (!isMapsUrl(next)) return url; // never follow a redirect off Google Maps
    url = next;
  }
  return url;
}

function parsePlace(url: URL): MapsPlace | null {
  // /maps/place/Il+Nido/@47.57,-122.41,17z/data=...!3d47.5712!4d-122.4089...
  const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
  const fromQuery = url.searchParams.get("q") ?? url.searchParams.get("query");
  const rawName = placeMatch?.[1] ?? fromQuery;
  if (!rawName) return null;
  const name = decodeURIComponent(rawName.replace(/\+/g, " ")).trim();
  if (!name || /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(name)) return null; // bare coordinates aren't a place

  const full = url.toString();
  const pin = full.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); // the place's own pin
  const view = full.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); // map viewport centre
  const coords = pin ?? view;
  return { name, lat: coords ? Number(coords[1]) : null, lng: coords ? Number(coords[2]) : null };
}

export async function placeFromMapsLink(link: string): Promise<MapsPlace> {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    throw new OnboardingError("That doesn't look like a link. Paste the link from Google Maps' Share button.");
  }
  if (!isMapsUrl(url)) throw new OnboardingError("Paste a Google Maps link, like https://maps.app.goo.gl/…");

  let expanded: URL;
  try {
    expanded = await expandMapsUrl(url);
  } catch {
    throw new OnboardingError("We couldn't open that Google Maps link. Check it and try again.");
  }
  const place = parsePlace(expanded);
  if (!place) {
    throw new OnboardingError("We couldn't find a restaurant in that link. Open your restaurant in Google Maps, tap Share, and copy that link.");
  }
  return place;
}

// ---------------------------------------------------------------------------
// 2. Research the restaurant on the web
// ---------------------------------------------------------------------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];

export type RestaurantProfile = {
  name: string;
  location: string; // "Neighborhood, Seattle, WA", the format the rest of the app uses
  address: string | null;
  cuisine: string | null;
  priceRange: "$" | "$$" | "$$$" | "$$$$" | null;
  summary: string | null;
  hours: { day: Day; opens: string; closes: string }[]; // 24h "HH:MM"; closed days omitted
  areas: (typeof AREAS)[number][]; // seating areas it appears to have
  sources: { title: string; url: string }[];
  confidence: "high" | "medium" | "low";
  missing: string[]; // fields we couldn't confirm
  lat: number | null; // map pin from the Google Maps link, if it had one
  lng: number | null;
};

export type OnboardingStep = { type: "step"; message: string };

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const submitProfileTool: Anthropic.Beta.BetaTool = {
  name: "submit_profile",
  description:
    "Submit the restaurant profile once you've researched it. Only include facts you found in sources; use null or omit when unsure, and list what you couldn't confirm in missing.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The restaurant's name as it presents itself." },
      neighborhood: { type: "string", description: 'Neighborhood and city, e.g. "Capitol Hill, Seattle, WA".' },
      address: { ...nullable({ type: "string" }), description: "Street address, if found." },
      cuisine: { ...nullable({ type: "string" }), description: 'Short cuisine label, e.g. "Italian" or "Pacific Northwest".' },
      price_range: { ...nullable({ type: "string", enum: ["$", "$$", "$$$", "$$$$"] }) },
      summary: { ...nullable({ type: "string" }), description: "1-2 plain sentences describing the restaurant for guests." },
      hours: {
        type: "array",
        description: "Regular opening hours. One entry per open period; omit closed days. 24-hour HH:MM.",
        items: {
          type: "object",
          properties: {
            day: { type: "string", enum: [...DAYS] },
            opens: { type: "string", description: "HH:MM, 24-hour" },
            closes: { type: "string", description: "HH:MM, 24-hour; past midnight is fine, e.g. 01:00" },
          },
          required: ["day", "opens", "closes"],
          additionalProperties: false,
        },
      },
      areas: {
        type: "array",
        description: "Seating areas the restaurant appears to have.",
        items: { type: "string", enum: [...AREAS] },
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, url: { type: "string" } },
          required: ["title", "url"],
          additionalProperties: false,
        },
      },
      confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence you found the right restaurant." },
      missing: { type: "array", items: { type: "string" }, description: 'Fields you couldn\'t confirm, e.g. "hours".' },
    },
    required: ["name", "neighborhood", "address", "cuisine", "price_range", "summary", "hours", "areas", "sources", "confidence", "missing"],
    additionalProperties: false,
  },
};

type SubmitProfileInput = {
  name: string;
  neighborhood: string;
  address: string | null;
  cuisine: string | null;
  price_range: RestaurantProfile["priceRange"];
  summary: string | null;
  hours: { day: Day; opens: string; closes: string }[];
  areas: RestaurantProfile["areas"];
  sources: { title: string; url: string }[];
  confidence: RestaurantProfile["confidence"];
  missing: string[];
};

function researchPrompt(place: MapsPlace): string {
  const where = place.lat != null ? ` Its Google Maps pin is at ${place.lat}, ${place.lng}.` : "";
  return [
    `Research the restaurant "${place.name}" in Seattle, WA.${where}`,
    "Use web search, and web fetch on the restaurant's own website if you find it, to learn its neighborhood, address, cuisine, price range, regular opening hours, and seating areas (patio, bar, private room, communal table, window seats).",
    "Make sure you have the right restaurant: same name and near that location. Prefer the restaurant's own website for hours.",
    "Then call submit_profile once. Don't guess: leave fields null or empty if you can't find them and list them in missing.",
  ].join("\n");
}

function stepFor(block: Anthropic.Beta.BetaContentBlock): string | null {
  if (block.type !== "server_tool_use") return null;
  const input = block.input as { query?: string; url?: string };
  if (block.name === "web_search" && input.query) return `Searching the web: "${input.query}"`;
  if (block.name === "web_fetch" && input.url) {
    try {
      return `Reading ${new URL(input.url).hostname.replace(/^www\./, "")}`;
    } catch {
      return "Reading a web page";
    }
  }
  return null;
}

export async function researchRestaurant(
  place: MapsPlace,
  onStep: (step: OnboardingStep) => void = () => {},
): Promise<RestaurantProfile> {
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 5,
      user_location: { type: "approximate", city: "Seattle", region: "Washington", country: "US", timezone: "America/Los_Angeles" },
    },
    // Google Maps pages aren't fetched: we only use the name and pin from the link.
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, max_content_tokens: 8000, blocked_domains: ["google.com"] },
    submitProfileTool,
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: researchPrompt(place) }];
  onStep({ type: "step", message: `Found "${place.name}" in your link` });

  let nudged = false;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      tools,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });

    if (response.stop_reason === "refusal") throw new OnboardingError("We couldn't research that restaurant.");
    if (response.stop_reason === "max_tokens") throw new OnboardingError("The research ran too long. Please try again.");

    for (const block of response.content) {
      const step = stepFor(block);
      if (step) onStep({ type: "step", message: step });
    }
    messages.push({ role: "assistant", content: response.content });

    // Server-side search loop hit its iteration limit: re-send as-is to resume.
    if (response.stop_reason === "pause_turn") continue;

    const submit = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "submit_profile",
    );
    if (submit) {
      onStep({ type: "step", message: "Putting your profile together" });
      return { ...toProfile(submit.input as SubmitProfileInput), lat: place.lat, lng: place.lng };
    }

    if (nudged) throw new OnboardingError("We couldn't put a profile together. Please try again.");
    nudged = true;
    messages.push({ role: "user", content: "Please finish by calling submit_profile with what you found." });
  }
  throw new OnboardingError("The research took too many steps. Please try again.");
}

function toProfile(input: SubmitProfileInput): Omit<RestaurantProfile, "lat" | "lng"> {
  const clean = (s: string | null) => s?.trim() || null;
  return {
    name: input.name.trim(),
    location: input.neighborhood.trim(),
    address: clean(input.address),
    cuisine: clean(input.cuisine),
    priceRange: input.price_range,
    summary: clean(input.summary),
    hours: input.hours.filter((h) => DAYS.includes(h.day) && HHMM.test(h.opens) && HHMM.test(h.closes)),
    areas: [...new Set(input.areas.filter((a) => (AREAS as readonly string[]).includes(a)))],
    sources: input.sources.filter((s) => /^https?:\/\//.test(s.url)).slice(0, 5),
    confidence: input.confidence,
    missing: input.missing.map((m) => m.trim()).filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// 3. Suggest open spots
// ---------------------------------------------------------------------------

export type SpotSuggestion = {
  date: string; // YYYY-MM-DD, Seattle
  slot: (typeof SLOTS)[number]["value"];
  area: (typeof AREAS)[number];
  capacity: (typeof CAPACITIES)[number];
  price: (typeof PRICES)[number]["value"];
  features: (typeof FEATURES)[number][];
  reason: string;
};

export type ExistingSpot = { date: string; slot: string; area: string };

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

function weekday(date: string): Day {
  const [y, m, d] = date.split("-").map(Number);
  return DAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

/** True if the slot fits inside an open period that day, or if we don't know that day's hours. */
function withinHours(profile: RestaurantProfile, date: string, slot: SpotSuggestion["slot"]): boolean {
  if (profile.hours.length === 0) return true;
  const periods = profile.hours.filter((h) => h.day === weekday(date));
  if (periods.length === 0) return false; // hours known and the restaurant is closed that day
  const s = SLOTS.find((x) => x.value === slot)!;
  const [start, end] = [toMinutes(s.start), toMinutes(s.end)];
  return periods.some((p) => {
    const opens = toMinutes(p.opens);
    let closes = toMinutes(p.closes);
    if (closes <= opens) closes += 24 * 60; // closes after midnight
    return start >= opens && end <= closes;
  });
}

export async function suggestSpots(
  profile: RestaurantProfile,
  existing: ExistingSpot[],
): Promise<{ suggestions: SpotSuggestion[]; basis: "hours" | "estimate" }> {
  const days = upcomingDays(14).slice(1); // from tomorrow, so there's time to fill
  const dayValues = days.map((d) => d.value);
  const basis = profile.hours.length ? "hours" : "estimate";

  const tool: Anthropic.Beta.BetaTool = {
    name: "submit_suggestions",
    description: "Submit 3 to 5 suggested spots for the restaurant to publish, best first.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", enum: dayValues },
              slot: { type: "string", enum: SLOTS.map((s) => s.value) },
              area: { type: "string", enum: [...AREAS] },
              capacity: { type: "integer", enum: [...CAPACITIES] },
              price: { type: "string", enum: PRICES.map((p) => p.value) },
              features: { type: "array", items: { type: "string", enum: [...FEATURES] } },
              reason: { type: "string", description: "One plain sentence for the owner on why this spot is a good bet." },
            },
            required: ["date", "slot", "area", "capacity", "price", "features", "reason"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  };

  const prompt = [
    "You help a Seattle restaurant fill quiet periods by publishing a table or area that a community group can book for a small event (book clubs, language exchanges, supper clubs).",
    "Suggest 3 to 5 spots for the next two weeks, best first. Aim for times that are likely quiet for this kind of restaurant (often weekday early evenings or late lunches), never when it's closed, and spread them across different days.",
    basis === "hours"
      ? "Only suggest slots inside its opening hours."
      : "Its opening hours are unknown, so assume typical hours for this kind of restaurant and say the timing is an estimate in each reason.",
    "Use seating areas it actually has when known. Pick a seat count that suits a small group and the area. Keep the minimum spend in line with its price range.",
    "Reasons are for a busy owner: plain words, one sentence, no hype. Don't claim to know its actual busy times; you only have the profile below.",
    "",
    `Slots: ${SLOTS.map((s) => `${s.value} = ${s.label} ${s.hint}`).join("; ")}.`,
    `Days available: ${days.map((d) => `${d.value} (${d.weekday})`).join(", ")}.`,
    existing.length ? `Already published (don't repeat): ${existing.map((e) => `${e.date} ${e.slot} ${e.area}`).join("; ")}.` : "",
    "",
    "Restaurant profile:",
    JSON.stringify({
      name: profile.name,
      location: profile.location,
      cuisine: profile.cuisine,
      price_range: profile.priceRange,
      summary: profile.summary,
      hours: profile.hours,
      areas: profile.areas,
    }),
    "",
    "Call submit_suggestions once.",
  ].join("\n");

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      tools: [tool],
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });
    if (response.stop_reason === "refusal") throw new OnboardingError("We couldn't suggest spots right now.");

    const submit = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "submit_suggestions",
    );
    if (submit) {
      const raw = (submit.input as { suggestions: SpotSuggestion[] }).suggestions;
      return { suggestions: validateSuggestions(raw, profile, existing, dayValues), basis };
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: "Please call submit_suggestions." });
  }
  throw new OnboardingError("We couldn't suggest spots right now. Please try again.");
}

function validateSuggestions(
  raw: SpotSuggestion[],
  profile: RestaurantProfile,
  existing: ExistingSpot[],
  dayValues: string[],
): SpotSuggestion[] {
  const key = (s: { date: string; slot: string; area: string }) => `${s.date}|${s.slot}|${s.area}`;
  const taken = new Set(existing.map(key));
  const out: SpotSuggestion[] = [];
  for (const s of raw) {
    if (!dayValues.includes(s.date) || taken.has(key(s))) continue;
    if (!withinHours(profile, s.date, s.slot)) continue;
    taken.add(key(s));
    out.push({ ...s, features: [...new Set(s.features)], reason: s.reason.trim() });
    if (out.length === 5) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Profiles round-trip through the browser (the owner can edit name and
// location), so re-check the shape before using one server-side.
// ---------------------------------------------------------------------------

export function profileFromClient(input: unknown): RestaurantProfile | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const str = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const name = str(p.name, 120);
  const location = str(p.location, 160);
  if (!name || !location) return null;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const priceRange = (["$", "$$", "$$$", "$$$$"] as const).find((x) => x === p.priceRange) ?? null;
  return {
    name,
    location,
    address: str(p.address),
    cuisine: str(p.cuisine, 60),
    priceRange,
    summary: str(p.summary, 600),
    hours: arr(p.hours)
      .filter((h): h is RestaurantProfile["hours"][number] => {
        const x = h as Record<string, unknown>;
        return DAYS.includes(x?.day as Day) && HHMM.test(String(x?.opens)) && HHMM.test(String(x?.closes));
      })
      .slice(0, 21),
    areas: arr(p.areas).filter((a): a is RestaurantProfile["areas"][number] => (AREAS as readonly unknown[]).includes(a)),
    sources: [],
    confidence: (["high", "medium", "low"] as const).find((x) => x === p.confidence) ?? "low",
    missing: [],
    ...(isValidLatLng({ lat: p.lat, lng: p.lng }) ? { lat: p.lat as number, lng: p.lng as number } : { lat: null, lng: null }),
  };
}
