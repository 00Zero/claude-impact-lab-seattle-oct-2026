import type { AnalysisResult, Unit } from "@/lib/types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdSmall = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const clean = (n: number) => (Object.is(n, -0) || Math.abs(n) < 0.00005 ? 0 : n);

// Whole-dollar-and-cents amounts. Returns "—" for anything that is not a real number.
export function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const v = clean(Math.round(n * 100) / 100);
  return usd.format(Object.is(v, -0) ? 0 : v);
}

// Per-unit prices are often fractions of a cent, so show up to 4 decimals.
export function unitMoney(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const v = clean(n);
  return Math.abs(v) >= 1 ? usd.format(v) : usdSmall.format(v);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown date";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}


const UNIT_NAMES: Record<Unit, string> = { lb: "lb", oz: "oz", kg: "kg", g: "g", each: "ct", gal: "gal", fl_oz: "fl oz", l: "L", ml: "mL" };

// "1000 ct", "50 lb"
export function packLabel(size: number, unit: Unit): string {
  return `${Number(size.toFixed(2))} ${UNIT_NAMES[unit]}`;
}

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// One row per item with the best store's landed price and link.
export function downloadCsv(result: AnalysisResult) {
  const head = ["Item", "Pack", "Qty per order", "Your cost per unit", "Best store", "Best cost per unit", "Shipping", "Savings per order", "Link", "Checked"];
  const rows = result.items.map((r) => [
    r.item.name,
    packLabel(r.item.packSize, r.item.unit),
    r.item.qtyPerOrder,
    r.currentUnitCost?.toFixed(4),
    r.best?.store,
    r.best?.unitCost.toFixed(4),
    r.best?.shipping?.toFixed(2),
    r.savingsPerOrder?.toFixed(2),
    r.best?.url,
    r.best?.checkedAt,
  ]);
  const csv = [head, ...rows].map((row) => row.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `clippy-savings-${result.generatedAt.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
