/* Simulated words: always this dashed, hue-free register, always labelled. */
import { Figure } from "../figures";

export function SimulatedBlock({ label = "Simulated customer, not a real quote", text }: { label?: string; text: string }) {
  return (
    <div className="sim">
      <span className="sim-label"><Figure />{label}</span>
      <p>{text}</p>
    </div>
  );
}
