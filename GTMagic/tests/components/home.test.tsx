import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionList } from "@/components/home/SessionList";

describe("SessionList", () => {
  const sessions = [
    { id: "abcd1234ef", business: "keepstrong", lastEventAt: "2026-10-25T12:00:00.000Z", done: false },
    { id: "ffff0000aa", business: null, lastEventAt: null, done: true },
  ];

  it("labels each session as live or finished without an unsized icon", () => {
    const html = renderToStaticMarkup(<SessionList sessions={sessions} />);
    expect(html).toContain("Live");
    expect(html).toContain("Finished");
    expect(html).not.toMatch(/<svg class=""/);
  });

  it("links each session and names unnamed ones plainly", () => {
    const html = renderToStaticMarkup(<SessionList sessions={sessions} />);
    expect(html).toContain('href="/session/abcd1234ef"');
    expect(html).toContain("New session");
  });

  it("explains how to start one when there are none", () => {
    expect(renderToStaticMarkup(<SessionList sessions={[]} />)).toContain("Start one above");
  });
});
