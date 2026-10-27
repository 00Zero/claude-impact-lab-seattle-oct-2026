/* What a new customer can cost: business.unitEconomics, all script-computed; laid out, never recomputed. */
import { money, pct } from "@/app/_intake/format";
import type { Business } from "@/app/_intake/schema";
import { PlateFrame } from "./PlateFrame";

export function EconomicsPlate({ business: b, updated }: { business: Business; updated?: boolean }) {
  const ue = b.unitEconomics;
  if (!ue) return null;
  const cur = b.pricing?.currency ?? "USD";
  const m = (x: number | null) => (x == null ? "not worked out yet" : money(x, cur));
  const serve = b.costToServeShare;
  const win = b.acquisitionShare;
  const keep = ue.firstYearMarginShare;
  const parts = serve != null && win != null && keep != null && keep > 0
    ? ([["serve", serve, "Serving them"], ["win", win, "Winning them"], ["keep", keep, "You keep"]] as const)
    : null;
  return (
    <PlateFrame title="What a new customer can cost" updated={updated}
      meta={b.pricing ? `${money(b.pricing.amount, cur)} a ${b.pricing.period}, paid about ${b.pricing.purchasesPerYear} times in a customer's first year. Worked out by code from your numbers.` : "Worked out by code from your numbers."}>
      <div className="econ-head"><span className="econ-big">{m(ue.annualRevenuePerCustomer)}</span><span>from each customer in their first year</span></div>
      {parts ? (
        <>
          <div className="econ-bar" role="img" aria-label={parts.map(([, s, l]) => `${l} ${pct(s)}`).join(", ")}>
            {parts.map(([k, s]) => <span key={k} className={`seg-${k}`} style={{ flex: s }} />)}
          </div>
          <ul className="econ-key">{parts.map(([k, s, l]) => <li key={k}><i className={`seg-${k}`} />{l} {pct(s)}</li>)}</ul>
        </>
      ) : null}
      <dl className="facts-grid econ-facts">
        <dt>Break-even</dt><dd><b>{m(ue.breakEvenCac)}</b> The most a new customer can cost before year one loses money.</dd>
        <dt>Most you&apos;ll spend</dt><dd><b>{m(ue.maxCac)}</b>{win != null ? ` ${pct(win)} of first-year revenue, your choice.` : ""}</dd>
        <dt>You keep</dt><dd><b>{m(ue.firstYearMargin)}</b> per customer in year one.</dd>
        {ue.targetCpaSource === "owner" ? (<><dt>Your own target</dt><dd><b>{m(ue.targetCpaUsed)}</b> This is what your ads are judged against.</dd></>) : null}
      </dl>
      {keep != null && keep <= 0 ? <p className="draft-tag">At these shares, a new customer loses money in year one.</p> : null}
    </PlateFrame>
  );
}
