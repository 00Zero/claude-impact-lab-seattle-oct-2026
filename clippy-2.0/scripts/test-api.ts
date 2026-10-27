// Usage:
//   npx tsx scripts/test-api.ts                               validation checks (400s)
//   npx tsx scripts/test-api.ts --file samples/invoice-cafe.png [--save fixtures/real-run.json]
//   npx tsx scripts/test-api.ts --text "50 lb flour, 1000 coffee cups 12oz"
// Needs `npm run dev` on http://localhost:3000.
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import type { AnalysisResult, ProgressEvent } from "../lib/types";

const URL_ = process.env.API_URL ?? "http://localhost:3000/api/analyze";
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

let failures = 0;
function check(ok: boolean, label: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

async function expect400(label: string, form: FormData) {
  const res = await fetch(URL_, { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  check(res.status === 400 && typeof body?.error === "string", `${label} → ${res.status} ${JSON.stringify(body)}`);
}

async function validation() {
  await expect400("empty POST", new FormData());
  const big = new FormData();
  big.append("invoice", new Blob([new Uint8Array(6 * 1024 * 1024)], { type: "image/png" }), "big.png");
  await expect400("6 MB file", big);
  const pdf = new FormData();
  pdf.append("invoice", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "a.pdf");
  await expect400("wrong type", pdf);
  const orders = new FormData();
  orders.append("list", "flour");
  orders.append("ordersPerMonth", "99");
  await expect400("ordersPerMonth 99", orders);
}

async function run(form: FormData, expectedItems?: number): Promise<AnalysisResult | null> {
  const started = Date.now();
  const res = await fetch(URL_, { method: "POST", body: form });
  check(res.ok, `status ${res.status}`);
  check((res.headers.get("content-type") ?? "").startsWith("application/x-ndjson"), "content-type is NDJSON");
  if (!res.body) return null;

  const events: ProgressEvent[] = [];
  const decoder = new TextDecoder();
  let buffer = "";
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = JSON.parse(line) as ProgressEvent;
      events.push(event);
      const t = ((Date.now() - started) / 1000).toFixed(1).padStart(5);
      console.log(`  ${t}s  ${event.type === "progress" ? event.message : event.type === "error" ? `ERROR ${event.message}` : "result"}`);
    }
  }
  const seconds = (Date.now() - started) / 1000;

  const progress = events.flatMap((e) => (e.type === "progress" ? [e.message] : []));
  const last = events.at(-1);
  const order = [/^Reading your/, /^Found \d+ items?$/, /^Searching /, /^Comparing \d+ offers?…$/, /^Writing suggestions…$/];
  const firstIndex = order.map((re) => progress.findIndex((m) => re.test(m)));
  check(firstIndex.every((i) => i >= 0) && firstIndex.every((i, k) => k === 0 || i > firstIndex[k - 1]), "events stream in order");
  check(last?.type === "result", `last event is the result (${last?.type})`);
  check(seconds < 60, `finished in ${seconds.toFixed(1)} s (< 60 s)`);
  if (last?.type !== "result") return null;

  const r = last.data;
  if (expectedItems !== undefined) check(r.items.length === expectedItems, `${r.items.length} items (expected ${expectedItems})`);
  else check(r.items.length > 0, `${r.items.length} items`);
  const bests = r.items.flatMap((i) => (i.best ? [i.best] : []));
  check(bests.length > 0, `${bests.length}/${r.items.length} items have a best offer`);
  check(bests.every((b) => /^https?:\/\//.test(b.url)), "every best offer has an http URL");
  for (const i of r.items) {
    const b = i.best;
    console.log(
      `  - ${i.item.name}: ${b ? `$${b.price} at ${b.store} ($${b.unitCost.toFixed(3)}/${b.baseUnit}) ${b.url}` : "no offer"}` +
        (i.savingsPerOrder !== null ? `  saves $${i.savingsPerOrder}/order` : ""),
    );
  }
  console.log(
    `  totals: $${r.totalSavingsPerOrder}/order, $${r.totalSavingsPerMonth}/month, $${r.totalSavingsPerYear}/year` +
      ` (${r.ordersPerMonth} orders/month)${r.notice ? `  notice: ${r.notice}` : ""}`,
  );
  console.log(`  suggestions: ${JSON.stringify(r.suggestions)}`);
  return r;
}

async function main() {
  const file = arg("--file");
  const text = arg("--text");
  if (file) {
    const types: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
    const form = new FormData();
    form.append("invoice", new Blob([readFileSync(file)], { type: types[extname(file).toLowerCase()] ?? "image/png" }), file);
    form.append("ordersPerMonth", arg("--orders") ?? "4");
    const result = await run(form, arg("--items") ? Number(arg("--items")) : undefined);
    if (result) check(result.totalSavingsPerOrder > 0 && result.totalSavingsPerYear > 0, "totals > 0");
    const save = arg("--save");
    if (result && save) {
      writeFileSync(save, JSON.stringify(result, null, 2) + "\n");
      console.log(`  saved ${save}`);
    }
  } else if (text) {
    const form = new FormData();
    form.append("list", text);
    form.append("ordersPerMonth", arg("--orders") ?? "4");
    await run(form);
  } else {
    await validation();
  }
  console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
