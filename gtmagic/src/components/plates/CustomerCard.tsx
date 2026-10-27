import type { SimCustomer } from "@/app/_intake/sim-placeholder";
import { GroupFigure } from "../evidence/GroupFigure";
import type { GroupClass } from "../evidence/groups";
import { Quote } from "../evidence/Quote";
import { SimulatedBlock } from "../evidence/SimulatedBlock";

const ATTR: Partial<Record<string, string>> = { role: "Who", currentSolution: "Uses now", priceSensitivity: "Price", urgency: "Urgency", skepticism: "Trust", buyingStage: "Stage" };

export function CustomerCard({ c, groupName, group, hideLinks, onClose }: { c: SimCustomer; groupName: string; group: GroupClass; hideLinks?: boolean; onClose: () => void }) {
  const picked = c.choice === "none" ? "None of these" : `Line ${c.choice}`;
  return (
    <article className="person" aria-label={`Customer ${c.id}`}>
      <div className="person-head">
        <h4><GroupFigure group={group} />{c.id} · {groupName}</h4>
        <button className="btn small secondary" type="button" onClick={onClose}>Close</button>
      </div>
      <div className="attrs">{c.attrs.map((a) => <span key={a.name}>{ATTR[a.name] ?? a.name}: {a.value}</span>)}</div>
      <p className="meta">Talks like these real customers:</p>
      {c.voice.map((v) => <Quote key={v.phrase} evidence={v.evidence} phrase={v.phrase} hideLinks={hideLinks} />)}
      <SimulatedBlock label="Simulated answer, not a real quote" text={`Picked ${picked}. ${c.reason}`} />
    </article>
  );
}
