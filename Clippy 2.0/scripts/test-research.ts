// Usage:
//   npx tsx --env-file=.env.local scripts/test-research.ts --search "bread flour 50 lb bag"
//   npx tsx --env-file=.env.local scripts/test-research.ts "bread flour 50 lb bag" 50 lb
//   npx tsx --env-file=.env.local scripts/test-research.ts --all
import { findOffers } from "../lib/offers";
import { extractPages, searchItem } from "../lib/tavily";
import type { LineItem, Offer, Unit } from "../lib/types";

const ALL: [string, number, Unit][] = [
  ["bread flour 50 lb bag", 50, "lb"],
  ["granulated sugar 25 lb bag", 25, "lb"],
  ["12 oz paper hot cups 1000 count", 1000, "each"],
  ["12 oz hot cup lids 1000 count", 1000, "each"],
  ["dinner napkins 3000 count", 3000, "each"],
];

async function runSearch(query: string) {
  const t = Date.now();
  const hits = await searchItem(query);
  const pages = await extractPages(hits);
  for (const p of pages) console.log(`${p.text.includes("$") ? "$  " : "-  "} ${p.url}`);
  const withPrice = pages.filter((p) => p.text.includes("$")).length;
  console.log(`${withPrice}/${pages.length} pages with "$" in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  return withPrice;
}

// Does the offer's price appear in the page text we gave Claude?
async function priceOnPage(query: string, offer: Offer): Promise<boolean> {
  const pages = await extractPages(await searchItem(query)); // cached
  const text = pages.find((p) => p.url === offer.url)?.text.replace(/,/g, "") ?? "";
  return [offer.price.toFixed(2), String(offer.price)].some((s) => text.includes(s));
}

async function runItem(query: string, packSize: number, unit: Unit) {
  const item: LineItem = { id: query, name: query, searchQuery: query, packSize, unit, qtyPerOrder: 1 };
  const t = Date.now();
  const offers = await findOffers(item);
  const secs = (Date.now() - t) / 1000;
  console.log(`\n== ${query} (${packSize} ${unit}) — ${offers.length} offers in ${secs.toFixed(1)} s`);
  for (const o of offers) {
    const ship = o.shipping === null ? "?" : `$${o.shipping.toFixed(2)}`;
    const onPage = (await priceOnPage(query, o)) ? "on-page" : "NOT-ON-PAGE";
    console.log(`  ${o.store.padEnd(22)} $${o.price.toFixed(2).padStart(8)}  ${String(o.packSize).padStart(5)} ${o.unit.padEnd(4)} ship ${ship.padEnd(7)} ${o.confidence.padEnd(6)} ${onPage}  ${o.url}`);
  }
  const good = offers.filter((o) => o.confidence !== "low").length;
  return { query, offers, good, secs };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--search") {
    const n = await runSearch(args[1]);
    process.exit(n >= 3 ? 0 : 1);
  }
  if (args[0] === "--all") {
    const results = [];
    for (const [q, size, unit] of ALL) results.push(await runItem(q, size, unit));
    console.log("\n| item | offers | medium/high | seconds |\n|---|---|---|---|");
    for (const r of results) console.log(`| ${r.query} | ${r.offers.length} | ${r.good} | ${r.secs.toFixed(1)} |`);
    const passed = results.filter((r) => r.good >= 2).length >= 4 && results.every((r) => r.secs < 30);
    console.log(passed ? "\nQUALITY PASS" : "\nQUALITY FAIL");
    process.exit(passed ? 0 : 1);
  }
  if (args.length === 3) {
    const r = await runItem(args[0], Number(args[1]), args[2] as Unit);
    process.exit(r.offers.length >= 2 ? 0 : 1);
  }
  console.error("usage: --search <query> | <query> <packSize> <unit> | --all");
  process.exit(1);
}

main();
