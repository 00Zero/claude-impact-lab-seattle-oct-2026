"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisResult, ProgressEvent } from "@/lib/types";
import Composer, { type InputValues } from "./Composer";
import Dashboard from "./Dashboard";
import HelperIcon from "./HelperIcon";
import HistoryView from "./HistoryView";
import Progress from "./Progress";
import Results from "./Results";
import { withPricePaid } from "@/lib/compare";
import { shortDate } from "./format";
import { deleteRun, loadRuns, runTitle, saveRun, serverRuns, subscribe } from "./history";
import { supabaseBrowser } from "@/lib/supabase/client";

type Tab = "upload" | "compare" | "dashboard" | "history";

type Run =
  | { kind: "idle" }
  | { kind: "running"; steps: string[]; input: InputValues }
  | { kind: "error"; message: string; input: InputValues }
  | { kind: "done"; result: AnalysisResult; exampleLabel?: string; saved?: { id: string; title: string } };

const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "compare", label: "Comparison" },
  { id: "dashboard", label: "Savings Dashboard" },
  { id: "history", label: "History" },
];

const FALLBACK_ERROR = "Clippy could not finish. Please check your connection and try again.";
const DISCLAIMER = "Prices come from public store pages and can change. Check before you buy. Clippy never buys for you.";

const STEPS = [
  { title: "1. Upload", text: "Send a photo of your supply invoice, or type what you buy with pack sizes and quantities." },
  { title: "2. Compare", text: "Clippy searches real store pages for the same items and works out the cost per unit, shipping included." },
  { title: "3. Save", text: "See the cheapest store for each item and what you save per order, month and year, with a link to buy." },
];

