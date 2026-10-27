// Shared by price-book forms and the server.

export const PRICE_CATEGORIES = [
  { value: "service_fee", label: "Service call / diagnostic fee" },
  { value: "labor", label: "Labor" },
  { value: "repair", label: "Repair" },
  { value: "part", label: "Part" },
] as const;
export type PriceCategory = (typeof PRICE_CATEGORIES)[number]["value"];

export const PRICE_UNITS = [
  { value: "flat", label: "Flat" },
  { value: "each", label: "Each" },
  { value: "hour", label: "Per hour" },
] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number]["value"];

export const PRICE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
// Matches the price-documents bucket. Word files aren't read directly;
// "Save as PDF" first.
export const PRICE_DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const PRICE_DOCUMENT_ACCEPT = ".pdf,.txt,.csv,.jpg,.jpeg,.png,.webp";

export function categoryLabel(category: string) {
  return PRICE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function unitLabel(unit: string) {
  return PRICE_UNITS.find((u) => u.value === unit)?.label ?? unit;
}
