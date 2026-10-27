/* What the crowd picked: computed from the counts in code; nothing here is the model's opinion. */
import type { IntakeBrief } from "@/app/_intake/schema";
import type { SimRun } from "@/app/_intake/sim-placeholder";
import { PLACEHOLDER_NOTE } from "./Crowd";
import { PlateFrame } from "./PlateFrame";

export function ResultsPlate({ brief, sim, updated }: { brief: IntakeBrief; sim: SimRun; updated?: boolean }) {
  const n = sim.size;
  const tally = (pred: (c: SimRun["customers"][number]) => boolean) => sim.customers.filter(pred).length;
  const rows = sim.messages.map((m) => ({ ...m, count: tally((c) => c.choice === m.label) })).sort((a, b) => b.count - a.count);
  const groups = brief.segments.map((s, i) => {
    const gn = sim.perSegment[i] ?? 0;
    const acted = tally((c) => c.segmentId === s.id && c.choice !== "none");
    return { s, n: gn, acted, share: gn ? acted / gn : 0 };
  }).sort((a, b) => b.share - a.share);
  const best = groups[0];
  const guess = groups.find((g) => g.s.isOwnerGuess);
  const strongest = rows[0];
  if (!best || !strongest) return null;
  return (
    <PlateFrame title="What the crowd picked" label="Results" updated={updated}>
      <dl className="answers">
        <div className="answer"><dt>Most ready to act</dt><dd>{best.s.name}: {best.acted} of {best.n} picked a line.</dd></div>
        {guess && guess !== best ? <div className="answer"><dt>Your first guess</dt><dd>{guess.s.name}: {guess.acted} of {guess.n} picked a line. The evidence and the crowd point to {best.s.name.toLowerCase()} instead.</dd></div> : null}
        <div className="answer"><dt>Strongest line</dt><dd>&ldquo;{strongest.headline}&rdquo;, picked by {strongest.count} of {n}.</dd></div>
      </dl>
      <table className="board">
        <thead><tr><th /><th>Line</th>{brief.segments.map((s) => <th key={s.id} className="num hide-sm">{s.name}</th>)}<th className="num">All</th></tr></thead>
        <tbody>
          {[...rows, { label: "–", headline: "None of these", isOwn: false, count: tally((c) => c.choice === "none"), subheadline: "" }].map((r) => (
            <tr key={r.label} className={r.isOwn ? "yours" : undefined}>
              <td><b>{r.label}</b></td>
              <td>{r.headline}{r.isOwn ? <span className="yours-tag">Your own line</span> : null}</td>
              {brief.segments.map((s, i) => <td key={s.id} className="num hide-sm">{tally((c) => c.segmentId === s.id && c.choice === (r.label === "–" ? "none" : r.label))} of {sim.perSegment[i] ?? 0}</td>)}
              <td className="num">{r.count} of {n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="plate-foot">
        <span>Simulated preference, n = {n}. Not a conversion rate.</span>
        <span>How consistent the result is will be shown once the simulation step runs it in different orders.</span>
      </div>
      <p className="draft-tag">{PLACEHOLDER_NOTE}</p>
    </PlateFrame>
  );
}
