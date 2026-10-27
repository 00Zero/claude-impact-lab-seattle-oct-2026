import { analyzeItem, buildResult } from "./compare";
import { parseList, readInvoice } from "./input";
import { findOffers } from "./offers";
import { writeSuggestions } from "./suggest";
import type { AnalysisResult, ItemResult, Offer, ProgressEvent } from "./types";

export const MAX_ITEMS = 6;
export const LIMIT_NOTICE = "Clippy checked the first 6 items.";
export const TIMEOUT_NOTICE = "Some items took too long. Showing what we found.";

export interface AnalysisInput {
  text?: string;
  image?: { base64: string; mediaType: string };
  ordersPerMonth: number;
  location?: string; // city, state or ZIP; steers the store search
}

export interface AnalysisOptions {
  timeoutMs?: number; // whole-run guard
  suggestReserveMs?: number; // time kept back from the offer search for writing suggestions
}

export class NoItemsError extends Error {
  constructor() {
    super("No items found");
    this.name = "NoItemsError";
  }
}

const TIMED_OUT = Symbol("timed out");

// Resolves to TIMED_OUT once ms has passed; the timer is cleared when the work settles first.
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), Math.max(0, ms));
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

export async function runAnalysis(
  input: AnalysisInput,
  emit: (event: ProgressEvent) => void,
  { timeoutMs = 55_000, suggestReserveMs = 5_000 }: AnalysisOptions = {},
): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const remaining = () => timeoutMs - (Date.now() - startedAt);
  const progress = (message: string) => emit({ type: "progress", message });
  const notices: string[] = [];

  let items;
  if (input.image) {
    progress("Reading your invoice…");
    items = await readInvoice(input.image.base64, input.image.mediaType);
  } else {
    progress("Reading your list…");
    items = await parseList(input.text ?? "");
  }
  if (items.length === 0) throw new NoItemsError();
  progress(`Found ${items.length} ${items.length === 1 ? "item" : "items"}`);
  if (items.length > MAX_ITEMS) {
    items = items.slice(0, MAX_ITEMS);
    notices.push(LIMIT_NOTICE);
  }

  // A failed or unfinished search leaves its slot undefined, which means "no offers".
  const offers: (Offer[] | undefined)[] = new Array(items.length);
  const searches = items.map(async (item, i) => {
    progress(`Searching ${item.name}${input.location ? ` near ${input.location}` : ""}…`);
    offers[i] = await findOffers(item, input.location);
  });
  const searched = await withDeadline(Promise.allSettled(searches), remaining() - suggestReserveMs);
  if (searched === TIMED_OUT) notices.push(TIMEOUT_NOTICE);

  const offerCount = offers.reduce((sum, list) => sum + (list?.length ?? 0), 0);
  progress(`Comparing ${offerCount} ${offerCount === 1 ? "offer" : "offers"}…`);
  const results: ItemResult[] = items.map((item, i) => analyzeItem(item, offers[i] ?? []));

  progress("Writing suggestions…");
  let suggestions: string[] = [];
  try {
    const written = await withDeadline(writeSuggestions(results, input.ordersPerMonth), remaining());
    if (written !== TIMED_OUT) suggestions = written;
  } catch {
    // Suggestions are a nice-to-have; the savings table stands on its own.
  }

  return buildResult(results, input.ordersPerMonth, suggestions, notices.join(" ") || undefined);
}
