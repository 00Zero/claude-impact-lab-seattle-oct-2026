// Shared form styles, using the OneTrip tokens in globals.css. Touch targets
// stay ≥ 48px and inputs ≥ 16px so iOS doesn't zoom on focus.

export const labelClassName = "text-[13px] font-bold text-ink";

export const inputClassName =
  "h-12 rounded-xl border-[1.5px] border-line bg-white px-3 text-base text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent";

export const primaryButtonClassName =
  "inline-flex min-h-13 items-center justify-center rounded-2xl bg-accent px-5 text-base font-bold text-accent-ink hover:brightness-95 disabled:opacity-40";

export const secondaryButtonClassName =
  "inline-flex min-h-13 items-center justify-center rounded-2xl border-[1.5px] border-line bg-white px-5 text-base font-bold text-ink disabled:opacity-40";

export const statusClassName = "rounded-xl bg-chip p-4 text-[15px] leading-6 text-ink";

export const fieldErrorClassName = "text-sm font-medium text-danger";

export const textLinkClassName = "font-bold text-accent-strong underline underline-offset-2";
