import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_SCRIPT } from "@/app/_intake/demo-script";
import { PLATE_IDS } from "@/app/_session/events";

describe("demo replay script", () => {
  it("only shows cards that exist", () => {
    for (const ev of DEMO_SCRIPT.interview) {
      if (ev.kind === "plate") expect(PLATE_IDS).toContain(ev.plate);
    }
  });

  it("opens with the demo owner's exact one-liner", () => {
    expect(DEMO_SCRIPT.oneLiner).toBe(readFileSync("fixtures/demo/one-liner.txt", "utf8").trim());
  });

  it("asks about what the owner already made before the price walk-through", () => {
    const plates = DEMO_SCRIPT.interview.flatMap((e) => (e.kind === "plate" ? [e.plate] : []));
    expect(plates.indexOf("creatives")).toBeLessThan(plates.indexOf("economics"));
  });
});
