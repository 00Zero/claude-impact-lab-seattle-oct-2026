import { PLAIN } from "@/app/_intake/labels";
import type { IntakeBrief } from "@/app/_intake/schema";
import { Icon } from "../figures";
import { Tag } from "../evidence/Tag";
import { PlateFrame } from "./PlateFrame";

const sentence = (x: IntakeBrief["hypotheses"][number]) => `${x.segment} will ${x.action} because ${x.motivation}, instead of ${x.insteadOf}, at ${x.price}.`;

export function SaveFilePlate({ brief, updated, downloadHref }: { brief: IntakeBrief; updated?: boolean; downloadHref?: string }) {
  const lex = new Map(brief.lexicon.map((l) => [l.id, l]));
  const r = brief.readiness;
  return (
    <PlateFrame title="Your save file" updated={updated}>
      {brief.icp ? (
        <dl className="answers">
          <div className="answer"><dt>Who to target</dt><dd>{brief.icp.statement}</dd></div>
          <div className="answer"><dt>They must</dt><dd className="list"><ul>{brief.icp.mustHaves.map((m) => <li key={m}>{m}</li>)}</ul></dd></div>
          <div className="answer"><dt>Rule out</dt><dd className="list"><ul>{brief.icp.disqualifiers.map((m) => <li key={m}>{m}</li>)}</ul></dd></div>
        </dl>
      ) : <p>No customer group is supported yet. That&apos;s a real result: the open questions below say what would change it.</p>}
      {brief.hypotheses.map((x) => (
        <div key={x.id} className={x.kind === "primary" ? "hyp primary" : "hyp"}>
          <h4>{x.kind === "primary" ? "Best bet" : "Alternative"}</h4>
          <p>{sentence(x)}</p>
          <p className="sub"><Tag text={PLAIN.hypothesisStatus[x.status]} variant={`h-${x.status}`} /> Wrong if: {x.wrongIf}</p>
        </div>
      ))}
      <h4>Lines to test</h4>
      <ol className="lines">
        {brief.roughMessaging.map((m, i) => (
          <li key={m.headline}><b>{"ABCD"[i] ?? i + 1}</b><div>
            <span className="strong">{m.headline}</span><span className="sub">{m.subheadline}</span>
            {m.lexiconIds.length ? <span className="borrowed">Borrows: {m.lexiconIds.map((id, k) => <span key={id}>{k ? " · " : ""}<mark>{lex.get(id)?.phrase ?? id}</mark></span>)}</span> : null}
          </div></li>
        ))}
      </ol>
      <p className="draft-tag">Draft lines: verify before publishing.</p>
      {brief.openQuestions.length ? (<><h4>Still open</h4><ul className="open">{brief.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul></>) : null}
      <h4>{PLAIN.readiness[r.status]}</h4>
      <ul className="checks">
        {r.checks.map((c) => (
          <li key={c.check} className={c.pass ? "pass" : "fail"}><Icon name={c.pass ? "i-check" : "i-warn"} />
            <span>{c.check.replace(/^\[script\]\s*/, "").replace(/\bICP\b/g, "Target customer")}</span>
            {/^\[script\]/.test(c.check) ? <span className="applies">checked by code</span> : null}</li>
        ))}
      </ul>
      {downloadHref ? <div className="actions"><a className="btn secondary small" href={downloadHref} download="intake.json"><Icon name="i-down" />Download save file (intake.json)</a></div> : null}
    </PlateFrame>
  );
}
