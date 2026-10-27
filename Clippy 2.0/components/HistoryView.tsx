"use client";

import type { SavedRun } from "./history";
import { money, shortDate } from "./format";

// Past comparisons saved in this browser.
export default function HistoryView({
  runs,
  onOpen,
  onDelete,
  onNew,
}: {
  runs: SavedRun[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">History</h2>
        <p className="mt-0.5 text-sm text-slate-500">Your past comparisons. Saved in this browser only.</p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600">Your searches will show up here.</p>
          <button
            type="button"
            onClick={onNew}
            className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            Compare prices
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <button type="button" data-testid="history-item" onClick={() => onOpen(r.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500">
                  {shortDate(r.updatedAt)} · {r.result.items.length} {r.result.items.length === 1 ? "item" : "items"}
                </p>
              </button>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-emerald-800">{money(r.result.totalSavingsPerMonth)}</p>
                <p className="text-[11px] text-slate-500">per month</p>
              </div>
              <button
                type="button"
                aria-label={`Delete ${r.title}`}
                title="Delete"
                onClick={() => onDelete(r.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
