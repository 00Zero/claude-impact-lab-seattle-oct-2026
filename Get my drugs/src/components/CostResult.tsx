import type { Coverage, EstimateResponse, PharmacyPrice, PriceEstimate } from "../types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function CoverageBadge({ coverage }: { coverage: Coverage }) {
  if (!coverage.covered) return <span className="badge bad">Not covered</span>;
  if (coverage.priorAuth) return <span className="badge warn">Covered · prior auth required</span>;
  return <span className="badge good">Covered</span>;
}

function CoverageDetails({ coverage }: { coverage: Coverage }) {
  const rows: [string, string][] = [];
  if (coverage.tier) rows.push(["Tier", String(coverage.tier)]);
  rows.push(["Prior authorization", coverage.priorAuth ? "Required" : "Not required"]);
  rows.push(["Step therapy", coverage.stepTherapy ? coverage.stepTherapyNote ?? "Required" : "No"]);
  if (coverage.quantityLimit) rows.push(["Quantity limit", coverage.quantityLimit]);

  return (
    <dl className="details">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PriceBreakdown({ prices }: { prices: PriceEstimate[] }) {
  const lowest = Math.min(...prices.map((p) => p.amount));
  return (
    <ul className="prices">
      {prices.map((p) => (
        <li key={p.kind} className={p.amount === lowest ? "lowest" : ""}>
          <span>
            {p.label}
            <small>
              {p.source} · as of {p.asOf}
            </small>
          </span>
          <strong>{usd.format(p.amount)}</strong>
        </li>
      ))}
    </ul>
  );
}

function PharmacyPrices({ prices }: { prices: PharmacyPrice[] }) {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a.amount - b.amount);
  return (
    <div>
      <h3 className="subhead">Prices at nearby pharmacies</h3>
      <ul className="prices">
        {sorted.map((p, i) => (
          <li key={p.pharmacy} className={i === 0 ? "lowest" : ""}>
            <span>
              {p.pharmacy}
              <small>{p.distanceMiles.toFixed(1)} mi away{i === 0 ? " · lowest price" : ""}</small>
            </span>
            <strong>{usd.format(p.amount)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CostResult({ result }: { result: EstimateResponse }) {
  return (
    <section className="card result" aria-live="polite">
      <header>
        <div>
          <h2>{result.drug.name}</h2>
          <p className="hint">
            {result.strength} {result.drug.form} × {result.quantity}
          </p>
        </div>
        <CoverageBadge coverage={result.coverage} />
      </header>
      <CoverageDetails coverage={result.coverage} />
      <PriceBreakdown prices={result.prices} />
      <PharmacyPrices prices={result.pharmacyPrices} />
      <p className="disclaimer">
        Estimates only. Your actual cost depends on your specific plan, deductible, and pharmacy.
        Check your insurer's price tool before filling a prescription. Coupon prices can't be
        combined with insurance.
      </p>
    </section>
  );
}
