// Shared input styles and small pieces for the request and checkout forms.
export const fieldBase =
  "mt-2 w-full rounded-2xl border border-line bg-surface py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-soft/55 focus:border-ink focus:ring-4 focus:ring-ink/5 aria-[invalid=true]:border-signal aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-signal/10";
export const inputClass = `${fieldBase} px-4`;
export const focusRing = "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-signal/25";
export const cardChoiceClass = `group flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition hover:border-ink/40 has-[:checked]:border-ink has-[:checked]:shadow-[0_0_0_1px_var(--ink)] ${focusRing}`;

export function RadioDot() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-ink/25 bg-surface transition group-has-[:checked]:border-ink"
    >
      <span className="h-2.5 w-2.5 scale-0 rounded-full bg-ink transition group-has-[:checked]:scale-100" />
    </span>
  );
}

export function FieldError({ field, message }) {
  if (!message) return null;
  return (
    <p id={`field-${field}-error`} className="mt-2 text-sm text-signal">
      {message}
    </p>
  );
}
