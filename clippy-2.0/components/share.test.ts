import { describe, expect, it } from "vitest";
import real from "../fixtures/real-run.json";
import type { AnalysisResult } from "../lib/types";
import { shareText, topFindings } from "./share";

const result = real as AnalysisResult;

describe("top findings", () => {
  it("puts the biggest savings first and skips items without a store price", () => {
    const top = topFindings(result);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top.every((r) => r.best)).toBe(true);
    const savings = top.map((r) => r.savingsPerOrder ?? -1);
    expect(savings).toEqual([...savings].sort((a, b) => b - a));
  });
  it("share text has the totals, numbered items, links and the date note", () => {
    const text = shareText(result);
    expect(text).toMatch(/^Clippy found \$[\d,.]+ a month/);
    expect(text).toContain("1. ");
    expect(text).toMatch(/https?:\/\//);
    expect(text).toContain("Check before you buy.");
    for (const bad of ["NaN", "undefined", "null"]) expect(text).not.toContain(bad);
  });
});
