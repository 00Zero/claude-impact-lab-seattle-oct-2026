"use client";

import { useState, useTransition } from "react";
import {
  fieldErrorClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/ui/form-styles";
import { estimateTotals, lineRange } from "@/lib/estimate-math";
import { formatRange, minorToInput, parseMoney } from "@/lib/money";
import { PRICE_UNITS, type PriceUnit } from "@/lib/price-book-rules";
import { approveEstimateAction, saveEstimateAction } from "../actions";

export type EditorLine = {
  key: string;
  id: string | null;
  priceBookItemId: string | null;
  description: string;
  quantityLow: string;
  quantityHigh: string;
  unit: PriceUnit;
  unitPriceLow: string;
  unitPriceHigh: string;
  aiReason: string | null;
  contractorEdited: boolean;
};

export type EditorPriceItem = {
  id: string;
  name: string;
  description: string | null;
  unit: PriceUnit;
  priceLowMinor: number | null;
  priceHighMinor: number | null;
};

const toNumber = (value: string) => (value.trim() === "" ? NaN : Number(value));

// Edits a draft estimate. Totals preview here with the same math the server
// uses; the server recalculates them on save.
export function EstimateEditor({
  requestId,
  estimateId,
  currency,
  initialLines,
  initialAssumptions,
  initialExclusions,
  priceBook,
  canApprove,
}: {
  requestId: string;
  estimateId: string;
  currency: string;
  initialLines: EditorLine[];
  initialAssumptions: string[];
  initialExclusions: string[];
  priceBook: EditorPriceItem[];
  canApprove: boolean;
}) {
  const [lines, setLines] = useState(initialLines);
  const [assumptions, setAssumptions] = useState(initialAssumptions.join("\n"));
  const [exclusions, setExclusions] = useState(initialExclusions.join("\n"));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [approving, startApproving] = useTransition();

  const parsed = lines.map((l) => ({
    quantityLow: toNumber(l.quantityLow),
    quantityHigh: toNumber(l.quantityHigh),
    unitPriceLowMinor: l.unitPriceLow.trim() ? parseMoney(l.unitPriceLow) : parseMoney(l.unitPriceHigh),
    unitPriceHighMinor: l.unitPriceHigh.trim() ? parseMoney(l.unitPriceHigh) : parseMoney(l.unitPriceLow),
  }));
  const total = estimateTotals(
    parsed.map((p) => ({
      ...p,
      quantityLow: Number.isFinite(p.quantityLow) ? p.quantityLow : 0,
      quantityHigh: Number.isFinite(p.quantityHigh) ? p.quantityHigh : 0,
    })),
  );

  function update(key: string, change: Partial<EditorLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)));
    setDirty(true);
  }

  function addLine(itemId: string) {
    const item = priceBook.find((i) => i.id === itemId);
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        id: null,
        priceBookItemId: item?.id ?? null,
        description: item ? item.description || item.name : "",
        quantityLow: "1",
        quantityHigh: "1",
        unit: item?.unit ?? "each",
        unitPriceLow: minorToInput(item?.priceLowMinor ?? null),
        unitPriceHigh: minorToInput(item?.priceHighMinor ?? null),
        aiReason: null,
        contractorEdited: true,
      },
    ]);
    setDirty(true);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await saveEstimateAction(requestId, estimateId, {
        lines: lines.map((l) => ({
          id: l.id,
          priceBookItemId: l.priceBookItemId,
          description: l.description,
          quantityLow: toNumber(l.quantityLow),
          quantityHigh: toNumber(l.quantityHigh),
          unit: l.unit,
          unitPriceLow: l.unitPriceLow,
          unitPriceHigh: l.unitPriceHigh,
        })),
        assumptions: assumptions.split("\n"),
        exclusions: exclusions.split("\n"),
      });
      if (result.error) setError(result.error);
      else setDirty(false);
    });
  }

  function approve() {
    setError(null);
    startApproving(async () => {
      const result = await approveEstimateAction(requestId, estimateId);
      if (result.error) setError(result.error);
    });
  }

  const cell = `${inputClassName} h-11 w-full min-w-0 px-2 text-[15px]`;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const range = lineRange({
            quantityLow: Number.isFinite(parsed[index].quantityLow) ? parsed[index].quantityLow : 0,
            quantityHigh: Number.isFinite(parsed[index].quantityHigh) ? parsed[index].quantityHigh : 0,
            unitPriceLowMinor: parsed[index].unitPriceLowMinor,
            unitPriceHighMinor: parsed[index].unitPriceHighMinor,
          });
          const label = (name: string) => `${name}-${line.key}`;
          return (
            <li key={line.key} className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <label htmlFor={label("description")} className="sr-only">
                  Line {index + 1} description
                </label>
                <input
                  id={label("description")}
                  value={line.description}
                  maxLength={300}
                  onChange={(e) => update(line.key, { description: e.target.value })}
                  className={`${cell} flex-1 font-bold`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setLines((prev) => prev.filter((l) => l.key !== line.key));
                    setDirty(true);
                  }}
                  className="min-h-11 shrink-0 px-2 text-sm font-bold text-muted underline"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Field id={label("qlow")} label="Qty from">
                  <input id={label("qlow")} inputMode="decimal" value={line.quantityLow} onChange={(e) => update(line.key, { quantityLow: e.target.value })} className={cell} />
                </Field>
                <Field id={label("qhigh")} label="Qty to">
                  <input id={label("qhigh")} inputMode="decimal" value={line.quantityHigh} onChange={(e) => update(line.key, { quantityHigh: e.target.value })} className={cell} />
                </Field>
                <Field id={label("unit")} label="Unit">
                  <select id={label("unit")} value={line.unit} onChange={(e) => update(line.key, { unit: e.target.value as PriceUnit })} className={cell}>
                    {PRICE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={label("plow")} label="Price from">
                  <input id={label("plow")} inputMode="decimal" value={line.unitPriceLow} onChange={(e) => update(line.key, { unitPriceLow: e.target.value })} className={cell} />
                </Field>
                <Field id={label("phigh")} label="Price to">
                  <input id={label("phigh")} inputMode="decimal" value={line.unitPriceHigh} onChange={(e) => update(line.key, { unitPriceHigh: e.target.value })} className={cell} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className={range ? "font-bold" : "font-bold text-danger"}>
                  {range ? formatRange(range.low, range.high, currency) : "Needs a price"}
                </span>
                <span className="text-muted">
                  {line.contractorEdited ? "Edited" : line.priceBookItemId ? "From your price book" : "Not in your price book"}
                </span>
              </div>
              {line.aiReason ? <p className="text-sm text-muted">AI: {line.aiReason}</p> : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`add-line-${estimateId}`} className="text-[13px] font-bold">
          Add a line
        </label>
        <select
          id={`add-line-${estimateId}`}
          value=""
          onChange={(e) => {
            if (e.target.value) addLine(e.target.value === "custom" ? "" : e.target.value);
          }}
          className={`${inputClassName} max-w-sm`}
        >
          <option value="">Choose…</option>
          {priceBook.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          <option value="custom">Custom line (price it yourself)</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`assumptions-${estimateId}`} label="Assumptions (one per line)">
          <textarea
            id={`assumptions-${estimateId}`}
            rows={3}
            value={assumptions}
            onChange={(e) => {
              setAssumptions(e.target.value);
              setDirty(true);
            }}
            className={`${inputClassName} h-auto py-2`}
          />
        </Field>
        <Field id={`exclusions-${estimateId}`} label="Not included (one per line)">
          <textarea
            id={`exclusions-${estimateId}`}
            rows={3}
            value={exclusions}
            onChange={(e) => {
              setExclusions(e.target.value);
              setDirty(true);
            }}
            className={`${inputClassName} h-auto py-2`}
          />
        </Field>
      </div>

      <div className="flex items-baseline justify-between gap-3 rounded-xl bg-chip px-4 py-3">
        <span className="text-sm font-bold">Estimated total</span>
        <span className="font-display text-xl font-bold">
          {formatRange(total.low, total.high, currency)}
          {total.unpriced ? <span className="ml-2 text-sm font-normal text-danger">+ {total.unpriced} unpriced</span> : null}
        </span>
      </div>

      {error ? (
        <p role="alert" className={fieldErrorClassName}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={saving || !dirty} className={secondaryButtonClassName}>
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        {canApprove ? (
          <button
            type="button"
            onClick={approve}
            disabled={approving || dirty || total.unpriced > 0 || lines.length === 0}
            className={primaryButtonClassName}
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        ) : null}
      </div>
      {canApprove && (dirty || total.unpriced > 0) ? (
        <p className="text-sm text-muted">
          {dirty ? "Save your changes before approving." : "Every line needs a price before you can approve."}
        </p>
      ) : null}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-bold text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
