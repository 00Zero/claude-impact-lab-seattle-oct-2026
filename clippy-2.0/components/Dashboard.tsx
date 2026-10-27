"use client";

import { bestCostPerOrder, orderTotals, storePlan } from "@/lib/compare";
import type { AnalysisResult } from "@/lib/types";
import { downloadCsv, money, safeHref, shortDate } from "./format";
import { ShareButton } from "./TopFindings";

// Savings summary and buying plan: totals, cost now vs. with Clippy, and which store to buy each item from.
export default function Dashboard({ result, onCompare }: { result: AnalysisResult; onCompare: () => void }) {
  const totals = orderTotals(result.items);
  const plan = storePlan(result.items);
  const maxSpend = Math.max(...plan.map((p) => p.costPerOrder), 0.01);
  const priced = result.items.filter((r) => r.best).length;
  const missing = result.items.filter((r) => r.best && r.currentUnitCost === null).length;
  const orders = `${result.ordersPerMonth} ${result.ordersPerMonth === 1 ? "order" : "orders"} per month`;

  return (
    <section data-testid="dashboard" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Savings Summary &amp; Buying Plan</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Prices checked {shortDate(result.generatedAt)} · based on {orders}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCompare}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            See item details
          </button>
          <ShareButton result={result} primary />
        </div>
      </div>

      {totals ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Savings per order" value={money(result.totalSavingsPerOrder)} note={totals.percent > 0 ? `${totals.percent}% less than you pay now` : "You already pay good prices"} />
          <Kpi label="Savings per month" value={money(result.totalSavingsPerMonth)} note={`At ${orders}`} />
          <Kpi label="Savings per year" value={money(result.totalSavingsPerYear)} note="If prices stay the same" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Cost per order at the best prices" value={money(bestCostPerOrder(result.items))} note="Shipping included where the store lists it" />
          <Kpi label="Items with a store price" value={`${priced} of ${result.items.length}`} note="Every price has a link and a date" />
          <div data-testid="no-savings-yet" className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300">
            <p className="text-xs font-medium text-amber-900">Savings</p>
            <p className="mt-1 text-sm text-amber-900">
              Clippy needs to know what you pay now to work out your savings. Your list didn&apos;t include prices.
            </p>
            <button type="button" onClick={onCompare} className="mt-2 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950">
              Add what you pay
            </button>
          </div>
        </div>
      )}

      {totals && missing > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {missing} {missing === 1 ? "item has" : "items have"} a store price but no price from you, so {missing === 1 ? "it isn't" : "they aren't"} counted in these savings.{" "}
          <button type="button" onClick={onCompare} className="font-semibold underline underline-offset-2">
            Add what you pay
          </button>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card title="Cost per order" subtitle="Items where you told Clippy what you pay now">
            {totals ? (
              <div className="space-y-3">
                <Bar label="What you pay now" value={money(totals.current)} width={100} tone="bg-slate-400" />
                <Bar
                  label="With Clippy's picks"
                  value={money(totals.withClippy)}
                  width={(totals.withClippy / totals.current) * 100}
                  tone="bg-emerald-600"
                  badge={totals.savings >= 0.01 ? `Save ${money(totals.savings)}` : undefined}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Add what you pay (from an invoice or your list) to see this comparison.</p>
            )}
          </Card>

          <Card title="Spend by store" subtitle="What one order costs at each store, shipping included">
            {plan.length === 0 ? (
              <p className="text-sm text-slate-500">No store prices found yet.</p>
            ) : (
              <div className="space-y-3">
                {plan.map((p) => (
                  <Bar key={p.store} label={p.store} value={money(p.costPerOrder)} width={(p.costPerOrder / maxSpend) * 100} tone="bg-emerald-600" />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="Best store for each item" subtitle="Cheapest landed price, per order">
          {plan.length === 0 ? (
            <p className="text-sm text-slate-500">No store prices found yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {plan.map((p) => (
                <li key={p.store} className="py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-slate-900">{p.store}</p>
                    <p className="font-semibold text-slate-900">{money(p.costPerOrder)}</p>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {p.items.map((r) => {
                      const href = safeHref(r.best?.url);
                      return (
                        <li key={r.item.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-slate-600">
                            {r.item.qtyPerOrder} × {r.item.name}
                          </span>
                          {href && (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-emerald-700 hover:underline">
                              Buy
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {p.savingsPerOrder >= 0.01 && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">Saves {money(p.savingsPerOrder)} per order</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next steps</p>
            <p className="mt-1 text-sm text-slate-600">
              Open each Buy link to order from that store. Clippy never buys for you, and prices can change, so check before you pay.
            </p>
            <button
              type="button"
              onClick={() => downloadCsv(result)}
              className="mt-3 w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Download buying list (CSV)
            </button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-800 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mb-4 text-xs text-slate-500">{subtitle}</p>
      {children}
    </div>
  );
}

function Bar({ label, value, width, tone, badge }: { label: string; value: string; width: number; tone: string; badge?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-slate-700">
          {label}
          {badge && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">{badge}</span>}
        </span>
        <span className="font-semibold tabular-nums text-slate-900">{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, Math.min(100, width))}%` }} />
      </div>
    </div>
  );
}
