import { useState } from "react";
import { useDiagnosisSearch } from "../hooks/queries";
import type { Diagnosis } from "../types";

type Props = {
  value?: Diagnosis;
  onChange: (d?: Diagnosis) => void;
};

export function DiagnosisSearch({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const { data = [], isFetching } = useDiagnosisSearch(query);

  if (value) {
    return (
      <div className="selected">
        <span>
          <strong>{value.description}</strong> <code>{value.icd10}</code>
        </span>
        <button type="button" className="link" onClick={() => onChange(undefined)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="combo">
      <label htmlFor="dx">Diagnosis</label>
      <input
        id="dx"
        type="search"
        placeholder="Search by condition or ICD-10 code, e.g. migraine"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {isFetching && <p className="hint">Searching…</p>}
      {data.length > 0 && (
        <ul className="options" role="listbox">
          {data.map((d) => (
            <li key={d.icd10}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange(d);
                  setQuery("");
                }}
              >
                {d.description} <code>{d.icd10}</code>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !isFetching && data.length === 0 && (
        <p className="hint">No matching diagnoses.</p>
      )}
    </div>
  );
}
