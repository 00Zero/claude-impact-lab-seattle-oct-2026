import Link from "next/link";
import { CalendarCheck, CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import type { DayStats } from "@/lib/stats";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Calendar({
  month,
  todayKey,
  stats,
}: {
  month: string; // "YYYY-MM"
  todayKey: string;
  stats: Record<string, DayStats>;
}) {
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  const key = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const nav = "alt-button !min-h-11 !w-11 !px-0";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="alt-title">Calendar</h2>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <Link href={`?month=${shift(month, -1)}`} className={nav} aria-label="Previous month">
            <CaretLeft size={20} aria-hidden="true" />
          </Link>
          <Link href={`?month=${shift(month, 1)}`} className={nav} aria-label="Next month">
            <CaretRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1 text-left">
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th key={w} className="pb-1 text-center text-sm font-semibold text-ink-soft">
                <span className="sm:hidden">{w[0]}</span>
                <span className="hidden sm:inline">{w}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((d, c) => {
                if (d === null) return <td key={c} />;
                const s = stats[key(d)];
                const isToday = key(d) === todayKey;
                const full = s && s.seats > 0 && s.guests >= s.seats;
                const openOnly = s && s.spaces > 0 && s.events === 0;
                const label = s
                  ? openOnly
                    ? `${plural(s.spaces, "open space", "open spaces")}, not booked yet, ${s.seats} seats`
                    : `${plural(s.events, "event", "events")}, ${s.guests} of ${s.seats} seats booked, ${s.seats - s.guests} open`
                  : "no spaces";
                // Mint = a booked day (brand meaning); sunken = quiet, with a dashed ring if a space is open but unbooked.
                return (
                  <td
                    key={c}
                    aria-label={`${title.split(" ")[0]} ${d}: ${label}`}
                    className={`h-[76px] rounded-small align-top ${s && s.events > 0 ? "bg-mint" : "bg-sunken"}`}
                  >
                    <div className="flex h-full flex-col p-1.5 text-sm leading-tight">
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={
                            isToday
                              ? "inline-flex size-6 items-center justify-center rounded-full bg-ink font-semibold text-white"
                              : "font-semibold"
                          }
                        >
                          {d}
                        </span>
                        {s && s.events > 0 && (
                          <span className="hidden items-center gap-0.5 font-semibold sm:flex">
                            <CalendarCheck size={14} aria-hidden="true" />
                            {s.events}
                          </span>
                        )}
                        {openOnly && (
                          <span aria-hidden="true" className="mt-0.5 size-3 shrink-0 rounded-full border-2 border-dashed border-basil" />
                        )}
                      </div>
                      {s && s.seats > 0 && (
                        <div className="mt-auto">
                          <p className="font-semibold tabular-nums">{full ? "Full" : `${s.guests}/${s.seats}`}</p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                            <div
                              className="h-full rounded-full bg-ink"
                              style={{ width: `${Math.min(100, (s.guests / s.seats) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-base">
        <span className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-small bg-mint" /> Has a booked event
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-6 overflow-hidden rounded-full bg-divider">
            <span className="block h-full w-1/2 bg-ink" />
          </span>
          Seats booked / total
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full border-2 border-dashed border-basil" /> Open space, not booked yet
        </span>
      </p>
    </div>
  );
}
