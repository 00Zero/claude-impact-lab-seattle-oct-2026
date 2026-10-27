"use client";

import { useEffect, useRef, useState } from "react";
import { niceStep } from "@/lib/chart";
import type { ForecastPoint, WeekPoint } from "@/lib/insights";

// Seats booked per week: 8 past weeks as a solid basil line, 4 forecast weeks as a
// dashed line over a mint "likely range". Same patterns as GuestsChart: drawn at the
// container's real size, colors through `style` because SVG attributes don't resolve var().
const LINE = { stroke: "var(--alt-basil)", strokeWidth: 3, fill: "none", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const DOT = { fill: "var(--alt-basil)" };
const HOLLOW = { fill: "var(--alt-surface)", stroke: "var(--alt-basil)", strokeWidth: 2 };
const RANGE = { fill: "var(--alt-mint)" };
const GRID = { stroke: "var(--alt-divider)" };
const AXIS = { stroke: "var(--alt-field-border)" };
const TODAY = { stroke: "var(--alt-field-border)", strokeDasharray: "4 4" };
const TEXT = { fill: "var(--alt-ink-soft)", fontSize: 14 };
const LABEL = { fill: "var(--alt-ink)", fontSize: 14, fontWeight: 600 };

const H = 260;
const M = { t: 32, r: 12, b: 32, l: 34 };

const shortDate = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

export function ForecastChart({ weeks, forecast }: { weeks: WeekPoint[]; forecast: ForecastPoint[] }) {
  const [W, setW] = useState(560);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = weeks.length + forecast.length;
  const max = Math.max(1, ...weeks.map((w) => w.seatsBooked), ...forecast.map((f) => f.high));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const band = (W - M.l - M.r) / n;
  const x = (i: number) => M.l + band * i + band / 2;
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);

  const lastI = weeks.length - 1;
  const last = weeks[lastI]?.seatsBooked ?? 0;
  const pt = (i: number, v: number) => `${x(i)},${y(v)}`;
  const past = weeks.map((w, i) => pt(i, w.seatsBooked)).join(" ");
  const ahead = [pt(lastI, last), ...forecast.map((f, i) => pt(weeks.length + i, f.expected))].join(" ");
  const range = [
    pt(lastI, last),
    ...forecast.map((f, i) => pt(weeks.length + i, f.high)),
    ...forecast.map((f, i) => pt(weeks.length + i, f.low)).reverse(),
  ].join(" ");
  const divider = M.l + band * weeks.length;
  // Every other week, or every third on a phone so 14px dates never touch.
  const every = band * 2 < 56 ? 3 : 2;

  const lo = Math.min(...forecast.map((f) => f.low));
  const hi = Math.max(...forecast.map((f) => f.high));
  const summary =
    `Line chart of seats booked per week. Over the last ${weeks.length} weeks it went from ${weeks[0]?.seatsBooked ?? 0} to ${last} seats. ` +
    `Forecast for the next ${forecast.length} weeks: about ${Math.min(...forecast.map((f) => f.expected))} to ${Math.max(...forecast.map((f) => f.expected))} seats a week, likely between ${lo} and ${hi}.`;

  return (
    <div className="flex flex-col">
      <p className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-base">
        <span className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden="true">
            <line x1="2" x2="22" y1="4" y2="4" style={LINE} />
          </svg>
          Booked
        </span>
        <span className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden="true">
            <line x1="2" x2="22" y1="4" y2="4" style={{ ...LINE, strokeDasharray: "7 6", strokeLinecap: "butt" }} />
          </svg>
          Forecast
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 bg-mint" aria-hidden="true" /> Likely range
        </span>
      </p>

      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={summary}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} strokeWidth={1} style={t === 0 ? AXIS : GRID} />
              <text x={M.l - 8} y={y(t) + 5} textAnchor="end" style={TEXT}>
                {t}
              </text>
            </g>
          ))}

          <polygon points={range} style={RANGE} />
          <line x1={divider} x2={divider} y1={M.t - 8} y2={H - M.b} strokeWidth={1} style={TODAY} />
          <text x={divider + 6} y={M.t - 14} style={LABEL}>
            Forecast
          </text>

          <polyline points={past} style={LINE} />
          <polyline points={ahead} style={{ ...LINE, strokeDasharray: "7 6", strokeLinecap: "butt" }} />
          {weeks.map((w, i) => (
            <circle key={w.weekStart} cx={x(i)} cy={y(w.seatsBooked)} r={4.5} style={DOT} />
          ))}
          {forecast.map((f, i) => (
            <circle key={f.weekStart} cx={x(weeks.length + i)} cy={y(f.expected)} r={4.5} style={HOLLOW} />
          ))}

          {[...weeks.map((w) => w.weekStart), ...forecast.map((f) => f.weekStart)].map((key, i) =>
            i % every === 0 ? (
              <text key={key} x={x(i)} y={H - 8} textAnchor="middle" style={TEXT}>
                {shortDate(key)}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <details className="mt-3">
        <summary className="alt-link cursor-pointer">View as table</summary>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 pr-2 font-semibold">Week of</th>
              <th className="py-1 pr-2 font-semibold">Seats booked</th>
              <th className="py-1 font-semibold">Seats offered</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart} className="border-t border-divider">
                <td className="py-1.5 pr-2">{shortDate(w.weekStart)}</td>
                <td className="py-1.5 pr-2 tabular-nums">{w.seatsBooked}</td>
                <td className="py-1.5 tabular-nums">{w.seatsOffered}</td>
              </tr>
            ))}
            {forecast.map((f) => (
              <tr key={f.weekStart} className="border-t border-divider">
                <td className="py-1.5 pr-2">{shortDate(f.weekStart)} (forecast)</td>
                <td className="py-1.5 pr-2 tabular-nums">
                  About {f.expected} (likely {f.low}–{f.high})
                </td>
                <td className="py-1.5 tabular-nums">–</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
