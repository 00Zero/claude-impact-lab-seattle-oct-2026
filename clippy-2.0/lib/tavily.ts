import { tavily } from "@tavily/core";

export interface SearchHit { url: string; title: string; content: string; publishedDate?: string }
export interface Page { url: string; title: string; text: string; publishedDate?: string }

// Domains that never give a usable store price.
export const SKIP_DOMAINS = [
  "reddit.com", "youtube.com", "pinterest.com", "facebook.com", "instagram.com", "tiktok.com",
  "quora.com", "wikipedia.org", "medium.com", "twitter.com", "x.com", "linkedin.com",
  "yelp.com", "tripadvisor.com", "nytimes.com", "seriouseats.com", "kingarthurbaking.com",
  "allrecipes.com", "foodnetwork.com", "thekitchn.com", "bonappetit.com", "consumerreports.org",
  "wirecutter.com", "goodhousekeeping.com", "bhg.com", "forbes.com", "businessinsider.com",
  "alibaba.com", "made-in-china.com", "indiamart.com", "ebay.com", "etsy.com",
  // Price statistics and history charts: averages going back years, not a price you can buy at.
  "stlouisfed.org", "bls.gov", "usda.gov", "statista.com", "tradingeconomics.com", "indexmundi.com", "ycharts.com",
];

const NOT_A_STORE = /\b(blog|article|articles|news|review|reviews|best\s+\d*|top\s+\d+|vs\.?|recipe|recipes|how\s+to|guide|forum)\b/i;
const NOT_A_STORE_PATH = /\/(blog|blogs|news|article|articles|reviews?|recipes?|guides?|forum|wiki)(\/|$)/i;
// PDFs are printed catalogs and price lists, often years old, not a live store price.
const DOCUMENT_PATH = /\.(pdf|docx?|xlsx?|csv)$/i;

// Single-product pages: Walmart /ip/, Amazon /dp/, Shopify /products/, Target and Home Depot /p/, etc.
const PRODUCT_PATH = /\/(ip|dp|gp\/product|products?|p|item|itm|sku)\/|\/\d{5,}(\.html)?$|-p-\d+/i;
// Category, browse and search-result pages list many products, so their link isn't the product priced.
const LISTING_PATH = /\/(c|cp|kp|b|browse|search|s|category|categories|collections?|shop|catalog|department|departments|aisle|brands?|deals)(\/|$)/i;
const SEARCH_PARAMS = ["q", "k", "query", "search", "searchterm", "keyword", "keywords", "st"];

export function isListingPage(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return true; }
  if (PRODUCT_PATH.test(u.pathname)) return false;
  if ([...u.searchParams.keys()].some((k) => SEARCH_PARAMS.includes(k.toLowerCase()))) return true;
  return LISTING_PATH.test(u.pathname);
}

const MAX_RESULTS = 6;
const MIN_FRESH_HITS = 3; // fewer than this from the past year, widen the search once
const MAX_AGE_DAYS = 365;
const PAGE_CHARS = 6000;

const searchCache = new Map<string, SearchHit[]>();
const pageCache = new Map<string, Page>();

let client: ReturnType<typeof tavily> | null = null;
function tvly() {
  if (!client) client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  return client;
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export function isSkipped(url: string): boolean {
  const h = host(url);
  return !h || SKIP_DOMAINS.some((d) => h === d || h.endsWith("." + d));
}

export function looksLikeStore(hit: SearchHit): boolean {
  if (isSkipped(hit.url)) return false;
  if (NOT_A_STORE.test(hit.title)) return false;
  try {
    const path = new URL(hit.url).pathname;
    if (path === "/" || NOT_A_STORE_PATH.test(path) || DOCUMENT_PATH.test(path)) return false;
  } catch { return false; }
  return !isListingPage(hit.url);
}

// A page Tavily dates to more than a year ago shows an old price. Undated pages pass; the prompt checks those.
export function isStale(hit: SearchHit, now = new Date()): boolean {
  if (!hit.publishedDate) return false;
  const t = Date.parse(hit.publishedDate);
  return !Number.isNaN(t) && now.getTime() - t > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

// A trailing "Austin TX" steers results to stores that sell or deliver there ("near Austin" pulls in recipes and blogs).
export function withLocation(query: string, location?: string): string {
  const place = location?.trim();
  return place ? `${query} ${place}` : query;
}

type Search = { q: string; recent: boolean };

async function runSearches(searches: Search[]) {
  return Promise.all(
    searches.map(({ q, recent }) =>
      tvly()
        .search(q, {
          maxResults: 10,
          // SKIP_DOMAINS is filtered below in looksLikeStore: Tavily's excludeDomains sometimes returns no results at all.
          country: "united states", // prices are in USD
          ...(recent ? { timeRange: "year" as const } : {}),
        })
        .catch((err: Error) => {
          console.error(`tavily search failed for "${q}":`, err.message);
          return null;
        }),
    ),
  );
}

export async function searchItem(query: string, location?: string): Promise<SearchHit[]> {
  const key = `${query}|${location?.trim().toLowerCase() ?? ""}`;
  const cached = searchCache.get(key);
  if (cached) return cached;
  const priceQuery = withLocation(`${query} price`, location);
  // Past year first. Some store pages carry no date and drop out of that filter, so widen once if too few come back.
  let responses = await runSearches([
    { q: priceQuery, recent: true },
    { q: withLocation(`${query} wholesale buy`, location), recent: true },
  ]);
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  const collect = () => {
    for (const r of responses.flatMap((res) => res?.results ?? [])) {
      const hit = { url: r.url, title: r.title ?? "", content: r.content ?? "", publishedDate: r.publishedDate || undefined };
      if (seen.has(hit.url) || !looksLikeStore(hit) || isStale(hit)) continue;
      seen.add(hit.url);
      hits.push(hit);
    }
  };
  collect();
  const firstFailed = responses.every((r) => r === null);
  if (hits.length < MIN_FRESH_HITS) {
    responses = await runSearches([{ q: priceQuery, recent: false }]);
    collect();
    if (firstFailed && responses.every((r) => r === null)) return []; // don't cache failures
  }
  const result = hits.slice(0, MAX_RESULTS);
  searchCache.set(key, result);
  return result;
}

// Keep a window of the page around the first "$" so the price survives the cut.
export function trimAroundPrice(text: string, max = PAGE_CHARS): string {
  if (text.length <= max) return text;
  const i = text.indexOf("$");
  if (i < 0) return text.slice(0, max);
  const start = Math.max(0, Math.min(i - Math.floor(max / 3), text.length - max));
  return text.slice(start, start + max);
}

export async function extractPages(hits: SearchHit[]): Promise<Page[]> {
  const todo = hits.filter((h) => !pageCache.has(h.url));
  if (todo.length) {
    const res = await tvly().extract(todo.map((h) => h.url)).catch((err: Error) => {
      console.error("tavily extract failed:", err.message);
      return { results: [] as { url: string; title: string | null; rawContent: string }[] };
    });
    const byUrl = new Map(res.results.map((r) => [r.url, r]));
    for (const h of todo) {
      const raw = byUrl.get(h.url)?.rawContent ?? "";
      // Fall back to the search snippet when extract fails or the page has no price.
      const text = raw.includes("$") ? trimAroundPrice(raw) : raw ? `${h.content}\n\n${trimAroundPrice(raw)}` : h.content;
      pageCache.set(h.url, { url: h.url, title: h.title, text, publishedDate: h.publishedDate });
    }
  }
  return hits.map((h) => pageCache.get(h.url)!);
}
