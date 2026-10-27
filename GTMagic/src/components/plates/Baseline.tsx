import type { IntakeBrief } from "@/app/_intake/schema";

/** The plain-AI guess frozen before research: model output, so the dashed, hue-free register. */
export function BaselinePlate({ baseline }: { baseline: IntakeBrief["baseline"] }) {
  const at = new Date(baseline.frozenAt);
  const time = Number.isNaN(at.getTime()) ? "" : ` · frozen at ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return (
    <section className="baseline" aria-label="Plain AI guess before research">
      <span className="sim-label">Plain AI guess, made before any research{time}</span>
      <div className="baseline-cols">
        <div><h4>Who it guessed</h4><ul>{baseline.icps.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><h4>Lines it suggested</h4><ul>{baseline.taglines.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
    </section>
  );
}
