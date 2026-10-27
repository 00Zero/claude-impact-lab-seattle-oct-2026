import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENUMS, parseIntake } from "@/app/_intake/schema";
import { PLAIN } from "@/app/_intake/labels";

const demo = readFileSync("fixtures/demo/intake.json", "utf8");

describe("parseIntake", () => {
  it("parses the demo save file, including the owner's creatives", () => {
    const r = parseIntake(demo);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.brief.creatives.length).toBe(3);
  });

  it("keeps keys it doesn't know about, so newer skill versions still render", () => {
    const withExtra = JSON.stringify({ ...JSON.parse(demo), futureField: { a: 1 } });
    const r = parseIntake(withExtra);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.brief)).toContain("futureField");
  });

  it("explains invalid JSON in plain words", () => {
    const r = parseIntake("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toMatch(/^The save file isn't valid JSON/);
  });

  it("reports at most five schema problems", () => {
    const r = parseIntake(JSON.stringify({ schemaVersion: 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.length).toBeLessThanOrEqual(5);
  });
});

describe("PLAIN labels", () => {
  it("has a plain-word label for every enum value in the schema", () => {
    for (const [name, values] of Object.entries(ENUMS)) {
      const labels: Partial<Record<string, string>> = PLAIN[name as keyof typeof PLAIN];
      for (const v of values) expect(labels[v], `${name}.${v}`).toBeTruthy();
    }
  });
});
