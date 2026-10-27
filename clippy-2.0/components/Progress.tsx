// "Analyzing" screen: live steps from the server while Clippy works.
export default function Progress({ steps, source, isPhoto }: { steps: string[]; source: string; isPhoto: boolean }) {
  const current = steps.at(-1) ?? "Getting started…";
  return (
    <div data-testid="progress" className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-emerald-100 border-t-emerald-700" aria-hidden />
          <h2 className="text-lg font-semibold text-slate-900" aria-live="polite">
            {current}
          </h2>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-[clippy-slide_1.4s_ease-in-out_infinite] rounded-full bg-emerald-600" />
        </div>
        <ol className="mt-5 space-y-2.5">
          {steps.map((s, i) => (
            <Step key={i} text={s} done={i < steps.length - 1} />
          ))}
        </ol>
        <p className="mt-5 text-xs text-slate-500">This usually takes under a minute. Every price Clippy shows has a store link and a date.</p>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isPhoto ? "Source document" : "Your list"}</p>
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z M14 3v5h5M9 13h6M9 17h4" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="min-w-0 whitespace-pre-line break-words text-sm text-slate-700">{source}</p>
        </div>
      </aside>
    </div>
  );
}

function Step({ text, done }: { text: string; done: boolean }) {
  return (
    <li className="flex items-start gap-3 text-[15px]">
      {done ? (
        <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="done">
          <circle cx="10" cy="10" r="9" fill="currentColor" />
          <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span aria-label="in progress" className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      )}
      <span className={done ? "text-slate-600" : "font-medium text-slate-900"}>{text}</span>
    </li>
  );
}
