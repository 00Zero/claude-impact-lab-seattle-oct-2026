"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { money, safeHref } from "./format";
import { findingLine, shareFindings, topFindings } from "./share";

const LABELS = { idle: "", shared: "Shared", copied: "Copied to clipboard", failed: "Could not share" };

export function ShareButton({ result, primary = false }: { result: AnalysisResult; primary?: boolean }) {
  const [state, setState] = useState<keyof typeof LABELS>("idle");
  const count = topFindings(result).length;

  async function share() {
    const outcome = await shareFindings(result);
    if (outcome === "cancelled") return;
    setState(outcome);
    setTimeout(() => setState("idle"), 2500);
  }

  if (count === 0) return null;
  return (
    <button
      type="button"
      data-testid="share-btn"
      onClick={share}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
        primary ? "bg-emerald-800 text-white hover:bg-emerald-900" : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M10 13V3M6 7l4-4 4 4M4 11v5h12v-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span aria-live="polite">{LABELS[state] || `Share top ${count}`}</span>
    </button>
  );
}

// The three findings worth acting on first, ready to share.
export default function TopFindings({ result }: { result: AnalysisResult }) {
  const top = topFindings(result);
  if (top.length === 0) return null;
  return (
    <div data-testid="top-findings" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Top {top.length} findings</h3>
          <p className="text-xs text-slate-500">Where you save the most, first. Share them with your team or supplier.</p>
        </div>
        <ShareButton result={result} primary />
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {top.map((r, i) => {
          const href = safeHref(r.best.url);
          const saves = r.savingsPerOrder !== null && r.savingsPerOrder >= 0.01;
          return (
            <li key={r.item.id} className="flex flex-col rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="min-w-0 font-medium leading-snug text-slate-900">{r.item.name}</p>
              </div>
              {saves && <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-800">{money(r.savingsPerOrder)}<span className="text-sm font-medium text-slate-500"> per order</span></p>}
              <p className="mt-2 flex-1 text-sm text-slate-600">{findingLine(r)}</p>
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm font-medium text-emerald-700 hover:underline">
                  Buy at {r.best.store} ↗
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
