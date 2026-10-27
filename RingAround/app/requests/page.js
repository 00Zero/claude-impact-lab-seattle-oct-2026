import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/auth";
import { isAgentConfigured, listOwnedSessions } from "@/lib/agent";
import { hasRequests } from "@/lib/db";
import { AppHeader } from "@/components/app-header";
import { AccountNavigation, AccountNavigationFallback } from "@/components/auth-navigation";
import { Arrow } from "@/components/icons";
import { CallCount, RequestSummaryCard } from "@/components/request-board";
import { StatusPill, describeStatus, formatStarted } from "./status";
import AutoRefresh from "./auto-refresh";

export const metadata = {
  title: "Your requests — RingAround",
  robots: { index: false, follow: false },
};

async function RequestList() {
  // Per request: the list depends on who's signed in.
  await connection();
  const authSession = await getSession();
  if (!authSession?.user?.id) redirect("/sign-in?next=/requests");
  // Nothing to show yet: start them on their first request instead.
  if (!(await hasRequests(authSession.user.id))) redirect("/requests/new");

  const { sessions, truncated } = isAgentConfigured()
    ? await listOwnedSessions(authSession.user.id)
    : { sessions: [], truncated: false };
  const rows = sessions.map(({ request, session, idleReason }) => ({ request, session, status: describeStatus(session, idleReason) }));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      {rows.some((row) => row.status.live) && <AutoRefresh seconds={10} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Requests</p>
          <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight">Your requests</h1>
        </div>
        <Link
          href="/requests/new"
          className="group inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 font-medium text-white transition hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
        >
          New request <Arrow />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-[28px] border border-line bg-surface/60 p-8">
          <p className="font-medium">No requests yet.</p>
          <p className="mt-2 text-sm text-ink-soft">Requests you send to the agent show up here with their progress.</p>
        </div>
      ) : (
        <ul className="mt-10 space-y-5">
          {rows.map(({ request, session, status }) => (
            <li key={session.id}>
              <Link
                href={`/requests/${session.id}`}
                aria-label={`${request.title}: ${status.label}`}
                className="block rounded-[28px] border border-line bg-surface/80 p-2 transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
              >
                <RequestSummaryCard
                  label={`Started ${formatStarted(request.createdAt)}`}
                  live={status.live}
                  statusLabel={status.label}
                  title={request.title}
                  titleAs="h2"
                  where={request.where}
                  when={request.when}
                  budget={request.budget}
                />
                <div className="mt-2">
                  <CallCount placed={request.callsPlaced} cap={request.callCap}>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill status={status} />
                      {request.quotes > 0 && (
                        <span className="font-medium text-sage">
                          {request.quotes} {request.quotes === 1 ? "quote" : "quotes"}
                        </span>
                      )}
                    </span>
                  </CallCount>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="mt-6 text-sm text-ink-soft">Showing your most recent requests. Older ones may not be listed.</p>
      )}
    </div>
  );
}

export default function RequestsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader label="Your requests">
        <Suspense fallback={<AccountNavigationFallback />}>
          <AccountNavigation />
        </Suspense>
      </AppHeader>
      <main className="flex-1">
        <Suspense fallback={<p role="status" className="px-6 py-16 text-center text-ink-soft">Loading your requests…</p>}>
          <RequestList />
        </Suspense>
      </main>
    </div>
  );
}
