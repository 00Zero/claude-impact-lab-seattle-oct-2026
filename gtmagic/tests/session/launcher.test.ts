import { describe, expect, it } from "vitest";
import { ALLOWED_TOOLS, claudeArgs } from "@/app/_session/launcher";

describe("claudeArgs", () => {
  const args = claudeArgs("abcd1234ef");
  const allowed = args[args.indexOf("--allowedTools") + 1] ?? "";

  it("runs Claude Code headless, refusing anything not pre-approved", () => {
    expect(args[0]).toBe("-p");
    expect(args).toContain("--permission-mode");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("dontAsk");
  });

  it("tells it which session to drive, and not to start another", () => {
    expect(args[1]).toContain("abcd1234ef");
    expect(args[1]).toContain("gtm-web");
    expect(args[1]).toMatch(/don't run `ui start`/i);
  });

  it("pre-approves exactly the addendum's list", () => {
    for (const t of [
      "Bash(node .claude/skills/gtm-web/scripts/ui.ts *)",
      "Bash(python3 .claude/skills/gtm-intake/scripts/*)",
      "Bash(cp gtm-workspace/*)",
      "Bash(mkdir -p gtm-workspace/*)",
      "Read", "Glob", "Grep", "Edit(gtm-workspace/**)", "WebSearch", "WebFetch", "Skill",
    ]) expect(ALLOWED_TOOLS).toContain(t);
    expect(allowed).toBe(ALLOWED_TOOLS.join(","));
  });

  it("uses Edit rules for file paths (Claude Code ignores Write(path) rules)", () => {
    expect(ALLOWED_TOOLS.some((t) => t.startsWith("Write("))).toBe(false);
  });

  it("never allows arbitrary shell commands", () => {
    expect(ALLOWED_TOOLS).not.toContain("Bash");
    expect(ALLOWED_TOOLS.some((t) => t === "Bash(*)" || t === "Bash(**)")).toBe(false);
    expect(args).not.toContain("--dangerously-skip-permissions");
  });
});
