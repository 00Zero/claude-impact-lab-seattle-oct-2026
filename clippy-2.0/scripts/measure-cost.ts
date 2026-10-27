// Measures the real cost of one analysis (fresh process, so nothing is cached).
// Usage: npx tsx --env-file=.env.local scripts/measure-cost.ts samples/invoice-cafe.png
//        npx tsx --env-file=.env.local scripts/measure-cost.ts --text "1000 12 oz paper hot cups"
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { runAnalysis } from "../lib/pipeline";

// USD per million tokens (input, output).
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const TAVILY_USD_PER_CREDIT = 0.008; // pay-as-you-go

const usage: Record<string, { calls: number; input: number; output: number }> = {};
const proto = Object.getPrototypeOf(new Anthropic({ apiKey: "x" }).messages);
const create = proto.create;
proto.create = function (body: { model: string }, ...rest: unknown[]) {
  const promise = create.call(this, body, ...rest);
  promise.then?.((res: Anthropic.Message) => {
    const u = (usage[body.model] ??= { calls: 0, input: 0, output: 0 });
    u.calls++;
    u.input += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    u.output += res.usage.output_tokens;
  }, () => {});
  return promise;
};

const args = process.argv.slice(2);
const input =
  args[0] === "--text"
    ? { text: args[1], ordersPerMonth: 4 }
    : { image: { base64: readFileSync(args[0]).toString("base64"), mediaType: "image/png" }, ordersPerMonth: 4 };

async function main() {
const t0 = Date.now();
const result = await runAnalysis(input, (e) => e.type === "progress" && console.log("  ·", e.message));
const items = result.items.length;
const urls = new Set(result.items.flatMap((r) => r.offers.map((o) => o.url))).size;

let claude = 0;
for (const [model, u] of Object.entries(usage)) {
  const [pin, pout] = PRICES[model] ?? [0, 0];
  const usd = (u.input * pin + u.output * pout) / 1e6;
  claude += usd;
  console.log(`${model}: ${u.calls} calls, ${u.input} in / ${u.output} out → $${usd.toFixed(4)}`);
}
// 2 basic searches per item (1 credit each) + extract (1 credit per 5 URLs; up to 6 URLs per item).
const credits = items * 2 + items * Math.ceil(6 / 5);
const tavily = credits * TAVILY_USD_PER_CREDIT;
console.log(`tavily: ~${credits} credits (upper bound) → $${tavily.toFixed(4)}`);
console.log(`items ${items}, offers ${urls}, ${((Date.now() - t0) / 1000).toFixed(1)}s, total ≈ $${(claude + tavily).toFixed(3)}`);
}

main();
