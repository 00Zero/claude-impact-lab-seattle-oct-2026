import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIntake } from "@/app/_intake/schema";
import { buildSim } from "@/app/_intake/sim-placeholder";

const r = parseIntake(readFileSync("fixtures/demo/intake.json", "utf8"));
if (!r.ok) throw new Error("demo must parse");
const brief = r.brief;

describe("buildSim (placeholder)", () => {
  it("splits 48 customers by normalised group shares", () => {
    const sim = buildSim(brief);
    expect(sim.size).toBe(48);
    expect(sim.customers).toHaveLength(48);
    expect(sim.perSegment).toEqual([34, 14]);
  });

  it("normalises rough relative shares like 7 and 3", () => {
    const rough = { ...brief, segments: brief.segments.map((s, i) => ({ ...s, sampleShare: i === 0 ? 7 : 3 })) };
    expect(buildSim(rough).perSegment).toEqual([34, 14]);
  });

  it("adds the owner's own line from their website creative", () => {
    const own = buildSim(brief).messages.filter((m) => m.isOwn);
    expect(own).toEqual([expect.objectContaining({ headline: "Strength first, scale second" })]);
  });

  it("gives every customer real customer-voice phrases only", () => {
    for (const c of buildSim(brief).customers) {
      for (const v of c.voice) expect(brief.lexicon.find((l) => l.phrase === v.phrase)?.voice ?? "customer").toBe("customer");
    }
  });
});
