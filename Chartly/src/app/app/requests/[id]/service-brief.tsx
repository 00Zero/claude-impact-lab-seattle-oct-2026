"use client";

import { useState, type ReactNode } from "react";
import type { BriefAnswer, BriefPhoto, Confidence, ServiceBrief as Brief } from "@/lib/brief-types";
import { PhotoViewer } from "./photo-viewer";

// The contractor's one-screen brief: verdict → bring → confirm on site →
// photos → more details. Reasons live in the photo viewer, not here.
// See docs/design/README.md.
export function ServiceBrief({
  brief,
  photos,
  answers,
  customerName,
}: {
  brief: Brief;
  photos: BriefPhoto[];
  answers: BriefAnswer[];
  customerName: string;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [packed, setPacked] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="verdict" className="rounded-2xl border-2 border-ink bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Likely cause</Eyebrow>
          <ConfidenceBadge confidence={brief.confidence} />
        </div>
        <h2 id="verdict" className="mt-1 font-display text-xl font-extrabold leading-tight">
          {brief.verdict}
        </h2>
        <p className="mt-1.5 text-base">{brief.why}</p>
        {photos.length ? (
          <button
            type="button"
            onClick={() => setViewing(0)}
            className="mt-1 min-h-12 font-bold text-accent-strong underline-offset-4 hover:underline"
          >
            See why →
          </button>
        ) : null}
      </section>

      {brief.bring.length ? (
        <Card title="Bring">
          <ul>
            {brief.bring.map((b, i) => (
              <li key={i} className="border-t border-line first:border-t-0">
                <label className="flex min-h-12 cursor-pointer items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={packed[i] ?? false}
                    onChange={(e) => setPacked((p) => ({ ...p, [i]: e.target.checked }))}
                    className="mt-0.5 h-5 w-5 flex-none accent-accent-strong"
                  />
                  <span className={packed[i] ? "text-muted line-through" : ""}>
                    {b.item}
                    {b.note ? <span className="block text-sm text-muted">{b.note}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Confirm on site">
        <p className="mt-1.5">{brief.confirmOnSite}</p>
        {brief.alsoPossible.length ? (
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {brief.alsoPossible.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                Also possible: {a.cause} <ConfidenceBadge confidence={a.confidence} />
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {photos.length ? (
        <section aria-labelledby="photos" className="mt-2">
          <h3 id="photos" className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Photos · tap to see the AI’s notes
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {photos.map((p, i) => {
              const count = brief.photoNotes.filter((n) => n.photoId === p.id).length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setViewing(i)}
                  className="relative overflow-hidden rounded-xl border border-line text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private signed URLs in production */}
                  <img src={p.url} alt={p.title} className="aspect-[4/3] w-full object-cover" />
                  {count ? (
                    <span className="absolute bottom-2 left-2 rounded-md bg-accent px-2 py-0.5 text-xs font-extrabold text-accent-ink">
                      {count} AI note{count === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <details className="group mt-2 rounded-2xl border border-line bg-white px-4 py-3">
        <summary className="flex min-h-10 cursor-pointer items-center font-bold">More details</summary>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-[15px]">
          <dt className="text-muted">Equipment</dt>
          <dd className="font-semibold">{brief.equipment.label}</dd>
          <dt className="text-muted">Model</dt>
          <dd>
            <Copyable value={brief.equipment.model} />
          </dd>
          <dt className="text-muted">Serial</dt>
          <dd>
            <Copyable value={brief.equipment.serial} />
          </dd>
          {brief.estimate ? (
            <>
              <dt className="text-muted">Estimate</dt>
              <dd className="font-semibold">
                ${brief.estimate.low}–${brief.estimate.high}
              </dd>
            </>
          ) : null}
        </dl>

        {brief.notSeen ? (
          <>
            <Eyebrow className="mt-4 block">What the AI didn’t see</Eyebrow>
            <p className="mt-1 text-[15px]">{brief.notSeen}</p>
          </>
        ) : null}

        {answers.length ? (
          <>
            <Eyebrow className="mt-4 block">{customerName}’s answers</Eyebrow>
            <dl className="mt-1">
              {answers.map((a) => (
                <div
                  key={a.questionId}
                  className="flex justify-between gap-4 border-t border-line py-2 text-[15px] first:border-t-0"
                >
                  <dt className="text-muted">{a.short}</dt>
                  <dd className="text-right">{a.answer || "Skipped"}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </details>

      <PhotoViewer
        photos={photos}
        notes={brief.photoNotes}
        answerNotes={brief.answerNotes}
        customerName={customerName}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

const CONFIDENCE: Record<Confidence, { icon: string; label: string; className: string }> = {
  high: { icon: "●", label: "High", className: "border-ok text-ok" },
  med: { icon: "◑", label: "Med", className: "border-caution text-caution" },
  // Low is grey, not red: it's uncertainty, not danger.
  low: { icon: "◔", label: "Low", className: "border-wait text-wait" },
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const c = CONFIDENCE[confidence];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border-[1.5px] px-2 py-0.5 text-xs font-bold ${c.className}`}
    >
      <span aria-hidden>{c.icon}</span> {c.label}
      <span className="sr-only"> confidence</span>
    </span>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </section>
  );
}

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-xs font-bold uppercase tracking-wider text-muted ${className}`}>{children}</span>
  );
}

function Copyable({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted">Not read</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono font-semibold">{value}</span>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
        className="min-h-10 px-1 text-xs font-bold text-accent-strong"
      >
        {copied ? "COPIED" : "COPY"}
      </button>
    </span>
  );
}
