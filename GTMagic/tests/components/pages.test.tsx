import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseIntake } from "@/app/_intake/schema";
import { SavedRun } from "@/components/run/SavedRun";

const r = parseIntake(readFileSync("fixtures/demo/intake.json", "utf8"));
if (!r.ok) throw new Error("demo must parse");

describe("SavedRun", () => {
  it("shows every card in story order with a download of the original file", () => {
    const html = renderToStaticMarkup(<SavedRun slug="demo" brief={r.brief} warnings={[]} hideLinks={false} />);
    const order = ["Plain AI guess", "What you&#x27;ve already made", "What a new customer can cost", "Your 2 past campaigns",
      "What you told me, sorted", "2 customer groups", "What the evidence says", "Your save file"];
    const at = order.map((t) => html.indexOf(t));
    expect(at.every((i) => i >= 0), JSON.stringify(at)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('href="/api/businesses/demo/intake.json"');
  });

  it("lists integrity warnings as a notice", () => {
    const html = renderToStaticMarkup(<SavedRun slug="demo" brief={r.brief} warnings={["Phrase lex_1 points at ev_missing"]} hideLinks={false} />);
    expect(html).toContain("Phrase lex_1 points at ev_missing");
  });
});
