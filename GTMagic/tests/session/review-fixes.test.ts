import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { readBusiness } from "@/app/_intake/workspace";
import { parseTranscript } from "@/app/_session/events";
import { postAnswer } from "@/app/_session/post-answer";
import { createSession, readSession } from "@/app/_session/store";

const CLI = join(process.cwd(), ".claude/skills/gtm-web/scripts/ui.ts");
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gtm-fix-"));
  process.env.GTM_ROOT = root;
});
const sdir = (id: string) => join(root, "gtm-workspace", ".sessions", id);

describe("review fixes", () => {
  it("#1 waits less than Claude Code's 2-minute Bash limit by default, and the skill says to re-wait", () => {
    const src = readFileSync(CLI, "utf8");
    const n = Number(/DEFAULT_WAIT_S = (\d+)/.exec(src)?.[1]);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(120);
    expect(readFileSync(".claude/skills/gtm-web/SKILL.md", "utf8")).toMatch(/times out.*run `ui wait`, never `ui ask` again/is);
  });

  it("#2 gives every event a unique id even when ui commands run in parallel", async () => {
    const id = createSession();
    await Promise.all(Array.from({ length: 6 }, (_, i) => new Promise<void>((done) => {
      spawn("node", [CLI, "say", id, `line ${i}`], { env: { ...process.env, GTM_ROOT: root } }).on("close", () => done());
    })));
    const ids = parseTranscript(readFileSync(join(sdir(id), "transcript.jsonl"), "utf8")).map((e) => e.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it("#3 a session with no events goes quiet from its creation time", async () => {
    const id = createSession();
    const s = await readSession(id);
    expect(s?.lastEventAt).toBe(JSON.parse(readFileSync(join(sdir(id), "session.json"), "utf8")).createdAt);
  });

  it("#4 reports a failed send instead of throwing, so the owner's text is kept", async () => {
    const offline = await postAnswer("abc", "ev-1", "my long answer", [], () => Promise.reject(new Error("down")));
    expect(offline).toEqual({ ok: false, error: expect.stringMatching(/couldn't reach/i) });
    const tooBig = await postAnswer("abc", "ev-1", "x", [], () => Promise.resolve(new Response(JSON.stringify({ error: "big.csv is over 10 MB." }), { status: 413 })));
    expect(tooBig).toEqual({ ok: false, error: "big.csv is over 10 MB." });
    const ok = await postAnswer("abc", "ev-1", "x", [], () => Promise.resolve(new Response("{}", { status: 200 })));
    expect(ok).toEqual({ ok: true });
  });

  it("#5 shows the error, not stale cards, when a complete save file fails the schema", async () => {
    mkdirSync(join(root, "gtm-workspace", "acme"), { recursive: true });
    const p = join(root, "gtm-workspace", "acme", "intake.json");
    writeFileSync(p, readFileSync("fixtures/demo/intake.json", "utf8"));
    expect(await readBusiness("acme")).toHaveProperty("brief");
    writeFileSync(p, JSON.stringify({ schemaVersion: 1, mode: "live" }));
    expect(await readBusiness("acme")).toHaveProperty("error");
  });

  it("#7 tolerates a half-written session.json", async () => {
    const id = createSession();
    writeFileSync(join(sdir(id), "session.json"), '{"id":"x","busi');
    await expect(readSession(id)).resolves.toMatchObject({ id, business: null });
  });
});