export default function Clippy({ example, email }: { example: AnalysisResult | null; email: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upload");
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const runs = useSyncExternalStore(subscribe, loadRuns, serverRuns);
  const busy = run.kind === "running";

  function go(t: Tab) {
    setTab(t);
    window.scrollTo({ top: 0 });
  }

  async function analyze(v: InputValues) {
    setRun({ kind: "running", steps: [], input: v });
    go("compare");
    const fail = (message: string) => setRun({ kind: "error", message, input: v });
    const form = new FormData();
    if (v.file) form.append("invoice", v.file);
    if (v.list) form.append("list", v.list);
    form.append("ordersPerMonth", String(v.ordersPerMonth));
    if (v.location) form.append("location", v.location);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        return fail(body?.error || FALLBACK_ERROR);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const handle = (line: string) => {
        if (!line.trim()) return;
        let ev: ProgressEvent;
        try {
          ev = JSON.parse(line);
        } catch {
          return;
        }
        if (ev.type === "progress") {
          setRun((r) => (r.kind === "running" ? { ...r, steps: [...r.steps, ev.message] } : r));
        } else if (ev.type === "result") {
          finished = true;
          const saved = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: runTitle(v.list, v.file?.name) };
          setRun({ kind: "done", result: ev.data, saved });
          saveRun({ ...saved, updatedAt: new Date().toISOString(), result: ev.data });
        } else if (ev.type === "error") {
          finished = true;
          fail(ev.message || FALLBACK_ERROR);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer + decoder.decode());
      if (!finished) fail(FALLBACK_ERROR);
    } catch {
      fail(FALLBACK_ERROR);
    }
  }

  function showExample() {
    if (!example) return;
    setRun({
      kind: "done",
      result: example,
      exampleLabel: `Saved real result from ${shortDate(example.generatedAt)}. Prices may have changed.`,
    });
    go("compare");
  }

  function openRun(id: string) {
    const saved = runs.find((r) => r.id === id);
    if (!saved) return;
    setRun({ kind: "done", result: saved.result, saved: { id: saved.id, title: saved.title } });
    go("compare");
  }

  // A price typed on the Comparison page: redo the savings, and keep the saved copy in History up to date.
  function setPricePaid(itemId: string, price: number | undefined) {
    if (run.kind !== "done") return;
    const result = withPricePaid(run.result, itemId, price);
    setRun({ ...run, result });
    if (run.saved) saveRun({ ...run.saved, updatedAt: new Date().toISOString(), result });
  }

  async function logOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const noResult = (
    <Empty
      text={busy ? "Clippy is still working on your comparison." : "No comparison yet. Upload an invoice or type your list to get started."}
      action={busy ? "See progress" : "Compare prices"}
      onAction={() => go(busy ? "compare" : "upload")}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <button type="button" onClick={() => go("upload")} className="flex shrink-0 items-center gap-2">
            <HelperIcon className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-emerald-900">Clippy</span>
          </button>
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {TABS.map((t) => (
              <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => go(t.id)} />
            ))}
          </nav>
          <button
            type="button"
            data-testid="restart-btn"
            onClick={() => go("upload")}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            Compare prices
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
              <path d="M4 10h11M11 5.5L15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {email && (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-40 truncate text-sm text-slate-500 lg:inline" title={email}>
                {email}
              </span>
              <button
                type="button"
                data-testid="logout-btn"
                onClick={logOut}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                Log out
              </button>
            </div>
          )}
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {TABS.map((t) => (
            <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => go(t.id)} />
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {/* Kept mounted so a typed list survives switching tabs. */}
        <div hidden={tab !== "upload"}>
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <p className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                Supply price comparison for small businesses
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Find cheaper supplies in seconds.</h1>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Drop your latest supply invoice or type your order list. Clippy checks real stores and shows where you overpay.
              </p>
            </div>
            <div className="mt-6">
              <Composer busy={busy} onSend={analyze} />
            </div>
            {example && (
              <p className="mt-4 text-center">
                <button
                  type="button"
                  data-testid="example-btn"
                  onClick={showExample}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  See a real example
                </button>
              </p>
            )}
          </div>

          <div className="mt-12">
            <h2 className="text-center text-lg font-semibold text-slate-900">How Clippy works</h2>
            <p className="text-center text-sm text-slate-500">Real store prices, every one with a link and a date.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="font-semibold text-slate-900">{s.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {tab === "compare" &&
          (run.kind === "running" ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Step 2 of 3</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {run.input.file ? "Analyzing your invoice" : "Analyzing your list"}
                </h2>
              </div>
              <Progress steps={run.steps} source={run.input.file?.name ?? run.input.list} isPhoto={run.input.file !== null} />
            </div>
          ) : run.kind === "error" ? (
            <div data-testid="error" role="alert" className="mx-auto max-w-xl rounded-2xl bg-rose-50 p-5 ring-1 ring-rose-200">
              <p className="font-semibold text-slate-900">Sorry, that did not work</p>
              <p className="mt-1 text-slate-700">{run.message}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => analyze(run.input)}
                  className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => go("upload")}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  Change my input
                </button>
              </div>
            </div>
          ) : run.kind === "done" ? (
            <Results
              result={run.result}
              exampleLabel={run.exampleLabel}
              onDashboard={() => go("dashboard")}
              onPricePaid={setPricePaid}
            />
          ) : (
            noResult
          ))}

        {tab === "dashboard" &&
          (run.kind === "done" ? <Dashboard result={run.result} onCompare={() => go("compare")} /> : noResult)}

        {tab === "history" && <HistoryView runs={runs} onOpen={openRun} onDelete={deleteRun} onNew={() => go("upload")} />}
      </main>

      <footer className={`border-t border-slate-200 bg-white px-4 py-4 ${tab === "compare" && run.kind === "done" ? "pb-24" : ""}`}>
        <p className="mx-auto max-w-6xl text-center text-xs text-slate-500">{DISCLAIMER}</p>
      </footer>
    </div>
  );
}

function TabButton({ tab, active, onClick }: { tab: { id: Tab; label: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
        active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {tab.label}
    </button>
  );
}

function Empty({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-slate-600">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
      >
        {action}
      </button>
    </div>
  );
}
