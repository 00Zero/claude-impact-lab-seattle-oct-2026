import { z } from "zod";
import { TRADE_OTHER_MAX_LENGTH, TRADES, type Trade } from "@/lib/trades";
import { PHONE_PATTERN, PHONE_PATTERN_MESSAGE } from "@/lib/validation";

// Business details shared by onboarding and workspace settings.

// Computed on the server and passed to forms so the server and browser
// render the same list.
export const TIME_ZONES = Array.from(
  new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]),
);

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const tradeValues = TRADES.map((trade) => trade.value) as [Trade, ...Trade[]];

export const workspaceDetailsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Enter your business name." })
      .max(120, { error: "Keep the business name under 120 characters." }),
    trade: z.enum(tradeValues, { error: "Choose your trade." }),
    tradeOther: z
      .string()
      .trim()
      .max(TRADE_OTHER_MAX_LENGTH, {
        error: `Keep your trade under ${TRADE_OTHER_MAX_LENGTH} characters.`,
      }),
    contactEmail: z
      .string()
      .trim()
      .pipe(z.email({ error: "Enter a valid email address." })),
    contactPhone: z
      .string()
      .trim()
      .max(40, { error: "Enter a shorter phone number." })
      .regex(PHONE_PATTERN, { error: PHONE_PATTERN_MESSAGE }),
    timezone: z
      .string()
      .min(1, { error: "Choose your timezone." })
      .refine(isValidTimeZone, { error: "Choose a valid timezone." }),
  })
  .refine((data) => data.trade !== "other" || data.tradeOther.length > 0, {
    error: "Enter your trade.",
    path: ["tradeOther"],
    // Run even when other fields are invalid, so all errors show at once.
    when: (payload) =>
      !payload.issues.some((issue) =>
        ["trade", "tradeOther"].includes(String(issue.path?.[0])),
      ),
  });

// Matches the checks on public.organizations.
export const LINK_EXPIRY_DAYS = { min: 1, max: 30 };
export const PHOTO_RETENTION_OPTIONS = [30, 90, 180, 365] as const;
