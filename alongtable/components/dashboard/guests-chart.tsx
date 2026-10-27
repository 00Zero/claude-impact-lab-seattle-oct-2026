"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { niceStep } from "@/lib/chart";

export type DayPoint = {
  key: string;
  label: string;
  weekday: string;
  /** Seats reserved by guests. */
  guests: number;
  events: number;
  /** Seats on offer that day (booked + still open). */
  seats: number;
  spaces: number;
};

// Brand tokens only (brand/DESIGN.md): ink = taken seats, divider = open seats, like the seat bar.
// Colors go through `style` because SVG presentation attributes don't resolve var().
const TAKEN = { fill: "var(--alt-ink)" };
const OPEN = { fill: "var(--alt-divider)" };
const BAND = { fill: "var(--alt-sunken)" };
const GRID = { stroke: "var(--alt-divider)" };
const AXIS = { stroke: "var(--alt-field-border)" };
const TEXT = { fill: "var(--alt-ink-soft)", fontSize: 14 };

const MIN_H = 200;
const M = { t: 12, r: 8, b: 44, l: 34 };
const MAX_BAR = 24;
const GAP = 2;

/** Column with a rounded top (radius `r`, capped) and a square base, growing from the baseline. */
function columnPath(x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + k} Q${x},${y} ${x + k},${y} H${x + w - k} Q${x + w},${y} ${x + w},${y + k} V${y + h} Z`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function GuestsChart({ days }: { days: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Drawn at the container's real size so text stays readable and the chart fills its card.
  const [W, setW] = useState(480);
  const [H, setH] = useState(MIN_H);
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const n = days.length;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setW(Math.max(280, Math.round(e.contentRect.width)));
      setH(Math.max(MIN_H, Math.round(e.contentRect.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...days.map((d) => d.seats));
  const step = niceStep(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const plotW = W - M.l - M.r;
  const band = plotW / n;
  const barW = Math.max(4, Math.min(MAX_BAR, band - GAP * 2));
  const cx = (i: number) => M.l + band * i + band / 2;
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const a = active === null ? null : days[active];
  // Label every other day when bars get tight so 14px day numbers never touch.
  const every = band < 22 ? 2 : 1;

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setActive(Math.min(n - 1, Math.max(0, Math.floor((px - M.l) / band))));
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowRight") setActive((i) => Math.min(n - 1, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? n) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-3 flex items-center gap-5 text-base">
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-ink" /> Booked
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-divider" /> Open seats
        </span>
      </p>

      <div ref={box} className="relative min-h-52 flex-1">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 block h-full w-full touch-pan-y rounded-small outline-none focus-visible:shadow-[var(--alt-focus)]"
          tabIndex={0}
          role="img"
          aria-label={`Bar chart of seats booked out of total seats for each of the next ${n} days. Use the left and right arrow keys to read each day.`}
          onPointerMove={onPointer}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          {active !== null && (
            <rect x={M.l + band * active} y={M.t} width={band} height={H - M.t - M.b} rx={6} style={BAND} />
          )}

          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} strokeWidth={1} style={t === 0 ? AXIS : GRID} />
              <text x={M.l - 8} y={y(t) + 5} textAnchor="end" style={TEXT}>
                {t}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const [month, day] = d.label.split(" ");
            const x = cx(i) - barW / 2;
            const full = d.seats > 0 && d.guests >= d.seats;
            return (
              <g key={d.key}>
                {d.seats > 0 && <path d={columnPath(x, y(d.seats), barW, y(0) - y(d.seats), 4)} style={OPEN} />}
                {d.guests > 0 && (
                  <path d={columnPath(x, y(d.guests), barW, y(0) - y(d.guests), full ? 4 : 0)} style={TAKEN} />
                )}
                {i % every === 0 && (
                  <text x={cx(i)} y={H - 24} textAnchor="middle" style={TEXT}>
                    {day}
                  </text>
                )}
                {(i === 0 || day === "1") && (
                  <text x={cx(i)} y={H - 6} textAnchor="middle" style={{ ...TEXT, fontWeight: 600 }}>
                    {month}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {a && active !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-control bg-ink px-4 py-3 text-sm text-white"
            style={{
              left: `${(cx(active) / W) * 100}%`,
              transform: active > n / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <p className="font-semibold">
              {a.weekday === "Today" ? "Today" : a.weekday}, {a.label}
            </p>
            {a.seats === 0 ? (
              <p className="mt-1">No spaces published</p>
            ) : (
              <>
                <p className="mt-1 text-base font-semibold tabular-nums">
                  {a.guests} of {a.seats} seats booked
                </p>
                <p className="tabular-nums">{a.seats - a.guests} open</p>
                <p>
                  {plural(a.spaces, "space", "spaces")} · {plural(a.events, "event", "events")}
                </p>
              </>
            )}
          </div>
        )}

        {max === 0 && active === null && (
          <p className="alt-secondary pointer-events-none absolute inset-x-0 top-1/3 text-center">
            No spaces published in the next {n} days
          </p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {a
          ? a.seats === 0
            ? `${a.weekday} ${a.label}: no spaces published`
            : `${a.weekday} ${a.label}: ${a.guests} of ${a.seats} seats booked, ${a.seats - a.guests} open, ${plural(a.events, "event", "events")}`
          : ""}
      </p>

      <details className="mt-3">
        <summary className="alt-link cursor-pointer">View as table</summary>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 pr-2 font-semibold">Day</th>
              <th className="py-1 pr-2 font-semibold">Events</th>
              <th className="py-1 pr-2 font-semibold">Booked</th>
              <th className="py-1 pr-2 font-semibold">Open</th>
              <th className="py-1 font-semibold">Total seats</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.key} className="border-t border-divider">
                <td className="py-1.5 pr-2">
                  {d.weekday}, {d.label}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">{d.events}</td>
                <td className="py-1.5 pr-2 tabular-nums">{d.guests}</td>
                <td className="py-1.5 pr-2 tabular-nums">{d.seats - d.guests}</td>
                <td className="py-1.5 tabular-nums">{d.seats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
