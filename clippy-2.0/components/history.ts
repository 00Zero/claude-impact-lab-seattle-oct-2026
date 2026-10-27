import type { AnalysisResult } from "@/lib/types";

// Saved comparisons live in this browser only (localStorage). Photos are not saved, only their file names.

export interface SavedRun {
  id: string;
  title: string;
  updatedAt: string;
  result: AnalysisResult;
}

const KEY = "clippy-history-v2";
const MAX_RUNS = 50;
const NONE: SavedRun[] = [];

// A tiny store for useSyncExternalStore: cached list + change listeners.
let cache: SavedRun[] | null = null;
const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadRuns(): SavedRun[] {
  if (cache) return cache;
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(data) ? data : NONE;
  } catch {
    cache = NONE;
  }
  return cache;
}

export const serverRuns = () => NONE;

function write(chats: SavedRun[]) {
  cache = chats.slice(0, MAX_RUNS);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: history is a convenience, so carry on without it.
  }
  listeners.forEach((l) => l());
}

// Insert or update a chat and move it to the top.
export function saveRun(run: SavedRun) {
  write([run, ...loadRuns().filter((c) => c.id !== run.id)]);
}

export function deleteRun(id: string) {
  write(loadRuns().filter((c) => c.id !== id));
}

export function runTitle(list: string, fileName?: string): string {
  const text = list.replace(/\s+/g, " ").trim();
  if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  return fileName ? `Invoice: ${fileName}` : "Invoice photo";
}
