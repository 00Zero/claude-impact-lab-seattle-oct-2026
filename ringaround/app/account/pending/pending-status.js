"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Arrow, CheckGlyph } from "@/components/icons";
import { clearBrowserAccount, formatSubmittedDate, hasRequestDraft, readAccount } from "@/lib/account";
import { importBrowserApplication } from "../actions";
import { findPlan } from "@/lib/plans";
import { useBrowserValue } from "@/lib/use-browser-value";

const NEXT_STEPS = [
  { title: "We review your account", body: "Our team checks every new account before it goes live." },
  { title: "You get an approval email", body: "We’ll email you as soon as your account is approved." },
  { title: "Send your first request", body: "Approve the provider shortlist, and the agent starts calling." },
];

export function PendingStatus({ initialApplication }) {
  const inBrowser = useBrowserValue(() => true);
  if (!inBrowser) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6" aria-busy="true">
        <div className="h-72 animate-pulse rounded-[28px] border border-line bg-surface/50" />
      </div>
    );
  }
  return <PendingBody initialApplication={initialApplication} />;
}

function PendingBody({ initialApplication }) {
  const [account, setAccount] = useState(initialApplication);
  const [draftWaiting] = useState(hasRequestDraft);
  // Only when the server has no application: one made in this browser before
  // applications were stored on the server is moved up once, then cleared here.
  const [browserAccount] = useState(() => (initialApplication ? null : readAccount()));
  const [importing, setImporting] = useState(Boolean(browserAccount));

  useEffect(() => {
    if (!browserAccount) return;
    let cancelled = false;
    importBrowserApplication(browserAccount)
      .then((saved) => {
        if (cancelled || !saved) return;
        setAccount(saved);
        clearBrowserAccount();
      })
      .catch(() => {
        // Leave the browser copy to retry next visit.
      })
      .finally(() => !cancelled && setImporting(false));
    return () => {
      cancelled = true;
    };
  }, [browserAccount]);

  if (importing) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6" aria-busy="true">
        <div className="h-72 animate-pulse rounded-[28px] border border-line bg-surface/50" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Account</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">No account in review yet.</h1>
        <p className="mt-4 max-w-xl text-ink-soft">Choose a plan to set up your account. It only takes a few minutes.</p>
        <Link href="/#pricing" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3.5 font-medium text-white transition hover:bg-ink hover:text-paper">
          See plans <Arrow />
        </Link>
      </div>
    );
  }

  const plan = findPlan(account.plan);
  const firstName = account.name.trim().split(/\s+/)[0];
  const submitted = formatSubmittedDate(account.submittedAt);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Account review</p>
      <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
        Your account is <em>in review.</em>
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
        Thanks{firstName ? `, ${firstName}` : ""}. Every new RingAround account is reviewed by our team before it goes live. We’ll email{" "}
        <span className="font-medium text-ink">{account.email}</span> as soon as yours is approved.
      </p>

      <div className="mt-10 overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_30px_80px_-40px_rgb(21_20_15/0.4)]">
        <div className="flex items-center justify-between gap-4 bg-night p-6 text-on-night sm:p-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-night/50">Status</p>
            <p className="mt-2 flex items-center gap-3 font-display text-3xl leading-none">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber" />
              </span>
              In review
            </p>
          </div>
          {account.company && <p className="text-right text-sm text-on-night/60">{account.company}</p>}
        </div>
        <dl className="grid gap-px bg-line sm:grid-cols-3">
          <div className="bg-surface p-6">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">Plan</dt>
            <dd className="mt-2">
              {plan ? (
                <>
                  <span className="font-medium">{plan.name}</span> · ${plan.price}/month
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="bg-surface p-6">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">Payment</dt>
            <dd className="mt-2">Not charged</dd>
          </div>
          <div className="bg-surface p-6">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">Submitted</dt>
            <dd className="mt-2">{submitted ?? "—"}</dd>
          </div>
        </dl>
      </div>

      {draftWaiting && (
        <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-sage/30 bg-sage-soft/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sage text-paper">
              <CheckGlyph className="h-3 w-3" />
            </span>
            Your request draft is saved. You can send it as soon as your account is approved.
          </p>
          <Link href="/requests/new" className="shrink-0 text-sm font-medium text-sage underline-offset-4 hover:underline">
            View request
          </Link>
        </div>
      )}

      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">What happens next</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface/60 p-5">
              <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Link href="/" className="group inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 font-medium transition hover:border-ink">
          <span className="inline-flex rotate-180">
            <Arrow />
          </span>
          Back to home
        </Link>
        <Link href="/requests/new" className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium text-ink-soft transition hover:text-ink">
          {draftWaiting ? "Edit your request" : "Start a request draft"}
        </Link>
      </div>
    </div>
  );
}
