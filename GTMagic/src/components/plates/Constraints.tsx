import { PLAIN } from "@/app/_intake/labels";
import type { IntakeBrief } from "@/app/_intake/schema";
import { PlateFrame } from "./PlateFrame";

type Constraint = IntakeBrief["constraints"][number];
const ORDER = ["locked", "preference", "hypothesis", "unknown"] as const;

function ruleText(c: Constraint): string {
  const r = c.rule;
  if (r.op === "range") return `${r.min ?? "any"}–${r.max ?? "any"}`;
  if (!r.values?.length) return "Not decided";
  return r.op === "exclude" ? r.values.map((v) => `No ${v}`).join(" · ") : r.values.join(", ");
}

export function ConstraintsPlate({ constraints, updated }: { constraints: Constraint[]; updated?: boolean }) {
  return (
    <PlateFrame title="What you told me, sorted" updated={updated}>
      <div className="buckets">
        {ORDER.filter((b) => constraints.some((c) => c.bucket === b)).map((b) => (
          <div key={b} className="bucket">
            <h4>{PLAIN.bucket[b]}</h4>
            <ul>
              {constraints.filter((c) => c.bucket === b).map((c) => (
                <li key={`${c.dimension}-${ruleText(c)}`}>
                  <span className="dim">{PLAIN.dimension[c.dimension]}</span>
                  <span>{ruleText(c)}</span>
                  <span className="applies">{PLAIN.appliesTo[c.appliesTo]}</span>
                  {c.pushback ? <span className="applies">{c.pushback.ownerKept ? "Questioned once by research; you kept it" : "Changed after research"}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PlateFrame>
  );
}
