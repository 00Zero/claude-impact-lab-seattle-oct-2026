import { CheckGlyph, PhoneGlyph } from "@/components/icons";

// The request board: a request's summary over the businesses being called.
// The homepage shows it with sample data; request pages show the real thing.

const CALL_STATUS = {
  quoted: ["Quote", "bg-sage-soft text-sage"],
  calling: ["Calling", "bg-signal-soft text-signal"],
  retry: ["Retry", "bg-amber-soft text-amber"],
  declined: ["Declined", "bg-paper-2 text-ink-soft"],
  queued: ["Queued", "bg-paper-2 text-ink-soft"],
};

function CallStatusPill({ status }) {
  const [label, cls] = CALL_STATUS[status] ?? CALL_STATUS.queued;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function CallIcon({ status }) {
  if (status === "calling") {
    return (
      <span className="ring-pulse grid h-9 w-9 shrink-0 place-items-center rounded-full bg-signal text-white">
        <PhoneGlyph />
      </span>
    );
  }
  const tone =
    status === "quoted"
      ? "bg-sage text-paper"
      : status === "retry"
        ? "bg-amber-soft text-amber"
        : "bg-paper-2 text-ink-soft";
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}>
      {status === "quoted" ? <CheckGlyph /> : <PhoneGlyph />}
    </span>
  );
}

export function RequestSummaryCard({ label, live, statusLabel, title, where, when, budget, titleAs: Title = "p" }) {
  return (
    <div className="rounded-[22px] bg-night p-5 text-on-night">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-night/50">{label}</span>
        {live ? (
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Live
          </span>
        ) : (
          statusLabel && <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-night/50">{statusLabel}</span>
        )}
      </div>
      <Title className="mt-3 break-words font-display text-2xl leading-tight">{title}</Title>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-on-night/45">Where</dt>
          <dd className="mt-0.5 break-words">{where || "—"}</dd>
        </div>
        <div>
          <dt className="text-on-night/45">When</dt>
          <dd className="mt-0.5">{when || "—"}</dd>
        </div>
        <div>
          <dt className="text-on-night/45">Budget</dt>
          <dd className="mt-0.5">{budget || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function CallList({ calls }) {
  return (
    <ul className="divide-y divide-line/70 px-3 py-1">
      {calls.map((call) => (
        <li key={call.id ?? call.business} className="flex items-center gap-3 py-3">
          <CallIcon status={call.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{call.business}</p>
            {call.detail && (
              <p className="truncate text-xs text-ink-soft">
                {call.status === "calling" ? (
                  <>
                    {call.detail}
                    <span className="dots ml-0.5" aria-hidden="true">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  </>
                ) : (
                  call.detail
                )}
              </p>
            )}
          </div>
          <CallStatusPill status={call.status} />
        </li>
      ))}
    </ul>
  );
}

export function CallCount({ placed, cap, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-paper-2/70 px-4 py-3 text-xs">
      <span>{children}</span>
      <span className="text-ink-soft">
        <b className="font-semibold text-ink">
          {placed} of {cap}
        </b>{" "}
        calls placed · cap {cap}
      </span>
    </div>
  );
}
