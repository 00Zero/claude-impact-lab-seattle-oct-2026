"use client";

import { useState } from "react";
import { orderTotals } from "@/lib/compare";
import type { AnalysisResult, ItemResult, RankedOffer } from "@/lib/types";
import { toBase, unitLabel } from "@/lib/units";
import { downloadCsv, money, packLabel, safeHref, shortDate, unitMoney } from "./format";
import TopFindings from "./TopFindings";

type Sort = "savings" | "name";

// Comparison screen: savings banner, filters, and every item with its best store and other quotes.
export default function Results({
  result,
  exampleLabel,
  onDashboard,
  onPricePaid,
}: {
  result: AnalysisResult;
  exampleLabel?: string;
  onDashboard: () => void;
  onPricePaid: (itemId: string, price: number | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("savings");
  const [hideNone, setHideNone] = useState(false);

  const month = result.totalSavingsPerMonth;
  const saves = Number.isFinite(month) && month >= 0.01;
  const knowsPrices = result.items.some((r) => r.currentUnitCost !== null && r.best);
  const totals = orderTotals(result.items);
  const priced = result.items.filter((r) => r.best).length;

  const q = query.trim().toLowerCase();
  const rows = result.items
    .filter((r) => !q || r.item.name.toLowerCase().includes(q) || r.best?.store.toLowerCase().includes(q))
    .filter((r) => !hideNone || (r.savingsPerOrder ?? 0) >= 0.01)
    .sort((a, b) => (sort === "name" ? a.item.name.localeCompare(b.item.name) : (b.savingsPerOrder ?? -1) - (a.savingsPerOrder ?? -1)));

  return (
    <section data-testid="results" className="space-y-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Price Comparison Results</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Checked {shortDate(result.generatedAt)} · {result.items.length} {result.items.length === 1 ? "item" : "items"} ·{" "}
            {priced} with store prices
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(result)}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M10 3v10M6 9l4 4 4-4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export CSV
        </button>
      </div>

      {exampleLabel && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{exampleLabel}</p>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M3 13l4-4 3 3 6-6M12 6h4v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          {saves ? (
            <>
              <p className="text-lg font-bold text-emerald-900 sm:text-xl">
                You could save {money(result.totalSavingsPerOrder)} on every order
                {totals && totals.percent > 0 ? ` (${totals.percent}% less)` : ""}
              </p>
              <p className="text-sm text-emerald-800">
                <span data-testid="total-month" className="font-semibold">
                  Save {money(month)} per month
                </span>{" "}
                · {money(result.totalSavingsPerYear)} per year · based on {result.ordersPerMonth}{" "}
                {result.ordersPerMonth === 1 ? "order" : "orders"} per month
              </p>
            </>
          ) : (
            <>
              <p data-testid="total-month" className="text-lg font-bold text-emerald-900 sm:text-xl">
                {knowsPrices ? "You already pay good prices" : "Here are the best prices Clippy found"}
              </p>
              {!knowsPrices && priced > 0 && (
                <p className="text-sm text-emerald-800">
                  To see your savings, tap <span className="font-semibold">+ Add what you pay</span> on each item below.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <TopFindings result={result} />

      {result.notice && (
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">{result.notice}</p>
      )}

      {result.suggestions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clippy&apos;s tips</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-slate-800">
            {result.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items or stores…"
          aria-label="Search results"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none sm:max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800"
          >
            <option value="savings">Highest savings</option>
            <option value="name">Item name</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={hideNone} onChange={(e) => setHideNone(e.target.checked)} className="accent-emerald-700" />
          Hide items with no savings
        </label>
        <span className="ml-auto text-xs text-slate-500">Prices include shipping when the store lists it.</span>
      </div>

      {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No items match.</p>}

      {/* Phones: cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <ItemCard key={r.item.id} r={r} onPricePaid={onPricePaid} />
        ))}
      </div>

      {/* Computers: table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Item &amp; spec</th>
              <th className="px-3 py-3">Qty / order</th>
              <th className="px-3 py-3">Your price</th>
              <th className="px-3 py-3">Best price</th>
              <th className="px-3 py-3">Shipping</th>
              <th className="px-3 py-3">Best store</th>
              <th className="px-3 py-3">Savings / order</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          {rows.map((r) => (
            <ItemTableRows key={r.item.id} r={r} onPricePaid={onPricePaid} />
          ))}
        </table>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Potential savings per order</p>
            <p className="text-lg font-bold text-emerald-800">{money(result.totalSavingsPerOrder)}</p>
          </div>
          <button
            type="button"
            onClick={onDashboard}
            className="flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            View savings dashboard
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
              <path d="M4 10h11M11 5.5L15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function per(r: ItemResult, offer?: RankedOffer | null) {
  const base = offer?.baseUnit ?? toBase(r.item.packSize, r.item.unit).baseUnit;
  return unitLabel(base, r.item.name);
}

type PriceHandler = (itemId: string, price: number | undefined) => void;

// "What you pay now": shown, and editable so savings can be worked out for a typed list without prices.
function PricePaid({ r, onPricePaid }: { r: ItemResult; onPricePaid: PriceHandler }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(r.item.pricePaid?.toString() ?? "");
  const price = Number(value);
  const valid = value.trim() === "" || (Number.isFinite(price) && price > 0 && price < 1_000_000);

  function save() {
    if (!valid) return;
    onPricePaid(r.item.id, value.trim() === "" ? undefined : Math.round(price * 100) / 100);
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="inline-flex flex-col items-end gap-1 text-left md:items-start"
      >
        <span className="flex items-center gap-1">
          <span className="text-slate-500">$</span>
          <input
            autoFocus
            data-testid="price-paid-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            aria-label={`What you pay for one ${packLabel(r.item.packSize, r.item.unit)} pack of ${r.item.name}`}
            className={`w-20 rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 ${valid ? "border-slate-300" : "border-rose-400"}`}
          />
          <button type="submit" disabled={!valid} className="rounded-md bg-emerald-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
            Save
          </button>
        </span>
        <span className="text-[11px] text-slate-500">per {packLabel(r.item.packSize, r.item.unit)} pack</span>
      </form>
    );
  }

  if (r.currentUnitCost !== null) {
    return (
      <span className="whitespace-nowrap">
        {current(r)}{" "}
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-emerald-700 hover:underline">
          Edit
        </button>
      </span>
    );
  }
  if (!r.best) return <span>Not given</span>;
  return (
    <button
      type="button"
      data-testid="add-price-btn"
      onClick={() => setEditing(true)}
      className="whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
    >
      + Add what you pay
    </button>
  );
}

function current(r: ItemResult) {
  return r.currentUnitCost !== null ? `${unitMoney(r.currentUnitCost)} ${per(r)}` : "Not given";
}

function shipping(o: RankedOffer) {
  if (o.shipping === null) return "Not listed";
  return o.shipping === 0 ? "Free" : money(o.shipping);
}

function savings(r: ItemResult) {
  if (r.savingsPerOrder === null) return "—";
  return r.savingsPerOrder >= 0.01 ? money(r.savingsPerOrder) : "None, your price is good";
}

function BuyLink({ offer, small = false }: { offer: RankedOffer; small?: boolean }) {
  const href = safeHref(offer.url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${offer.title} at ${offer.store}`}
      className={
        small
          ? "font-medium text-emerald-700 hover:underline"
          : "inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-900"
      }
    >
      Buy
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M8 4h8v8M16 4l-9 9M13 16H4V7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function Toggle({ r, open, onToggle }: { r: ItemResult; open: boolean; onToggle: () => void }) {
  const others = r.offers.filter((o) => o !== r.best && o.url !== r.best?.url);
  if (others.length === 0) return null;
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="mt-1 text-xs font-medium text-emerald-700 hover:underline">
      {open ? "Hide other offers" : `See other offers (${others.length})`}
    </button>
  );
}

// Every store quote side by side, cheapest first, with what the owner pays now at the end.
function Quotes({ r }: { r: ItemResult }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-slate-600">All store quotes for {r.item.name}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {r.offers.map((o, i) => (
          <div key={i} className={`rounded-xl bg-white p-3 text-xs ring-1 ${i === 0 ? "ring-2 ring-emerald-600" : "ring-slate-200"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">{o.store}</span>
              {i === 0 && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold text-white">Cheapest</span>}
            </div>
            <p className="mt-0.5 truncate text-slate-500">{o.title}</p>
            <dl className="mt-2 grid grid-cols-2 gap-y-0.5 text-slate-600">
              <dt>Price</dt>
              <dd className="text-right">
                {money(o.price)} / {packLabel(o.packSize, o.unit)}
              </dd>
              <dt>Shipping</dt>
              <dd className="text-right">{shipping(o)}</dd>
              <dt className="font-semibold text-slate-800">Landed</dt>
              <dd className="text-right font-semibold text-slate-800">
                {unitMoney(o.unitCost)} {per(r, o)}
              </dd>
            </dl>
            <p className="mt-2 flex justify-between text-slate-500">
              <BuyLink offer={o} small />
              <span>checked {shortDate(o.checkedAt)}</span>
            </p>
          </div>
        ))}
        {r.currentUnitCost !== null && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-700">Your current price</p>
            <p className="mt-2 font-semibold text-slate-800">{current(r)}</p>
            <p className="mt-1 text-slate-500">From your invoice or list</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ r, onPricePaid }: { r: ItemResult; onPricePaid: PriceHandler }) {
  const [open, setOpen] = useState(false);
  return (
    <article data-testid="item-row" className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{r.item.name}</h3>
      <p className="text-xs text-slate-500">
        {packLabel(r.item.packSize, r.item.unit)} · {r.item.qtyPerOrder} per order
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">You pay now</dt>
        <dd className="text-right text-slate-800">
          <PricePaid r={r} onPricePaid={onPricePaid} />
        </dd>
        {r.best && (
          <>
            <dt className="text-slate-500">Best store</dt>
            <dd className="text-right font-medium text-slate-800">{r.best.store}</dd>
            <dt className="text-slate-500">Best price</dt>
            <dd className="text-right font-semibold text-emerald-800">
              {unitMoney(r.best.unitCost)} {per(r, r.best)}
            </dd>
            <dt className="text-slate-500">Shipping</dt>
            <dd className="text-right text-slate-800">{shipping(r.best)}</dd>
            {r.savingsPerOrder !== null && (
              <>
                <dt className="text-slate-500">Savings per order</dt>
                <dd className="text-right font-semibold text-emerald-700">{savings(r)}</dd>
              </>
            )}
          </>
        )}
      </dl>
      {r.best ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <BuyLink offer={r.best} />
          <span className="text-xs text-slate-500">checked {shortDate(r.best.checkedAt)}</span>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No reliable price found.</p>
      )}
      <Toggle r={r} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <Quotes r={r} />
        </div>
      )}
    </article>
  );
}

function ItemTableRows({ r, onPricePaid }: { r: ItemResult; onPricePaid: PriceHandler }) {
  const [open, setOpen] = useState(false);
  const good = (r.savingsPerOrder ?? 0) >= 0.01;
  return (
    <tbody data-testid="item-row" className="border-t border-slate-100">
      <tr className="align-top">
        <td className="px-3 py-3.5">
          <p className="font-medium text-slate-900">{r.item.name}</p>
          <p className="text-xs text-slate-500">{packLabel(r.item.packSize, r.item.unit)}</p>
          <Toggle r={r} open={open} onToggle={() => setOpen(!open)} />
        </td>
        <td className="whitespace-nowrap px-3 py-3.5 text-slate-700">{r.item.qtyPerOrder}</td>
        <td className="px-3 py-3.5 text-slate-700">
          <PricePaid r={r} onPricePaid={onPricePaid} />
        </td>
        {r.best ? (
          <>
            <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-emerald-800">
              {unitMoney(r.best.unitCost)} {per(r, r.best)}
            </td>
            <td className="whitespace-nowrap px-3 py-3.5 text-slate-600">{shipping(r.best)}</td>
            <td className="px-3 py-3.5">
              <p className="font-medium text-slate-800">{r.best.store}</p>
              <p className="text-xs text-emerald-700">Cheapest store</p>
            </td>
            <td className="px-3 py-3.5">
              <span
                className={`inline-block rounded-lg px-2 py-1 text-sm font-semibold ${
                  good ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "text-slate-500"
                }`}
              >
                {savings(r)}
              </span>
            </td>
            <td className="px-3 py-3.5 text-right">
              <BuyLink offer={r.best} />
              <p className="mt-1 whitespace-nowrap text-xs text-slate-500">checked {shortDate(r.best.checkedAt)}</p>
            </td>
          </>
        ) : (
          <td colSpan={5} className="px-3 py-3.5 text-slate-500">
            No reliable price found.
          </td>
        )}
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-3 py-3">
            <Quotes r={r} />
          </td>
        </tr>
      )}
    </tbody>
  );
}
