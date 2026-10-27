import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIntake } from "@/app/_intake/schema";
import { cleanIntake } from "@/app/_intake/integrity";

function load(path: string) {
  const r = parseIntake(readFileSync(path, "utf8"));
  if (!r.ok) throw new Error(r.issues.join("; "));
  return r.brief;
}

describe("cleanIntake", () => {
  it("leaves a consistent save file untouched", () => {
    const { warnings } = cleanIntake(load("fixtures/demo/intake.json"));
    expect(warnings).toEqual([]);
  });

  it("drops dangling references instead of crashing", () => {
    const { brief, warnings } = cleanIntake(load("tests/fixtures/intake-broken.json"));
    expect(brief.lexicon.find((l) => l.id === "lex_1")).toBeUndefined();
    expect(brief.roughMessaging[0]?.lexiconIds).not.toContain("lex_missing");
    expect(warnings).toHaveLength(2);
  });
});
