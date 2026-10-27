import { Check } from "@phosphor-icons/react/ssr";

// Onboarding progress for /restaurant/signup. The side list shows on desktop
// (≥ 1024px); the top bar replaces it on smaller screens. `current` is 6 on the
// Live screen, after the last step, so every step shows as done.

export type Step = 1 | 2 | 3 | 4 | 5 | 6;

export const STEP_LABELS = ["Find your restaurant", "Confirm details", "Pick dates", "House rules", "Review and publish"] as const;

const fill = { transition: "background-color var(--alt-dur-toast) var(--alt-ease)" };

export function Steps({ current }: { current: Step }) {
  return (
    <nav aria-label="Setup progress" className="flex flex-col gap-6">
      <p className="alt-lead font-extrabold text-ink">List your restaurant</p>
      <ol className="flex flex-col gap-4">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "later";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex min-h-11 items-center gap-3">
              <span
                aria-hidden="true"
                style={fill}
                className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                  state === "done" ? "bg-basil text-surface" : state === "current" ? "bg-ink text-surface" : "bg-sunken text-ink-soft"
                }`}
              >
                {state === "done" ? <Check size={16} weight="bold" /> : n}
              </span>
              <span
                className={`alt-lead ${state === "done" ? "font-semibold text-ink" : state === "current" ? "font-extrabold text-ink" : "text-ink-soft"}`}
              >
                {label}
                {state === "done" && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepBar({ current }: { current: Step }) {
  const total = STEP_LABELS.length;
  return (
    <div className="flex flex-col gap-2">
      <p className="alt-label-text" aria-current={current <= total ? "step" : undefined}>
        {current <= total ? `Step ${current} of ${total} · ${STEP_LABELS[current - 1]}` : "All steps done"}
      </p>
      <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
        {STEP_LABELS.map((label, i) => (
          <span key={label} style={fill} className={`h-1.5 rounded-full ${i + 1 <= current ? "bg-basil" : "bg-divider"}`} />
        ))}
      </div>
    </div>
  );
}
