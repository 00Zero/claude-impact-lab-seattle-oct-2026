// Money is stored as integer minor units (cents). Shared by server and
// browser so amounts format and parse the same everywhere.

export const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

const MAX_AMOUNT_MINOR = 100_000_000; // 1,000,000.00

export function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function formatRange(low: number, high: number, currency: string) {
  return low === high
    ? formatMoney(low, currency)
    : `${formatMoney(low, currency)}–${formatMoney(high, currency)}`;
}

// Parses what a person types ("1,250", "$89.50") into minor units, or null.
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(minor) && minor <= MAX_AMOUNT_MINOR ? minor : null;
}

// From a model's number in major units (e.g. 149.5), or null if unusable.
export function toMinor(amount: number | null): number | null {
  if (amount === null || !Number.isFinite(amount) || amount < 0) return null;
  const minor = Math.round(amount * 100);
  return minor <= MAX_AMOUNT_MINOR ? minor : null;
}

export function minorToInput(minor: number | null) {
  return minor === null ? "" : (minor / 100).toFixed(minor % 100 === 0 ? 0 : 2);
}
