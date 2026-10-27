/* Customer groups from research: verdict, counted worries, and how customers talk (customer voice only). */
import { num, plural } from "@/app/_intake/format";
import { PLAIN } from "@/app/_intake/labels";
import type { IntakeBrief, Segment } from "@/app/_intake/schema";
import { GroupFigure } from "../evidence/GroupFigure";
import { groupClasses, type GroupClass } from "../evidence/groups";
import { Quote } from "../evidence/Quote";
import { Tag } from "../evidence/Tag";
import { PlateFrame } from "./PlateFrame";

function Concerns({ seg, brief, group }: { seg: Segment; brief: IntakeBrief; group: GroupClass }) {
  const label = (id: string) => brief.concerns.find((c) => c.id === id)?.label ?? id;
  if (seg.concernBundles.length === 0) return <p className="sub">Worries not counted yet.</p>;
  return (
    <ul className="concerns">
      {seg.concernBundles.map((b) => (
        <li key={b.concernIds.join("+")}>
          <span>{b.concernIds.map(label).join(" + ")}</span>
          <span className="marks" aria-hidden="true">{Array.from({ length: b.observedCount }, (_, i) => <i key={i} className={group} />)}</span>
          <span className="count">{b.observedCount}</span>
        </li>
      ))}
    </ul>
  );
}

export function ResearchPlate({ brief, updated, hideLinks }: { brief: IntakeBrief; updated?: boolean; hideLinks?: boolean }) {
  const ev = new Map(brief.evidence.map((e) => [e.id, e]));
  const groups = groupClasses(brief.segments);
  const types = new Map<string, number>();
  for (const e of brief.evidence) types.set(PLAIN.sourceType[e.sourceType], (types.get(PLAIN.sourceType[e.sourceType]) ?? 0) + 1);
  return (
    <PlateFrame title={`${plural(brief.segments.length, "customer group")}, and how they talk`} label="Customer groups" updated={updated}
      meta={`${plural(brief.evidence.length, "piece")} of evidence: ${[...types].map(([t, n]) => plural(n, t)).join(", ")}.`}>
      {brief.segments.map((s) => {
        const sv = s.serviceability;
        const g = groups.get(s.id) ?? "gn";
        const lex = brief.lexicon.filter((l) => l.segmentIds.includes(s.id) && (l.voice ?? "customer") === "customer").slice(0, 2);
        // Other customer-voice excerpts for this group (forum posts and reviews), shown without a highlight.
        const quoted = new Set(lex.map((l) => l.evidenceId));
        const more = brief.evidence.filter((e) => e.segmentIds.includes(s.id) && e.concernIds.length > 0
          && (e.sourceType === "forum-post" || e.sourceType === "review") && !e.creativeId && !quoted.has(e.id))
          .sort((a, b) => (b.retrievedAt ?? "").localeCompare(a.retrievedAt ?? "")).slice(0, 4); // most recently researched first
        const inc = sv.incumbents[0];
        return (
          <article key={s.id} className="group">
            <div className="group-name"><GroupFigure group={g} /><h4>{s.name}</h4>{s.isOwnerGuess ? <span className="guess-tag">Your first guess</span> : null}</div>
            <p>{s.description}</p>
            {sv.verdict ? <p className="verdict-line"><Tag text={PLAIN.verdict[sv.verdict]} variant={`v-${sv.verdict}`} /> {sv.confidence ? PLAIN.confidence[sv.confidence] : ""}. {sv.reasoning}</p> : null}
            <h5>What they worry about (times it came up)</h5>
            <Concerns seg={s} brief={brief} group={g} />
            {lex.length + more.length > 0 ? (
              <>
                <h5>In their words</h5>
                {lex.flatMap((l) => { const e = ev.get(l.evidenceId); return e ? [<Quote key={l.id} evidence={e} phrase={l.phrase} hideLinks={hideLinks} />] : []; })}
                {more.map((e) => <Quote key={e.id} evidence={e} hideLinks={hideLinks} />)}
              </>
            ) : null}
            <dl className="facts-grid">
              {sv.size?.population != null ? (<><dt>Size</dt><dd>About {num(sv.size.population)} people{sv.size.isEstimate ? " (estimate)" : ""}. {sv.sizeMath?.minPopulation != null ? `You need at least ${num(sv.sizeMath.minPopulation)} to reach your minimum revenue.` : "Not judged yet: an input for the size check is missing."}</dd></>) : null}
              {inc ? (<><dt>Main alternative</dt><dd>{inc.name}{inc.rating != null ? `, rated ${inc.rating}${inc.reviewCount != null ? ` from ${num(inc.reviewCount)} reviews` : ""}` : ""}</dd></>) : null}
              {sv.motivation ? (<><dt>Why now</dt><dd>{sv.motivation}</dd></>) : null}
            </dl>
          </article>
        );
      })}
    </PlateFrame>
  );
}
