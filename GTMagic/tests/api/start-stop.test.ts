import { appendFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { agentState, launchAgent, stopAgent } from "@/app/_session/launcher";
import { appendAnswer, createSession, readSession } from "@/app/_session/store";

let root: string;
const meta = (id: string) => JSON.parse(readFileSync(join(root, "gtm-workspace", ".sessions", id, "session.json"), "utf8"));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gtm-launch-"));
  process.env.GTM_ROOT = root;
});

describe("one-click start", () => {
  it("creates a session folder like `ui start` does", () => {
    const id = createSession();
    const dir = join(root, "gtm-workspace", ".sessions", id);
    expect(existsSync(join(dir, "transcript.jsonl"))).toBe(true);
    expect(existsSync(join(dir, "uploads"))).toBe(true);
    expect(meta(id).business).toBeNull();
  });

  it("launches Claude Code for the session and records its process id", () => {
    const id = createSession();
    const calls: string[][] = [];
    const pid = launchAgent(id, (cmd, args) => { calls.push([cmd, ...args]); return { pid: 4242, unref: () => undefined }; });
    expect(pid).toBe(4242);
    expect(calls[0]?.[0]).toBe("claude");
    expect(calls[0]?.join(" ")).toContain(id);
    expect(meta(id).pid).toBe(4242);
  });

  it("reports a stopped agent when its process is gone and the session never finished", async () => {
    const id = createSession();
    launchAgent(id, () => ({ pid: 999999, unref: () => undefined }));
    expect(agentState(id)).toBe("stopped");
    const s = await readSession(id);
    expect(s?.events.some((e) => e.kind === "done")).toBe(false);
  });

  it("stopping records the end of the session", async () => {
    const id = createSession();
    launchAgent(id, () => ({ pid: 999999, unref: () => undefined }));
    expect(stopAgent(id)).toBe(true);
    const s = await readSession(id);
    expect(s?.events.at(-1)?.kind).toBe("done");
  });

  it("takes no answer to a question left open when the session was stopped", async () => {
    const id = createSession();
    const ask = { id: "ev-1-abcd", at: new Date().toISOString(), kind: "ask", questions: ["Price?"] };
    appendFileSync(join(root, "gtm-workspace", ".sessions", id, "transcript.jsonl"), JSON.stringify(ask) + "\n");
    expect((await readSession(id))?.openAsk).toBe(ask.id);
    stopAgent(id);
    expect((await readSession(id))?.openAsk).toBeNull();
    expect(appendAnswer(id, ask.id, "$9", [])).toBe("closed");
  });

  it("has no agent for sessions started from the terminal", () => {
    expect(agentState(createSession())).toBe("none");
  });
});
