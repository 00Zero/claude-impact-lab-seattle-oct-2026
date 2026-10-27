"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { AiTag } from "@/components/ui/ai-tag";
import type { Plan, PlanRecommendation } from "@/lib/planner";
import { formatDate, formatTimeRange } from "@/lib/time";
import { SAMPLE_REQUEST, samplePlan } from "./sample-plan";

const EXAMPLES = [
  SAMPLE_REQUEST,
  "Weekend lunch for my book club, 6 of us, somewhere with outdoor seating.",
  "Board game night for 10 people next week, no minimum spend.",
];

type Status = "idle" | "running" | "done" | "error";

export function Planner() {
  const [request, setRequest] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [steps, setSteps] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    const text = request.trim();
    if (!text) {
      setError("Describe the event you want to plan.");
      setStatus("error");
      return;
    }

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const timeout = setTimeout(() => abort.abort(), 60_000);

    setStatus("running");
    setSteps([]);
    setPlan(null);
    setIsSample(false);
    setError(null);

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The planner couldn't be reached.");
      }

      // Newline-delimited JSON: progress steps, then a plan or an error.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "step") setSteps((s) => [...s, msg.message]);
          else if (msg.type === "plan") {
            setPlan(msg.plan);
            setStatus("done");
            finished = true;
          } else if (msg.type === "error") {
            throw new Error(msg.message);
          }
        }
      }
      if (!finished) throw new Error("The planner stopped before finishing. Please try again.");
    } catch (err) {
      if (abort.signal.aborted && abortRef.current !== abort) return; // replaced by a newer request
      setError(
        abort.signal.aborted
          ? "The planner took too long. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong.",
      );
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  function showSample() {
    setRequest(SAMPLE_REQUEST);
    setSteps([]);
    setError(null);
    setPlan(samplePlan());
    setIsSample(true);
    setStatus("done");
  }

  const running = status === "running";

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={run} className="flex flex-col gap-3">
        <label htmlFor="plan-request" className="text-sm font-medium text-neutral-900">
          What are you planning?
        </label>
        <textarea
          id="plan-request"
          rows={3}
          maxLength={1000}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="e.g. A language exchange for 8 people on Thursday evening, somewhere lively, under $25 each."
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <div className="flex flex-wrap gap-2" aria-label="Example requests">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setRequest(ex)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-left text-xs text-neutral-700 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              {ex}
            </button>
          ))}
        </div>
        <div>
          <Button type="submit" disabled={running}>
            {running ? "Planning…" : "Plan my event"}
          </Button>
        </div>
      </form>

      {(running || steps.length > 0) && (
        <section aria-label="Progress" aria-live="polite" className="rounded-xl border border-neutral-200 bg-white p-4">
          <ol className="flex flex-col gap-1.5 text-sm">
            {steps.map((s, i) => {
              const current = running && i === steps.length - 1;
              return (
                <li key={i} className={current ? "text-neutral-900" : "text-neutral-500"}>
                  <span aria-hidden className="mr-2 inline-block w-4">
                    {current ? "…" : "✓"}
                  </span>
                  {s}
                </li>
              );
            })}
            {running && steps.length === 0 && <li className="text-neutral-500">Starting…</li>}
          </ol>
        </section>
      )}

      {status === "error" && error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={showSample} className="mt-2 font-medium underline">
            Show an example result instead
          </button>
        </div>
      )}

      {plan && <PlanResult plan={plan} isSample={isSample} />}
    </div>
  );
}

function PlanResult({ plan, isSample }: { plan: Plan; isSample: boolean }) {
  return (
    <section aria-label="Your plan" className="flex flex-col gap-4">
      <AiTag>drafted this event and picked these spaces. You review everything before booking.</AiTag>
      {isSample && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Example only: these spaces are illustrative and can&apos;t be booked.
        </p>
      )}

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Drafted event</p>
        <p className="mt-1 text-lg font-semibold">{plan.event.title}</p>
        <p className="mt-1 text-sm text-neutral-700">{plan.event.description}</p>
        <p className="mt-2 text-sm text-neutral-600">For {plan.event.spots} guests · you can edit everything before publishing</p>
      </div>

      {plan.note && !isSample && <p className="text-sm text-neutral-700">{plan.note}</p>}

      {plan.recommendations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="font-medium">No matching spaces right now</p>
          <p className="mb-4 mt-1 text-sm text-neutral-600">Try different dates or a smaller group, or browse everything available.</p>
          <ButtonLink href="/spaces" variant="secondary">
            Browse spaces
          </ButtonLink>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {plan.recommendations.map((r, i) => (
            <li key={r.space.id}>
              <RecommendationCard rec={r} best={i === 0} isSample={isSample} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RecommendationCard({ rec, best, isSample }: { rec: PlanRecommendation; best: boolean; isSample: boolean }) {
  const start = new Date(rec.space.startsAt);
  const end = new Date(rec.space.endsAt);
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {rec.space.restaurantName} · {rec.space.label}
          </p>
          <p className="text-sm text-neutral-600">{rec.space.location}</p>
        </div>
        {best && (
          <span className="shrink-0 rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">Best match</span>
        )}
      </div>
      <p className="mt-2 text-sm">
        {formatDate(start)} · {formatTimeRange(start, end)} · up to {rec.space.capacity} seats
      </p>
      {(rec.space.description || rec.space.priceInfo) && (
        <p className="mt-1 text-sm text-neutral-600">
          {[rec.space.description, rec.space.priceInfo].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="mt-3 text-sm text-neutral-800">{rec.reason}</p>
      <div className="mt-4">
        <ButtonLink href={rec.createEventUrl} variant={best ? "primary" : "secondary"}>
          {isSample ? "Browse real spaces" : `Use this space for ${rec.spots} guests`}
        </ButtonLink>
      </div>
    </article>
  );
}
