/* One-click start: run Claude Code headless for a session, with a fixed list of pre-approved
   actions (permission mode dontAsk refuses everything else without prompting). Server-side only. */
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { join } from "node:path";
import { appendDone, readMeta, readSession, sessionDir, writeMeta } from "./store";

export const ALLOWED_TOOLS = [
  "Bash(node .claude/skills/gtm-web/scripts/ui.ts *)",
  "Bash(python3 .claude/skills/gtm-intake/scripts/*)",
  "Bash(cp gtm-workspace/*)",
  "Bash(mkdir -p gtm-workspace/*)",
  "Read", "Glob", "Grep",
  "Edit(gtm-workspace/**)", // Edit rules cover every file-writing tool; Write(path) rules are ignored
  "WebSearch", "WebFetch", "Skill",
];

export function claudeArgs(id: string): string[] {
  const prompt = [
    `Use the gtm-web skill to run the gtm-intake interview for the owner in the GTMagic web page.`,
    `The web session already exists: its id is ${id}. Don't run \`ui start\`; post everything to session ${id}.`,
    `The owner is in the browser and answers only there. Start by asking them to describe their business in one line.`,
  ].join(" ");
  return ["-p", prompt, "--permission-mode", "dontAsk", "--allowedTools", ALLOWED_TOOLS.join(",")];
}

type Spawned = { pid?: number; unref: () => void };
type SpawnFn = (cmd: string, args: string[], opts: { cwd: string; detached: boolean; stdio: ["ignore", number, number] }) => Spawned;

export function launchAgent(id: string, spawnFn: SpawnFn = spawn): number | null {
  const dir = sessionDir(id);
  const meta = readMeta(id);
  if (!dir || !meta) return null;
  const log = openSync(join(dir, "agent.log"), "a");
  const child = spawnFn("claude", claudeArgs(id), { cwd: process.cwd(), detached: true, stdio: ["ignore", log, log] });
  child.unref();
  if (!child.pid) return null;
  writeMeta(id, { ...meta, pid: child.pid });
  return child.pid;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** "none" for sessions started from the terminal; "stopped" when the process is gone. */
export function agentState(id: string): "running" | "stopped" | "none" {
  const pid = readMeta(id)?.pid;
  if (pid === undefined) return "none";
  return alive(pid) ? "running" : "stopped";
}

export function stopAgent(id: string): boolean {
  const meta = readMeta(id);
  if (!meta) return false;
  if (meta.pid !== undefined && alive(meta.pid)) {
    try { process.kill(-meta.pid, "SIGTERM"); } catch { try { process.kill(meta.pid, "SIGTERM"); } catch { /* already gone */ } }
  }
  appendDone(id);
  return true;
}

export async function isFinished(id: string): Promise<boolean> {
  return (await readSession(id))?.events.some((e) => e.kind === "done") ?? false;
}
