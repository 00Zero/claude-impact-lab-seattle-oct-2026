#!/usr/bin/env node
/* The gtm-web bridge: Claude Code runs this through Bash to drive the GTMagic page.
   Writes one JSON event per line to gtm-workspace/.sessions/<id>/transcript.jsonl.
   Self-contained (Node 22.18+ runs it directly; no imports from the app).
   Exit codes: 0 ok · 2 usage or error · 3 still waiting (re-run `ui wait`). */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { join, resolve } from "node:path";

type Ev = { id: string; at: string; kind: string; [field: string]: string | string[] | undefined };

const STEPS = ["describe", "guess", "answers", "research", "check", "save", "test", "results"];
const PLATES = ["baseline", "creatives", "economics", "ads", "constraints", "research", "evidence", "save", "crowd", "results"];
const FROM = ["terminal", "scripted"];
const SESSION_RE = /^[a-z0-9-]{8,40}$/;
const BUSINESS_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const REPO = resolve(import.meta.dirname, "..", "..", "..", "..");
const ROOT = process.env.GTM_ROOT ?? process.cwd();
const SESSIONS = join(ROOT, "gtm-workspace", ".sessions");
// Under Claude Code's default 2-minute Bash limit, so a wait ends with exit 3 rather than being killed.
const DEFAULT_WAIT_S = 100;

function fail(msg: string): never {
  process.stderr.write(`ui: ${msg}\n`);
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const flags: { q: string[]; chip: string[]; wait: boolean; timeout?: string; port?: string; from?: string } = { q: [], chip: [], wait: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--wait") flags.wait = true;
    else if (a === "--q" || a === "--chip") flags[a === "--q" ? "q" : "chip"].push(argv[++i] ?? fail(`${a} needs a value`));
    else if (a === "--timeout" || a === "--port" || a === "--from") flags[a.slice(2) as "timeout" | "port" | "from"] = argv[++i] ?? fail(`${a} needs a value`);
    else pos.push(a);
  }
  return { pos, flags };
}

function dir(id: string): string {
  if (!SESSION_RE.test(id)) fail(`bad session id "${id}"`);
  const d = join(SESSIONS, id);
  if (!existsSync(d)) fail(`no session ${id}; run \`ui start\` first`);
  return d;
}

function events(id: string): Ev[] {
  const p = join(dir(id), "transcript.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").flatMap((l) => {
    try { return l.trim() ? [JSON.parse(l) as Ev] : []; } catch { return []; }
  });
}

function append(id: string, ev: Record<string, string | string[] | undefined>): string {
  const n = events(id).reduce((m, e) => Math.max(m, parseInt(String(e.id).slice(3), 10) || 0), 0) + 1;
  // The random suffix keeps ids unique when several ui commands run at once.
  const full = { id: `ev-${n}-${randomBytes(2).toString("hex")}`, at: new Date().toISOString(), ...ev };
  appendFileSync(join(dir(id), "transcript.jsonl"), JSON.stringify(full) + "\n");
  return full.id;
}

function openAsks(id: string): string[] {
  const closed = new Set(events(id).filter((e) => e.kind === "answer" || e.kind === "cancel").map((e) => String(e.askId)));
  return events(id).filter((e) => e.kind === "ask" && !closed.has(e.id)).map((e) => e.id);
}

async function healthy(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
    const body = (await r.json()) as { app?: string };
    return body.app === "gtmagic";
  } catch {
    return false;
  }
}

function portTaken(port: number): Promise<boolean> {
  return new Promise((res) => {
    const s = connect({ port, host: "127.0.0.1" }, () => { s.destroy(); res(true); });
    s.on("error", () => res(false));
  });
}

async function serverUrl(want: number, logFile: string): Promise<number> {
  for (let port = want; port < want + 10; port++) {
    if (await healthy(port)) return port;
    if (await portTaken(port)) continue;
    const out = openSync(logFile, "a");
    spawn("npm", ["run", "dev", "--", "-p", String(port)], { cwd: REPO, detached: true, stdio: ["ignore", out, out] }).unref();
    for (let i = 0; i < 180; i++) {
      if (await healthy(port)) return port;
      await new Promise((r) => setTimeout(r, 500));
    }
    fail(`the GTMagic app didn't start on port ${port}; see ${logFile}`);
  }
  fail(`no free port between ${want} and ${want + 9}`);
}

