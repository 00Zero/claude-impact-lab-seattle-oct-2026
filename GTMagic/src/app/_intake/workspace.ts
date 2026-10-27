/* Reads gtm-intake save files from disk: gtm-workspace/<business>/intake.json, plus the
   KeepStrong demo at fixtures/demo/intake.json. Server-side only. */
import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { cleanIntake } from "./integrity";
import { parseIntake, type IntakeBrief } from "./schema";

export const DEMO_SLUG = "demo";
const NAME_RE = { business: /^[a-z0-9][a-z0-9-]{0,63}$/, session: /^[a-z0-9-]{8,40}$/ } as const;

/** Where gtm-workspace/ lives. Tests point GTM_ROOT at a temp dir. */
export function workspaceRoot(): string {
  return process.env.GTM_ROOT ?? process.cwd();
}

export function workspaceDir(): string {
  return join(workspaceRoot(), "gtm-workspace");
}

const demoPath = () => join(process.cwd(), "fixtures", "demo", "intake.json");

export function isSafeName(name: string, kind: "business" | "session"): boolean {
  return NAME_RE[kind].test(name);
}

/** Resolve a path under base, or null if it would escape it. */
export function insideDir(base: string, ...parts: string[]): string | null {
  const p = resolve(base, ...parts);
  const rel = relative(resolve(base), p);
  return rel.startsWith("..") || isAbsolute(rel) ? null : p;
}

export function intakePath(slug: string): string | null {
  if (slug === DEMO_SLUG) return demoPath();
  if (!isSafeName(slug, "business")) return null;
  return insideDir(workspaceDir(), slug, "intake.json");
}

export type BusinessSummary = {
  slug: string;
  name: string;
  updatedAt: string;
  status: IntakeBrief["readiness"]["status"] | "unreadable";
  isDemo: boolean;
};

export type BusinessRead = { brief: IntakeBrief; warnings: string[]; rawPath: string; updatedAt: string } | { error: string; issues: string[] };

// Last good parse per file, so a read that lands mid-write shows the previous version.
const lastGood = new Map<string, Extract<BusinessRead, { brief: IntakeBrief }>>();

async function readAt(path: string): Promise<BusinessRead | null> {
  let raw: string;
  let mtime: Date;
  try {
    [raw, mtime] = await Promise.all([readFile(path, "utf8"), stat(path).then((s) => s.mtime)]);
  } catch {
    return null;
  }
  const parsed = parseIntake(raw);
  if (!parsed.ok) {
    // Half-written JSON is a read that landed mid-write: keep the last good version.
    // A complete file that fails the schema is a real problem: say so, never show stale cards.
    const good = parsed.reason === "json" ? lastGood.get(path) : undefined;
    return good ?? { error: "This save file can't be read.", issues: parsed.issues };
  }
  const { brief, warnings } = cleanIntake(parsed.brief);
  const good = { brief, warnings, rawPath: path, updatedAt: mtime.toISOString() };
  lastGood.set(path, good);
  return good;
}

export async function readBusiness(slug: string): Promise<BusinessRead | null> {
  const path = intakePath(slug);
  return path ? readAt(path) : null;
}

export async function listBusinesses(): Promise<BusinessSummary[]> {
  let names: string[] = [];
  try {
    const entries = await readdir(workspaceDir(), { withFileTypes: true });
    names = entries.filter((d) => d.isDirectory() && isSafeName(d.name, "business")).map((d) => d.name).sort();
  } catch {
    names = [];
  }
  const out: BusinessSummary[] = [];
  for (const slug of [DEMO_SLUG, ...names]) {
    const r = await readBusiness(slug);
    if (!r) continue;
    out.push("brief" in r
      ? { slug, name: r.brief.business.name, updatedAt: r.updatedAt, status: r.brief.readiness.status, isDemo: slug === DEMO_SLUG }
      : { slug, name: slug, updatedAt: "", status: "unreadable", isDemo: slug === DEMO_SLUG });
  }
  return out;
}
