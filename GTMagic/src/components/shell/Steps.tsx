import type { StepId } from "@/app/_session/events";
import type { StepState } from "@/app/_session/thread";

export const STEP_LABELS: Record<StepId, string> = {
  describe: "Describe it", guess: "Plain AI guess", answers: "Your answers", research: "Research",
  check: "Check it together", save: "Your save file", test: "Test your lines", results: "Results",
};

export function Steps({ steps }: { steps: Record<StepId, StepState> }) {
  return (
    <section className="rail-block" aria-labelledby="steps-h">
      <h2 id="steps-h" className="rail-h">This run</h2>
      <ol className="steps">
        {(Object.keys(STEP_LABELS) as StepId[]).map((s) => (
          <li key={s} data-step={s} data-state={steps[s] === "pending" ? undefined : steps[s]}>{STEP_LABELS[s]}</li>
        ))}
      </ol>
    </section>
  );
}
