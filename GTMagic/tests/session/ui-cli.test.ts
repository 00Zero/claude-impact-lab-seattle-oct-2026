import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseTranscript, TranscriptEventSchema } from "@/app/_session/events";

const CLI = join(process.cwd(), ".claude/skills/gtm-web/scripts/ui.ts");
let root: string;
let stub: ChildProcess;
let port: number;

const run = (...args: string[]) =>
  spawnSync("node", [CLI, ...args], { env: { ...process.env, GTM_ROOT: root }, encoding: "utf8" });
const transcriptPath = (id: string) => join(root, "gtm-workspace", ".sessions", id, "transcript.jsonl");

// The stub "GTMagic server" runs in its own process: spawnSync blocks this one, so an
// in-process server could never answer the CLI's health check.
const STUB = `require("http").createServer((q,s)=>{s.setHeader("content-type","application/json");` +
  `s.end(q.url==="/api/health"?'{"app":"gtmagic"}':"{}")}).listen(0,"127.0.0.1",function(){console.log(this.address().port)})`;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "gtm-cli-"));
  stub = spawn("node", ["-e", STUB]);
  port = await new Promise<number>((r) => stub.stdout?.once("data", (d: Buffer) => r(Number(d.toString().trim()))));
});
afterEach(() => { stub.kill(); });

function startSession(): string {
  const r = run("start", "--port", String(port));
  expect(r.status).toBe(0);
  expect(r.stdout).toContain(`URL http://127.0.0.1:${port}/session/`);
  const id = /SESSION (\S+)/.exec(r.stdout)?.[1];
  if (!id) throw new Error(r.stdout + r.stderr);
  return id;
}

describe("ui CLI", () => {
  it("reuses a running GTMagic server and writes only valid events", () => {
    const id = startSession();
    expect(run("say", id, "Hello").status).toBe(0);
    expect(run("status", id, "research", "12 pieces").status).toBe(0);
    expect(run("plate", id, "economics").status).toBe(0);
    expect(run("link", id, "keepstrong").status).toBe(0);
    expect(run("done", id).status).toBe(0);
    const lines = readFileSync(transcriptPath(id), "utf8").trim().split("\n");
    expect(lines).toHaveLength(5);
    for (const l of lines) expect(TranscriptEventSchema.safeParse(JSON.parse(l)).success, l).toBe(true);
  });

  it("returns 'still waiting' when nobody answers in time", () => {
    const id = startSession();
    const r = run("ask", id, "--q", "What do you sell?", "--wait", "--timeout", "1");
    expect(r.status).toBe(3);
    expect(r.stdout).toMatch(/^ASK ev-\d+/m);
  });

  it("prints the owner's answer once the page writes it", async () => {
    const id = startSession();
    const child = spawn("node", [CLI, "ask", id, "--q", "Price?", "--wait", "--timeout", "10"], { env: { ...process.env, GTM_ROOT: root } });
    let out = "";
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    while (!/ASK (\S+)\n/.test(out)) await new Promise((r) => setTimeout(r, 50));
    const askId = /ASK (\S+)\n/.exec(out)?.[1];
    appendFileSync(transcriptPath(id), JSON.stringify({ id: "ev-99", at: new Date().toISOString(), kind: "answer", askId, text: "$14.99", from: "page" }) + "\n");
    const code = await new Promise<number | null>((r) => child.on("close", r));
    expect(code).toBe(0);
    expect(out).toContain('ANSWER {"text":"$14.99"');
  });

  it("closes an earlier open question when a new one is asked", () => {
    const id = startSession();
    run("ask", id, "--q", "First?");
    run("ask", id, "--q", "Second?");
    const events = parseTranscript(readFileSync(transcriptPath(id), "utf8"));
    expect(events.map((e) => e.kind)).toEqual(["ask", "cancel", "ask"]);
  });

  it("records terminal and scripted answers", () => {
    const id = startSession();
    const askId = /ASK (\S+)/.exec(run("ask", id, "--q", "Price?").stdout)?.[1] ?? "";
    expect(run("answer", id, askId, "--from", "scripted", "$14.99 a month").status).toBe(0);
    const last = parseTranscript(readFileSync(transcriptPath(id), "utf8")).at(-1);
    expect(last).toMatchObject({ kind: "answer", from: "scripted", askId });
  });

  it("rejects unsafe business names", () => {
    const id = startSession();
    expect(run("link", id, "../x").status).toBe(2);
  });
});
