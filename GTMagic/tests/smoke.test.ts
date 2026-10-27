import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("scaffold", () => {
  it("ships the Jost font files with the app", () => {
    expect(existsSync("src/app/fonts/jost-400.woff2")).toBe(true);
    expect(existsSync("src/app/fonts/jost-500.woff2")).toBe(true);
  });

  it("carries the DESIGN.md ground colour in the base stylesheet", () => {
    expect(readFileSync("src/app/styles/base.css", "utf8")).toContain("--ground: #fbfbf8");
  });
});
