import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NotAnInvoiceError, parseList, readInvoice } from "../lib/input";
import { buildSuggestionInput, templateSuggestions, writeSuggestions } from "../lib/suggest";
import type { ItemResult, LineItem, RankedOffer } from "../lib/types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

let failures = 0;
function check(ok: boolean, label: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

function show(items: LineItem[]) {
  for (const it of items) {
    console.log(
      `  ${it.id}  ${it.name} | "${it.searchQuery}" | ${it.packSize} ${it.unit} x${it.qtyPerOrder}` +
        ` | paid ${it.pricePaid ?? "-"} | ship ${it.shippingPaid ?? "-"}`,
    );
  }
}

function readPng(name: string) {
  return readFileSync(path.join("samples", name)).toString("base64");
}

async function testInvoice() {
  console.log("\n== samples/invoice-cafe.png");
  const items = await readInvoice(readPng("invoice-cafe.png"), "image/png");
  show(items);
  check(items.length === 5, "exactly 5 items");
  check(JSON.stringify(items.map((i) => i.pricePaid)) === JSON.stringify([72, 24.5, 119, 68, 54]), "pricePaid 72, 24.5, 119, 68, 54");
  check(JSON.stringify(items.map((i) => i.qtyPerOrder)) === JSON.stringify([1, 2, 1, 1, 1]), "qty 1, 2, 1, 1, 1");
  check(items.every((i) => i.shippingPaid === 3), "shippingPaid 3 each");
  check(
    items.every((i) => !/NWR|\d{4}-|northwest/i.test(i.searchQuery + " " + i.name)),
    "no item codes or supplier name",
  );
}

async function testList() {
  const text = "50 lb flour, 1000 coffee cups 12oz, 25 lb sugar";
  console.log(`\n== --text "${text}"`);
  const items = await parseList(text);
  show(items);
  check(items.length === 3, "3 items");
  const [flour, cups, sugar] = items;
  check(/flour/i.test(flour?.name ?? "") && flour.packSize === 50 && flour.unit === "lb", "flour 50 lb");
  check(/cup/i.test(cups?.name ?? "") && cups.packSize === 1000 && cups.unit === "each", "cups 1000 each");
  check(/sugar/i.test(sugar?.name ?? "") && sugar.packSize === 25 && sugar.unit === "lb", "sugar 25 lb");
  check(items.every((i) => i.pricePaid === undefined && i.qtyPerOrder === 1), "no prices, qty 1");
}

async function testNotInvoice() {
  console.log("\n== samples/not-an-invoice.png");
  try {
    const items = await readInvoice(readPng("not-an-invoice.png"), "image/png");
    show(items);
    check(false, "throws NotAnInvoiceError");
  } catch (err) {
    check(err instanceof NotAnInvoiceError, `throws NotAnInvoiceError (${(err as Error).name})`);
  }
}

function handMadeResult(item: LineItem, store: string, unitCost: number, current: number, savings: number): ItemResult {
  const best: RankedOffer = {
    itemId: item.id, store, title: item.name, url: "https://example.com/p", price: unitCost * item.packSize,
    packSize: item.packSize, unit: item.unit, shipping: 0, confidence: "high", checkedAt: "2026-10-25",
    unitCost, baseUnit: item.unit === "each" ? "each" : "lb",
  };
  return { item, best, offers: [best], currentUnitCost: current, savingsPerOrder: savings };
}

async function testSuggestions() {
  console.log("\n== writeSuggestions (live)");
  const base = { searchQuery: "", qtyPerOrder: 1 } as const;
  const results: ItemResult[] = [
    handMadeResult({ ...base, id: "item-1", name: "12 oz paper hot cups, 1000 ct", packSize: 1000, unit: "each" }, "WebstaurantStore", 0.089, 0.122, 33),
    handMadeResult({ ...base, id: "item-2", name: "Bread flour, 50 lb bag", packSize: 50, unit: "lb" }, "Costco Business Center", 1.1, 1.5, 20),
    handMadeResult({ ...base, id: "item-3", name: "Dinner napkins, 3000 ct", packSize: 3000, unit: "each" }, "Amazon", 0.019, 0.019, 0),
  ];
  const input = JSON.stringify({ ordersPerMonth: 4, items: buildSuggestionInput(results) });
  const tips = await writeSuggestions(results, 4);
  for (const t of tips) console.log(`  - ${t}`);
  const fromTemplate = JSON.stringify(tips) === JSON.stringify(templateSuggestions(buildSuggestionInput(results)));
  check(!fromTemplate, "tips written by Claude (not the template fallback)");
  check(tips.length >= 1 && tips.length <= 3, "1 to 3 tips");
  check(tips.every((t) => t.split(/\s+/).length < 25), "each tip < 25 words");
  const allowed = new Set(input.match(/\d+(?:\.\d+)*/g));
  const stray = tips.flatMap((t) => (t.replace(/,/g, "").match(/\d+(?:\.\d+)*/g) ?? []).filter((n) => !allowed.has(n)));
  check(stray.length === 0, `every number appears in the input${stray.length ? ` (stray: ${stray.join(", ")})` : ""}`);
  check(/WebstaurantStore/.test(tips[0]), "biggest saving first");
}

async function main() {
  const textArg = process.argv.indexOf("--text");
  if (textArg !== -1) {
    show(await parseList(process.argv[textArg + 1] ?? ""));
    return;
  }
  await Promise.all([testInvoice(), testList(), testNotInvoice(), testSuggestions()].map((p) => p.catch((e) => {
    console.error(e);
    failures++;
  })));
  if (failures) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAGENT 3 PASSED");
}

main();
