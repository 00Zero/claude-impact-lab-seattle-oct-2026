import { useFormularies } from "../hooks/queries";
import {
  AVAILABLE_COVERAGE,
  COVERAGE_TYPE_LABELS,
  INSURER_LABELS,
  type CoverageType,
  type Insurer,
} from "../types";

export type PlanDraft = {
  insurer?: Insurer;
  coverageType?: CoverageType;
  formularyId?: string;
};

type Props = {
  value: PlanDraft;
  onChange: (next: PlanDraft) => void;
};

const INSURERS = Object.keys(INSURER_LABELS) as Insurer[];

export function PlanPicker({ value, onChange }: Props) {
  const { insurer, coverageType, formularyId } = value;
  const coverageOptions = insurer ? AVAILABLE_COVERAGE[insurer] : [];
  const { data: formularies = [], isLoading } = useFormularies(insurer, coverageType);

  function pickInsurer(next: Insurer) {
    const options = AVAILABLE_COVERAGE[next];
    // Auto-select when only one coverage type exists (e.g. Aetna → employer).
    onChange({ insurer: next, coverageType: options.length === 1 ? options[0] : undefined });
  }

  return (
    <div className="stack">
      <fieldset>
        <legend>Insurer</legend>
        <div className="chips">
          {INSURERS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${insurer === id ? "active" : ""}`}
              aria-pressed={insurer === id}
              onClick={() => pickInsurer(id)}
            >
              {INSURER_LABELS[id]}
            </button>
          ))}
        </div>
      </fieldset>

      {insurer && (
        <fieldset>
          <legend>Coverage type</legend>
          <div className="chips">
            {coverageOptions.map((ct) => (
              <button
                key={ct}
                type="button"
                className={`chip ${coverageType === ct ? "active" : ""}`}
                aria-pressed={coverageType === ct}
                onClick={() => onChange({ insurer, coverageType: ct })}
              >
                {COVERAGE_TYPE_LABELS[ct]}
              </button>
            ))}
          </div>
          {coverageOptions.length === 1 && (
            <p className="hint">{INSURER_LABELS[insurer]} only offers employer plans in 2026.</p>
          )}
        </fieldset>
      )}

      {insurer && coverageType && (
        <div>
          <label htmlFor="formulary">Formulary</label>
          <select
            id="formulary"
            value={formularyId ?? ""}
            disabled={isLoading}
            onChange={(e) => onChange({ ...value, formularyId: e.target.value || undefined })}
          >
            <option value="">{isLoading ? "Loading…" : "Select a formulary"}</option>
            {formularies.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.source})
              </option>
            ))}
          </select>
          {coverageType === "employer" && (
            <p className="hint">
              Employers can customize their formulary, so results show the standard version.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
