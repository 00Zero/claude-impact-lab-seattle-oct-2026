import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseIntake } from "@/app/_intake/schema";
import { SessionEnded } from "@/components/session/SessionEnded";

const r = parseIntake(readFileSync("fixtures/demo/intake.json", "utf8"));
if (!r.ok) throw new Error("demo fixture must parse");
const brief = r.brief;

describe("SessionEnded", () => {
  it("says the page takes no more questions and points a ready save file to the next step", () => {
    const html = renderToStaticMarkup(<SessionEnded business="keepstrong-demo" brief={brief} />);
    expect(html).toContain("won&#x27;t take more questions");
    expect(html).toContain("gtm-workspace/keepstrong-demo");
    expect(html).toContain('href="/run/keepstrong-demo"');
    expect(html).toContain(`What should I do next with my ${brief.business.name} save file?`);
    expect(html).toContain('href="/"');
  });

  it("says when the save file isn't finished", () => {
    const unready = { ...brief, readiness: { ...brief.readiness, status: "needs-more" as const } };
    const html = renderToStaticMarkup(<SessionEnded business="keepstrong-demo" brief={unready} />);
    expect(html).toContain("isn&#x27;t finished yet");
    expect(html).toContain("See what your save file still needs");
  });

  it("offers only a fresh start when the session stopped before a save file existed", () => {
    const html = renderToStaticMarkup(<SessionEnded business="keepstrong-demo" brief={null} />);
    expect(html).toContain("before your save file was finished");
    expect(html).not.toContain("/run/");
    expect(html).not.toContain("What should I do next");
    expect(html).toContain('href="/"');
  });

  it("encodes the business in the link", () => {
    expect(renderToStaticMarkup(<SessionEnded business="a b" brief={brief} />)).toContain('href="/run/a%20b"');
  });
});
