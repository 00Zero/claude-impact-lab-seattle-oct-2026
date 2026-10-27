"use client";

import { useState, useTransition } from "react";
import { setRequestReviewed } from "../actions";

export function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
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
  );
}

// Packing list for the truck. Ticks are only for the person looking at it;
// nothing is saved.
export function BringChecklist({ items }: { items: { item: string; why: string }[] }) {
  const [packed, setPacked] = useState<Record<number, boolean>>({});
  return (
    <ul>
      {items.map((b, i) => (
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
              {b.why ? <span className="block text-sm text-muted">{b.why}</span> : null}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function MarkReviewedButton({ requestId, reviewed }: { requestId: string; reviewed: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      type="button"
      disabled={pending}
      title={error ?? undefined}
      onClick={() =>
        startTransition(async () => {
          const result = await setRequestReviewed(requestId, !reviewed);
          setError(result.error ?? null);
        })
      }
      className={`inline-flex min-h-[52px] flex-[2] items-center justify-center rounded-2xl px-5 font-bold disabled:opacity-40 ${
        reviewed ? "border-[1.5px] border-line bg-white text-ink" : "bg-accent text-accent-ink"
      }`}
    >
      {error ? "Try again" : pending ? "Saving…" : reviewed ? "✓ Reviewed" : "Mark reviewed"}
    </button>
  );
}
