import type { DateValue } from "./contracts";

const TZ = "America/Los_Angeles";

/** Today's calendar date in Washington, as YYYY-MM-DD. */
export function todayInWashington(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Whole days from today (Washington) to a DateValue's calendar date. */
export function daysUntil(d: DateValue, now = new Date()): number {
  const target = d.precision === "date" ? d.value : todayInWashington(new Date(d.value));
  const t = Date.parse(`${target}T00:00:00Z`);
  const today = Date.parse(`${todayInWashington(now)}T00:00:00Z`);
  return Math.round((t - today) / 864e5);
}

export function isDeadlinePassed(d: DateValue | null, now = new Date()): boolean {
  if (!d) return false;
  if (d.precision === "datetime") return Date.parse(d.value) < now.getTime();
  // Date-only: still open on the listed day; time of day unknown (SRS 12.5).
  return daysUntil(d, now) < 0;
}

/** Sort key in ms; date-only values sort at the end of their day. */
export function dateSortKey(d: DateValue | null): number | null {
  if (!d) return null;
  return d.precision === "datetime" ? Date.parse(d.value) : Date.parse(`${d.value}T23:59:59-08:00`);
}

const fmtDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
const fmtDayShort = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const fmtTime = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export function formatDateValue(d: DateValue, opts: { short?: boolean; timeNote?: boolean } = {}): string {
  const date = d.precision === "date" ? new Date(`${d.value}T12:00:00Z`) : new Date(d.value);
  const f = opts.short ? fmtDayShort : fmtDay;
  if (d.precision === "date") return opts.timeNote && !opts.short ? `${f.format(date)} (time not stated)` : f.format(date);
  return `${f.format(date)}, ${fmtTime.format(date)}`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${fmtDay.format(d)}, ${fmtTime.format(d)}`;
}

/** "Closes in 4 days" style label for cards. */
export function deadlineLabel(d: DateValue | null, now = new Date()): { text: string; urgent: boolean } {
  if (!d) return { text: "Deadline not published", urgent: false };
  const n = daysUntil(d, now);
  if (n < 0) return { text: "Deadline passed", urgent: false };
  if (n === 0) return { text: d.precision === "date" ? "Closes today, time not stated" : `Closes today, ${fmtTime.format(new Date(d.value))}`, urgent: true };
  if (n === 1) return { text: "Closes tomorrow", urgent: true };
  if (n <= 7) return { text: `Closes in ${n} days`, urgent: true };
  return { text: `Closes ${formatDateValue(d, { short: true })}`, urgent: false };
}

export function postedLabel(d: DateValue | null, now = new Date()): string {
  if (!d) return "Publication date unknown";
  const n = -daysUntil(d, now);
  if (n <= 0) return "Posted today";
  if (n === 1) return "Posted yesterday";
  if (n < 14) return `Posted ${n} days ago`;
  return `Posted ${formatDateValue(d, { short: true })}`;
}
