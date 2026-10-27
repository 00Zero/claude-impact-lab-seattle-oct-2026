// Session status -> what the requester sees, shared by the request list and
// the request page. `idle` covers both "finished this turn" and "paused", so
// the reason it last went idle picks the wording.
export function describeStatus(session, reason) {
  if (session.status === "running") return { label: "Working on it", tone: "signal", live: true };
  if (session.status === "rescheduling") return { label: "Reconnecting", tone: "amber", live: true };
  if (session.status === "terminated") return { label: "Stopped", tone: "ink", live: false };
  if (reason === "retries_exhausted" || reason === "refusal") return { label: "Stopped — the agent couldn’t continue", tone: "ink", live: false };
  if (reason === "budget_reached") return { label: "Paused — spending limit reached", tone: "amber", live: false };
  if (reason === "requires_action") return { label: "Waiting on an approval", tone: "amber", live: false };
  return { label: "Done for now", tone: "sage", live: false };
}

const TONES = {
  signal: "bg-signal-soft text-signal",
  amber: "bg-amber-soft text-amber",
  sage: "bg-sage-soft text-sage",
  ink: "bg-ink/10 text-ink-soft",
};

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${TONES[status.tone]}`}>
      {status.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
      {status.label}
    </span>
  );
}

export function formatStarted(iso) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
