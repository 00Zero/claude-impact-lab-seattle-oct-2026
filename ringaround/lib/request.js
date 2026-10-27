import { z } from "zod";
import { SERVICE_CATEGORIES } from "./service-categories";

export const TIMING_OPTIONS = [
  { id: "asap", label: "ASAP" },
  { id: "date", label: "On a date" },
  { id: "range", label: "Date range" },
  { id: "flexible", label: "Flexible" },
];

export const ARRIVAL_WINDOWS = [
  { id: "any", label: "Any time" },
  { id: "morning", label: "Morning", hint: "8am–12pm" },
  { id: "afternoon", label: "Afternoon", hint: "12–5pm" },
  { id: "evening", label: "Evening", hint: "5–8pm" },
];

export const TIME_ZONES = [
  { id: "America/New_York", label: "Eastern" },
  { id: "America/Chicago", label: "Central" },
  { id: "America/Denver", label: "Mountain" },
  { id: "America/Boise", label: "Mountain" },
  { id: "America/Phoenix", label: "Arizona" },
  { id: "America/Los_Angeles", label: "Pacific" },
  { id: "America/Anchorage", label: "Alaska" },
  { id: "Pacific/Honolulu", label: "Hawaii" },
];

export const INSTRUCTIONS_LIMIT = 500;

const isoDate = (error) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, error);
const amount = z
  .number({ error: "Enter a dollar amount." })
  .nonnegative("Enter a dollar amount.")
  .max(1_000_000, "Enter an amount under $1,000,000.")
  .nullable();

// The normalized request the form produces (and the future POST /api/requests
// accepts). `today` is the requester's local date as YYYY-MM-DD.
export function makeRequestSchema(today) {
  const notPast = (date) => date >= today;
  return z.object({
    serviceDescription: z
      .string()
      .trim()
      .min(1, "Tell us what you need done.")
      .max(1000, "Keep the description under 1,000 characters."),
    serviceCategory: z.enum(SERVICE_CATEGORIES.map((c) => c.id)),
    location: z.object({
      savedLocationId: z.string().nullable(),
      label: z.string().trim().max(60, "Keep the label under 60 characters."),
      formattedAddress: z.string().trim().min(8, "Enter the full address where the work happens."),
    }),
    timing: z.discriminatedUnion(
      "mode",
      [
        z.object({ mode: z.literal("asap") }),
        z.object({ mode: z.literal("flexible") }),
        z.object({
          mode: z.literal("date"),
          date: isoDate("Pick a date.").refine(notPast, "Pick today or a later date."),
        }),
        z
          .object({
            mode: z.literal("range"),
            start: isoDate("Pick a start date.").refine(notPast, "Pick today or a later date."),
            end: isoDate("Pick an end date."),
          })
          .refine((t) => t.end >= t.start, { error: "The end date can’t be before the start date.", path: ["end"] }),
      ],
      { error: "Choose when you need it." },
    ),
    arrivalWindow: z.enum(ARRIVAL_WINDOWS.map((w) => w.id)),
    timeZone: z.string().min(1),
    budget: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("unsure") }),
      z
        .object({ mode: z.literal("range"), min: amount, max: amount })
        .refine((b) => b.min !== null || b.max !== null, { error: "Enter a minimum, a maximum, or both.", path: ["min"] })
        .refine((b) => b.min === null || b.max === null || b.min <= b.max, {
          error: "The minimum can’t be more than the maximum.",
          path: ["max"],
        }),
    ]),
    specialInstructions: z
      .string()
      .trim()
      .max(INSTRUCTIONS_LIMIT, `Keep instructions under ${INSTRUCTIONS_LIMIT} characters.`),
  });
}

export function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Today's date (YYYY-MM-DD) in the job's time zone, falling back to the
// browser's local date if the zone isn't recognized.
export function todayIn(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return toISODate(new Date());
  }
}

function formatDay(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const usd = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Human-readable descriptions; each returns null while the answer is incomplete.
export function describeTiming(timing) {
  switch (timing.mode) {
    case "asap":
      return "As soon as possible";
    case "flexible":
      return "Flexible — whenever works";
    case "date":
      return timing.date ? formatDay(timing.date) : null;
    case "range":
      if (timing.start && timing.end) return `${formatDay(timing.start)} – ${formatDay(timing.end)}`;
      return timing.start ? `From ${formatDay(timing.start)}` : null;
    default:
      return null;
  }
}

export function describeArrival(id) {
  const slot = ARRIVAL_WINDOWS.find((w) => w.id === id);
  return slot && slot.hint ? `${slot.label}, ${slot.hint}` : null;
}

export function describeBudget(budget) {
  if (budget.mode === "unsure") return "Not sure — get quotes first";
  const has = (n) => n !== null && Number.isFinite(n);
  if (has(budget.min) && has(budget.max)) return `${usd(budget.min)}–${usd(budget.max)}`;
  if (has(budget.min)) return `${usd(budget.min)} or more`;
  if (has(budget.max)) return `Up to ${usd(budget.max)}`;
  return null;
}

export function timeZoneLabel(id) {
  return TIME_ZONES.find((z) => z.id === id)?.label ?? id;
}
