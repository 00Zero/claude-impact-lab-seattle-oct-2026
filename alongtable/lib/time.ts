const TZ = "America/Los_Angeles";

/** Convert a Seattle wall-clock date ("2026-11-04") and time ("18:00") to a UTC Date. */
export function seattleToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asLocal - guess));
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTimeRange(start: Date, end: Date): string {
  const f = (d: Date) =>
    d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return `${f(start)} – ${f(end)}`;
}

export type DayOption = { value: string; weekday: string; label: string };

/** The next `count` calendar days (starting today) in Seattle time. */
export function upcomingDays(count: number): DayOption[] {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const [y, m, d] = ymd.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d + i, 12));
    const part = (o: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-US", { timeZone: "UTC", ...o });
    return {
      value: date.toISOString().slice(0, 10),
      weekday: i === 0 ? "Today" : part({ weekday: "short" }),
      label: part({ month: "short", day: "numeric" }),
    };
  });
}

/** "HH:MM" (24-hour) of an instant in Seattle, e.g. "18:00". Matches the `start` of a SLOTS entry. */
export function seattleHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** "YYYY-MM-DD" of an instant, as a Seattle calendar day. */
export function seattleDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Weekday, day and month of an instant as a Seattle calendar day, e.g. { weekday: "Tue", day: "27", month: "Oct" }. */
export function dateParts(d: Date): { weekday: string; day: string; month: string } {
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: TZ, ...o });
  return { weekday: part({ weekday: "short" }), day: part({ day: "numeric" }), month: part({ month: "short" }) };
}
