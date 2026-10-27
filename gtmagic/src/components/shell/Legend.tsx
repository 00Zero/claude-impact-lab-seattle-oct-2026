import type { Segment } from "@/app/_intake/schema";
import { GroupFigure } from "../evidence/GroupFigure";
import { groupClasses } from "../evidence/groups";

export function Legend({ segments }: { segments: Segment[] }) {
  const g = groupClasses(segments);
  return (
    <section className="rail-block" aria-labelledby="groups-h">
      <h2 id="groups-h" className="rail-h">Customer groups</h2>
      <ul className="legend">
        {segments.length === 0 ? <li className="legend-empty">Groups appear here once research finishes.</li> : segments.map((s) => (
          <li key={s.id}>
            <GroupFigure group={g.get(s.id) ?? "gn"} />
            <span>{s.name}{s.isOwnerGuess ? <span className="guess">Your first guess</span> : null}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