async function waitFor(id: string, askId: string, timeoutS: number): Promise<never> {
  const until = Date.now() + timeoutS * 1000;
  while (Date.now() < until) {
    for (const e of events(id)) {
      if (e.kind === "answer" && e.askId === askId) {
        process.stdout.write(`ANSWER ${JSON.stringify({ text: e.text, from: e.from, files: e.files ?? [] })}\n`);
        process.exit(0);
      }
      if (e.kind === "cancel" && e.askId === askId) fail(`question ${askId} was cancelled`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  process.stdout.write(`WAITING ${askId}: no answer yet; run \`ui wait ${id} ${askId}\` again\n`);
  process.exit(3);
}

async function main() {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const [cmd, id = "", ...rest] = pos;
  const timeout = Number(flags.timeout ?? DEFAULT_WAIT_S) || DEFAULT_WAIT_S;
  switch (cmd) {
    case "start": {
      const sid = randomBytes(6).toString("hex");
      const d = join(SESSIONS, sid);
      mkdirSync(join(d, "uploads"), { recursive: true });
      writeFileSync(join(d, "session.json"), JSON.stringify({ id: sid, createdAt: new Date().toISOString(), business: null }) + "\n");
      writeFileSync(join(d, "transcript.jsonl"), "");
      const port = await serverUrl(Number(flags.port ?? 3000), join(d, "server.log"));
      process.stdout.write(`SESSION ${sid}\nURL http://127.0.0.1:${port}/session/${sid}\n`);
      return;
    }
    case "say": return void append(id, { kind: "say", text: rest.join(" ") || fail("say needs text") });
    case "status": {
      const [step = "", ...detail] = rest;
      if (!STEPS.includes(step)) fail(`step must be one of ${STEPS.join(", ")}`);
      return void append(id, { kind: "status", step, detail: detail.length ? detail.join(" ") : undefined });
    }
    case "plate": {
      if (!PLATES.includes(rest[0] ?? "")) fail(`plate must be one of ${PLATES.join(", ")}`);
      return void append(id, { kind: "plate", plate: rest[0] });
    }
    case "ask": {
      if (!flags.q.length) fail("ask needs at least one --q");
      for (const open of openAsks(id)) append(id, { kind: "cancel", askId: open });
      const askId = append(id, { kind: "ask", questions: flags.q, chips: flags.chip.length ? flags.chip : undefined });
      process.stdout.write(`ASK ${askId}\n`);
      if (flags.wait) await waitFor(id, askId, timeout);
      return;
    }
    case "wait": return void (await waitFor(id, rest[0] ?? fail("wait needs an ask id"), timeout));
    case "answer": {
      const [askId = "", ...text] = rest;
      if (!FROM.includes(flags.from ?? "")) fail(`--from must be one of ${FROM.join(", ")}`);
      if (!openAsks(id).includes(askId)) fail(`question ${askId} isn't open`);
      return void append(id, { kind: "answer", askId, text: text.join(" "), from: flags.from });
    }
    case "cancel": return void append(id, { kind: "cancel", askId: rest[0] ?? fail("cancel needs an ask id") });
    case "link": {
      const business = rest[0] ?? "";
      if (!BUSINESS_RE.test(business)) fail(`bad business folder name "${business}"`);
      const metaPath = join(dir(id), "session.json");
      const meta = JSON.parse(readFileSync(metaPath, "utf8")) as { business: string | null };
      writeFileSync(metaPath, JSON.stringify({ ...meta, business }) + "\n");
      return void append(id, { kind: "link", business });
    }
    case "done": return void append(id, { kind: "done" });
    case "error": return void append(id, { kind: "error", message: rest.join(" ") || "Something went wrong." });
    default:
      fail("usage: ui start|say|status|plate|ask|wait|answer|cancel|link|done|error <session> ...");
  }
}

await main();
