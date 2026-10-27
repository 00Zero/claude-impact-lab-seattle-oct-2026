import type { ReleasedEstimate } from "@/lib/estimates";
import { formatRange } from "@/lib/money";

// The customer's released estimate (spec C10). Built only from the released
// projection: no drafts, AI reasoning, or price-book data.
export function EstimateView({
  businessName,
  businessPhone,
  estimate,
}: {
  businessName: string;
  businessPhone: string | null;
  estimate: ReleasedEstimate;
}) {
  const released = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(estimate.releasedAt));
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 bg-page px-5 py-10 text-ink">
      <div>
        <p className="text-sm font-bold text-muted">{businessName}</p>
        <h1 className="mt-1 font-display text-[28px] font-bold leading-tight">Your estimate is ready</h1>
        <p className="mt-1 text-sm text-muted">
          Sent {released}
          {estimate.replacesEarlier ? " · This replaces an earlier estimate." : ""}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-line">
        <p className="text-sm font-bold uppercase tracking-wider text-muted">Estimated total</p>
        <p className="mt-1 font-display text-4xl font-bold">
          {formatRange(estimate.totalLowMinor, estimate.totalHighMinor, estimate.currency)}
        </p>
      </div>

      <p className="rounded-xl bg-caution-soft p-4 text-[15px] leading-6 text-caution">
        This is a preliminary estimate based on your photos and answers. The final price is confirmed after an on-site
        inspection.
      </p>

      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {estimate.lines.map((line, i) => (
          <li key={i} className="flex justify-between gap-3 px-4 py-3 text-[15px]">
            <span>{line.description}</span>
            <span className="shrink-0 font-bold">{formatRange(line.lowMinor, line.highMinor, estimate.currency)}</span>
          </li>
        ))}
      </ul>

      {estimate.assumptions.length ? <List title="Assumptions" items={estimate.assumptions} /> : null}
      {estimate.exclusions.length ? <List title="Not included" items={estimate.exclusions} /> : null}

      <p className="text-sm text-muted">
        Questions? Contact {businessName}
        {businessPhone ? (
          <>
            {" at "}
            <a href={`tel:${businessPhone}`} className="font-bold text-accent-strong underline">
              {businessPhone}
            </a>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-[15px]">
      <p className="font-bold">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
