import { plural } from "@/app/_intake/format";
import { ENUMS, type IntakeBrief } from "@/app/_intake/schema";
import { PLAIN } from "@/app/_intake/labels";
import { Tag } from "../evidence/Tag";
import { PlateFrame } from "./PlateFrame";

const KIND_ORDER: readonly string[] = ENUMS.skepticKind;

export function EvidencePlate({ brief, updated }: { brief: IntakeBrief; updated?: boolean }) {
  const skeptic = [...brief.skeptic].sort((a, b) => KIND_ORDER.indexOf(a.kind ?? "other") - KIND_ORDER.indexOf(b.kind ?? "other"));
  return (
    <PlateFrame title="What the evidence says, and the case against" label="Findings and the case against" updated={updated}>
      <ul className="findings">
        {brief.findings.map((f) => (
          <li key={f.id}><Tag text={PLAIN.findingKind[f.kind]} variant={`k-${f.kind}`} /><span>{f.claim}</span>
            <span className="applies">{PLAIN.confidence[f.confidence]} · {plural(f.evidenceIds.length, "source")}</span></li>
        ))}
      </ul>
      <h4>Looking for reasons we&apos;re wrong</h4>
      <ul className="findings">
        {skeptic.map((s) => (
          <li key={s.claim}><Tag text={PLAIN.skepticResult[s.result]} variant={`s-${s.result}`} />
            <span><span className="q">{PLAIN.skepticKind[s.kind ?? "other"]}</span>{s.claim}</span>
            <span className="applies">Searched: {s.queries.join(" · ")}</span></li>
        ))}
      </ul>
    </PlateFrame>
  );
}
