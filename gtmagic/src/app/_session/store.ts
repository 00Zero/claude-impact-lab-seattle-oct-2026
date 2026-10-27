/* Session files under gtm-workspace/.sessions/<id>/: session.json, transcript.jsonl, uploads/.
   The app writes only answer events and uploads here (the gtm-web CLI writes everything else). */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { z } from "zod";
import { insideDir, isSafeName, workspaceDir } from "../_intake/workspace";
import { parseTranscript, type TranscriptEvent } from "./events";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set([".csv", ".xlsx", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
export const SessionMetaSchema = z.looseObject({ id: z.string(), createdAt: z.string().optional(), business: z.string().nullable().optional(), pid: z.number().optional() });
export type SessionMeta = z.infer<typeof SessionMetaSchema>;

export type SessionView = {
  id: string;
  business: string | null;
  events: TranscriptEvent[];
  openAsk: string | null;
  lastEventAt: string | null;
  transcriptUpdatedAt: string | null;
};

/** Create a session with the same files the `ui start` CLI writes. */
export function createSession(): string {
  const id = randomBytes(6).toString("hex");
  const dir = join(workspaceDir(), ".sessions", id);
  mkdirSync(join(dir, "uploads"), { recursive: true });
  writeFileSync(join(dir, "session.json"), JSON.stringify({ id, createdAt: new Date().toISOString(), business: null }) + "\n");
  writeFileSync(join(dir, "transcript.jsonl"), "");
  return id;
}

export function readMeta(id: string): SessionMeta | null {
  const dir = sessionDir(id);
  return dir ? metaAt(dir) : null;
}

// session.json is rewritten by `ui link`; a read can land mid-write, so tolerate it.
function metaAt(dir: string): SessionMeta | null {
  try {
    const r = SessionMetaSchema.safeParse(JSON.parse(readFileSync(join(dir, "session.json"), "utf8")));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function writeMeta(id: string, meta: SessionMeta): void {
  const dir = sessionDir(id);
  if (dir) writeFileSync(join(dir, "session.json"), JSON.stringify(meta) + "\n");
}

/** Append an event the app itself owns (only `done` today, when the owner stops a session). */
export function appendDone(id: string): void {
  const dir = sessionDir(id);
  if (!dir) return;
  const ev = { id: nextId(readEvents(dir)), at: new Date().toISOString(), kind: "done" };
  appendFileSync(join(dir, "transcript.jsonl"), JSON.stringify(ev) + "\n");
}

export function sessionDir(id: string): string | null {
  if (!isSafeName(id, "session")) return null;
  const d = insideDir(workspaceDir(), ".sessions", id);
  return d && existsSync(join(d, "session.json")) ? d : null;
}

function readEvents(dir: string): TranscriptEvent[] {
  const p = join(dir, "transcript.jsonl");
  return existsSync(p) ? parseTranscript(readFileSync(p, "utf8")) : [];
}

function openAskOf(events: TranscriptEvent[]): string | null {
  if (events.some((e) => e.kind === "done")) return null; // an ended session takes no more answers
  const closed = new Set(events.flatMap((e) => (e.kind === "answer" || e.kind === "cancel" ? [e.askId] : [])));
  const open = events.filter((e) => e.kind === "ask" && !closed.has(e.id));
  return open.at(-1)?.id ?? null;
}

export async function readSession(id: string): Promise<SessionView | null> {
  const dir = sessionDir(id);
  if (!dir) return null;
  const meta = metaAt(dir);
  const events = readEvents(dir);
  const linked = [...events].reverse().find((e) => e.kind === "link");
  const t = await stat(join(dir, "transcript.jsonl")).catch(() => null);
  return {
    id,
    business: (linked?.kind === "link" ? linked.business : null) ?? meta?.business ?? null,
    events,
    openAsk: openAskOf(events),
    lastEventAt: events.at(-1)?.at ?? meta?.createdAt ?? null,
    transcriptUpdatedAt: t ? t.mtime.toISOString() : null,
  };
}

export async function listSessions(): Promise<Array<{ id: string; business: string | null; lastEventAt: string | null; done: boolean }>> {
  const base = insideDir(workspaceDir(), ".sessions");
  if (!base) return [];
  const names = await readdir(base).catch(() => [] as string[]);
  const out = [];
  for (const id of names) {
    const s = await readSession(id);
    if (s) out.push({ id, business: s.business, lastEventAt: s.lastEventAt, done: s.events.some((e) => e.kind === "done") });
  }
  return out.sort((a, b) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
}

function nextId(events: TranscriptEvent[]): string {
  const n = events.reduce((m, e) => Math.max(m, parseInt(e.id.slice(3), 10) || 0), 0) + 1;
  return `ev-${n}-${randomBytes(2).toString("hex")}`;
}

export function askIsOpen(id: string, askId: string): boolean {
  const dir = sessionDir(id);
  return dir ? openAskOf(readEvents(dir)) === askId : false;
}

/** Append the owner's answer, if that question is still open. Synchronous, so two posts can't interleave. */
export function appendAnswer(id: string, askId: string, text: string, files: string[]): "ok" | "closed" | "unknown-ask" | "no-session" {
  const dir = sessionDir(id);
  if (!dir) return "no-session";
  const events = readEvents(dir);
  if (!events.some((e) => e.kind === "ask" && e.id === askId)) return "unknown-ask";
  if (openAskOf(events) !== askId) return "closed";
  const ev = { id: nextId(events), at: new Date().toISOString(), kind: "answer", askId, text, from: "page", ...(files.length ? { files } : {}) };
  appendFileSync(join(dir, "transcript.jsonl"), JSON.stringify(ev) + "\n");
  return "ok";
}

export function safeUploadName(name: string): string {
  const cleaned = basename(name.replaceAll("\\", "/")).toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/^\.+/, "");
  return cleaned || "upload";
}

export function checkUpload(file: File): "ok" | "too-large" | "bad-type" {
  if (file.size > MAX_UPLOAD_BYTES) return "too-large";
  return ALLOWED_EXT.has(extname(safeUploadName(file.name))) ? "ok" : "bad-type";
}

/** Save an upload (already checked) and return its path relative to the session folder. */
export async function saveUpload(id: string, file: File): Promise<string | null> {
  const dir = sessionDir(id);
  if (!dir) return null;
  const name = safeUploadName(file.name);
  const ext = extname(name);
  let candidate = name;
  for (let n = 1; existsSync(join(dir, "uploads", candidate)); n++) candidate = `${name.slice(0, -ext.length || undefined)}-${n}${ext}`;
  writeFileSync(join(dir, "uploads", candidate), Buffer.from(await file.arrayBuffer()));
  return `uploads/${candidate}`;
}
