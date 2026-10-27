import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseIntake, type IntakeBrief } from "@/app/_intake/schema";
import { buildSim } from "@/app/_intake/sim-placeholder";
import { Plate } from "@/components/plates/Plate";
import { ResultsPlate } from "@/components/plates/Results";

const r = parseIntake(readFileSync("fixtures/demo/intake.json", "utf8"));
if (!r.ok) throw new Error("demo must parse");
const brief = r.brief;
const html = (plate: Parameters<typeof Plate>[0]["plate"], b: IntakeBrief = brief) =>
  renderToStaticMarkup(<Plate plate={plate} brief={b} updated={false} hideLinks={false} />);

describe("plates", () => {
  it("lays out the script-computed unit economics", () => {
    const h = html("economics");
    for (const v of ["$134.91", "$94.44", "$53.96", "$40.47"]) expect(h).toContain(v);
  });

  it("judges ads against the most the owner can spend", () => {
    expect(html("ads")).toContain("Judged against $53.96");
  });

  it("shows a missing metric as not recorded, never 0", () => {
    const b = { ...brief, priorExperiments: brief.priorExperiments.map((p, i) => (i === 0 ? { ...p, metrics: { ...p.metrics, clicks: undefined } } : p)) };
    expect(html("ads", b)).toContain("not recorded");
  });

  it("lists what the owner already made", () => {
    expect(html("creatives")).toContain("Strength first, scale second");
  });

  it("never shows owner-voice phrases as customer quotes", () => {
    const b = { ...brief, lexicon: brief.lexicon.map((l) => ({ ...l, voice: "owner" as const })) };
    expect(html("research", b)).not.toContain("<mark>");
  });

  it("shows each group's other forum and review quotes, not only the phrase-linked ones", () => {
    const h = html("research");
    const phraseLinked = brief.segments.reduce((n, s) => n + Math.min(2, brief.lexicon.filter((l) => l.segmentIds.includes(s.id)).length), 0);
    expect((h.match(/<q>/g) ?? []).length).toBeGreaterThan(phraseLinked);
    expect(h).toContain("https://www.mumsnet.com/talk/");
  });

  it("marks a card that changed after it was shown", () => {
    expect(renderToStaticMarkup(<Plate plate="economics" brief={brief} updated hideLinks={false} />)).toContain("Updated");
  });

  it("labels simulated results and the placeholder crowd honestly", () => {
    const h = renderToStaticMarkup(<ResultsPlate brief={brief} sim={buildSim(brief)} />);
    expect(h).toContain("Simulated preference, n = 48. Not a conversion rate.");
    expect(h).toContain("Placeholder choices: the simulation step isn&#x27;t built yet.");
  });
});
