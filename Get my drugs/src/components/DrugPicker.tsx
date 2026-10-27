import { useDrugsForDiagnosis } from "../hooks/queries";
import type { DrugSelection } from "../types";

export type DrugDraft = Partial<DrugSelection>;

type Props = {
  icd10?: string;
  value: DrugDraft;
  onChange: (next: DrugDraft) => void;
};

export function DrugPicker({ icd10, value, onChange }: Props) {
  const { data: drugs = [], isLoading } = useDrugsForDiagnosis(icd10);
  const selected = drugs.find((d) => d.rxcui === value.rxcui);

  if (!icd10) return <p className="hint">Choose a diagnosis first.</p>;
  if (isLoading) return <p className="hint">Loading drugs…</p>;
  if (drugs.length === 0) return <p className="hint">No drugs found for this diagnosis.</p>;

  return (
    <div className="stack">
      <fieldset>
        <legend>Drug</legend>
        <div className="drug-list">
          {drugs.map((d) => (
            <label key={d.rxcui} className={`drug ${value.rxcui === d.rxcui ? "active" : ""}`}>
              <input
                type="radio"
                name="drug"
                checked={value.rxcui === d.rxcui}
                onChange={() =>
                  onChange({ rxcui: d.rxcui, strength: d.strengths[0], quantity: value.quantity ?? 10 })
                }
              />
              <span>
                {d.name}
                <small>{d.form}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {selected && (
        <div className="row">
          <div>
            <label htmlFor="strength">Strength</label>
            <select
              id="strength"
              value={value.strength}
              onChange={(e) => onChange({ ...value, strength: e.target.value })}
            >
              {selected.strengths.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qty">Quantity</label>
            <input
              id="qty"
              type="number"
              min={1}
              max={360}
              value={value.quantity ?? 10}
              onChange={(e) => onChange({ ...value, quantity: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
