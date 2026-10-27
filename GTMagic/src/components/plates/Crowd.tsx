"use client";
/* The live crowd: one figure per simulated customer, dropping into the row of the line they chose.
   Choices are PLACEHOLDER (sim-placeholder.ts) until the simulation step exists. */
import { useEffect, useMemo, useState } from "react";
import type { IntakeBrief } from "@/app/_intake/schema";
import type { SimCustomer, SimRun } from "@/app/_intake/sim-placeholder";
import { Figure } from "../figures";
import { GroupFigure } from "../evidence/GroupFigure";
import { groupClasses } from "../evidence/groups";
import { CustomerCard } from "./CustomerCard";
import { PlateFrame } from "./PlateFrame";

type Props = { brief: IntakeBrief; sim: SimRun; animate?: boolean; hideLinks?: boolean; updated?: boolean; onProgress?: (n: number) => void; onDone?: () => void };

export const PLACEHOLDER_NOTE = "Placeholder choices: the simulation step isn't built yet. Groups, lines and quotes are from your save file.";

export function CrowdPlate({ brief, sim, animate = false, hideLinks, updated, onProgress, onDone }: Props) {
  const total = sim.customers.length;
  const [shown, setShown] = useState(animate ? 0 : total);
  const [open, setOpen] = useState<SimCustomer | null>(null);
  const groups = useMemo(() => groupClasses(brief.segments), [brief.segments]);
  const rank = new Map(brief.segments.map((s) => [s.id, s.ownerRank ?? 9]));
  const done = shown >= total;

  useEffect(() => {
    if (shown >= total) { onDone?.(); return; }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => { setShown((n) => n + 1); onProgress?.(shown + 1); }, reduce ? 0 : 70 + (shown % 5) * 18);
    return () => clearTimeout(t);
  }, [shown, total, onDone, onProgress]);

  const rows = [...sim.messages.map((m) => ({ key: m.label, label: m.label, text: m.headline, own: m.isOwn })), { key: "none", label: "–", text: "None of these", own: false }];
  const visible = sim.customers.slice(0, shown);
  const counts = new Map<string, number>();
  for (const c of visible) counts.set(c.choice, (counts.get(c.choice) ?? 0) + 1);
  const top = [...counts].filter(([k]) => k !== "none").sort((a, b) => b[1] - a[1])[0]?.[0];
  const segName = (id: string) => brief.segments.find((s) => s.id === id)?.name ?? id;

  const figure = (c: SimCustomer) => (
    <button key={c.id} type="button" aria-pressed={open?.id === c.id}
      className={`fig ${c.choice === "none" ? "none gn" : groups.get(c.segmentId) ?? "gn"}${animate && !done ? " drop" : ""}`}
      aria-label={`${c.id}, ${segName(c.segmentId)}, chose ${c.choice === "none" ? "none of these" : c.choice}`}
      onClick={() => setOpen(open?.id === c.id ? null : c)}><Figure /></button>
  );

  return (
    <PlateFrame title="Which line would make you act?" label="Customers choosing" updated={updated}
      meta={`${sim.size} simulated customers, built from your customer groups (${brief.segments.map((s, i) => `${sim.perSegment[i] ?? 0} ${s.name.toLowerCase()}`).join(", ")}). Each sees the lines unbranded, in a shuffled order, and can pick none. Select a figure to meet them.`}>
      <ul className="key" aria-label="Key">
        {brief.segments.map((s) => <li key={s.id}><GroupFigure group={groups.get(s.id) ?? "gn"} />{s.name}</li>)}
        <li><span className="gn none-key"><Figure /></span>None of these</li>
      </ul>
      <p className="crowd-status"><b>{shown}</b>{done && top ? ` of ${total} answered. Line ${top} was picked most.` : ` of ${total} customers have chosen`}</p>
      <div className="crowd" role="list" aria-label="Choices so far">
        {rows.map((r) => {
          const mine = visible.filter((c) => c.choice === r.key);
          const sorted = done ? [...mine].sort((a, b) => (rank.get(a.segmentId) ?? 9) - (rank.get(b.segmentId) ?? 9)) : mine;
          const blocks = done ? Array.from({ length: Math.ceil(sorted.length / 5) }, (_, k) => sorted.slice(k * 5, k * 5 + 5)) : [sorted];
          return (
            <div key={r.key} className={done && r.key === top ? "crow lead" : "crow"} role="listitem">
              <b>{r.label}</b>
              <span className="msg">{r.own ? <em>Your own line</em> : null}{r.text}</span>
              <div className="figs">{done ? blocks.map((b, k) => <span key={k} className="block">{b.map(figure)}</span>) : sorted.map(figure)}</div>
              <span className="count">{counts.get(r.key) ?? 0}</span>
            </div>
          );
        })}
      </div>
      {open ? <CustomerCard c={open} groupName={segName(open.segmentId)} group={groups.get(open.segmentId) ?? "gn"} hideLinks={hideLinks} onClose={() => setOpen(null)} /> : null}
      <p className="draft-tag">{PLACEHOLDER_NOTE}</p>
    </PlateFrame>
  );
}
