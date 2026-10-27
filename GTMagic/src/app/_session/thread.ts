/* What the chat shows, derived from the transcript (pure, so the page and tests agree).
   Cards are pointers: the plate item names a card; its data always comes from intake.json. */
import { STEP_IDS, type AnswerFrom, type PlateId, type StepId, type TranscriptEvent } from "./events";

export type AskState = "open" | "answered" | "cancelled" | "answered-in-terminal";
export type StepState = "pending" | "running" | "done" | "failed";

export type ThreadItem =
  | { kind: "bot"; id: string; text: string }
  | { kind: "ask"; id: string; askId: string; questions: string[]; state: AskState }
  | { kind: "owner"; id: string; text: string; from: AnswerFrom; files: string[] }
  | { kind: "plate"; id: string; plate: PlateId; updated: boolean }
  | { kind: "notice"; id: string; tone: "error" | "info"; text: string };

export type ThreadView = {
  items: ThreadItem[];
  steps: Record<StepId, StepState>;
  openAsk: { askId: string; questions: string[]; chips: string[] } | null;
  mode: "live" | "scripted";
  business: string | null;
  finished: boolean;
};

export const DISCONNECT_AFTER_MS = 90_000;

export function buildThread(events: TranscriptEvent[], briefUpdatedAt: string | null): ThreadView {
  const items: ThreadItem[] = [];
  const asks = new Map<string, { item: Extract<ThreadItem, { kind: "ask" }>; chips: string[] }>();
  const steps = Object.fromEntries(STEP_IDS.map((s) => [s, "pending"])) as Record<StepId, StepState>;
  let mode: ThreadView["mode"] = "live";
  let business: string | null = null;
  let finished = false;

  for (const e of events) {
    switch (e.kind) {
      case "say":
        items.push({ kind: "bot", id: e.id, text: e.text });
        break;
      case "ask": {
        const item = { kind: "ask" as const, id: e.id, askId: e.id, questions: e.questions, state: "open" as AskState };
        asks.set(e.id, { item, chips: e.chips ?? [] });
        items.push(item);
        break;
      }
      case "answer": {
        const ask = asks.get(e.askId);
        if (ask && ask.item.state === "open") ask.item.state = e.from === "terminal" ? "answered-in-terminal" : "answered";
        if (e.from === "scripted") mode = "scripted";
        items.push({ kind: "owner", id: e.id, text: e.text, from: e.from, files: e.files ?? [] });
        break;
      }
      case "cancel": {
        const ask = asks.get(e.askId);
        if (ask && ask.item.state === "open") ask.item.state = "cancelled";
        break;
      }
      case "status": {
        const at = STEP_IDS.indexOf(e.step);
        STEP_IDS.forEach((s, i) => { if (i < at) steps[s] = "done"; });
        steps[e.step] = "running";
        break;
      }
      case "plate":
        items.push({ kind: "plate", id: e.id, plate: e.plate, updated: briefUpdatedAt !== null && briefUpdatedAt > e.at });
        break;
      case "link":
        business = e.business;
        break;
      case "error":
        items.push({ kind: "notice", id: e.id, tone: "error", text: e.message });
        break;
      case "done":
        finished = true;
        // Stop session ends a run mid-question; that question is no longer waiting on the owner.
        asks.forEach((a) => { if (a.item.state === "open") a.item.state = "cancelled"; });
        STEP_IDS.forEach((s) => { if (steps[s] === "running") steps[s] = "done"; });
        break;
    }
  }

  const open = [...asks.values()].filter((a) => a.item.state === "open").at(-1);
  return {
    items,
    steps,
    openAsk: open ? { askId: open.item.askId, questions: open.item.questions, chips: open.chips } : null,
    mode,
    business,
    finished,
  };
}

/** What the chat box says. Once nothing more is coming, it says so instead of "waiting". */
export function composerPlaceholder(t: Pick<ThreadView, "mode" | "finished">, canAnswer: boolean, agentGone: boolean): string {
  if (t.finished) return "This session has ended";
  if (agentGone) return "This session stopped";
  if (t.mode === "scripted") return "The demo owner answers on their own";
  return canAnswer ? "Your answer" : "Waiting for the next question";
}

/** True when Claude Code has gone quiet for a while and nobody is waiting on the owner. */
export function isDisconnected(lastEventAt: string | null, now: Date, openAsk: boolean): boolean {
  if (openAsk || !lastEventAt) return false;
  return now.getTime() - new Date(lastEventAt).getTime() > DISCONNECT_AFTER_MS;
}
