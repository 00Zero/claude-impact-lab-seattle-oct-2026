import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth";
import { canStartCalls, getOwnedSession, isAgentConfigured, listActivity } from "@/lib/agent";
import { getRequest, listProviderCalls } from "@/lib/db";
import { AppHeader } from "@/components/app-header";
import { AccountNavigation, AccountNavigationFallback } from "@/components/auth-navigation";
import { CallCount, CallList, RequestSummaryCard } from "@/components/request-board";
import { describeStatus, formatStarted } from "../status";
import AutoRefresh from "../auto-refresh";
import MessageBox from "./message-box";

export const metadata = {
  title: "Your request — RingAround",
  robots: { index: false, follow: false },
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Why the requester can't message the agent right now, or null if they can.
function messageBlockedReason(session, reason) {
  if (session.status === "terminated") return "This request has finished.";
  if (reason === "budget_reached") return "Paused at its spending limit, so the agent can’t take messages.";
  if (reason === "requires_action") return "The agent is waiting on a tool approval and can’t take messages yet.";
  return null;
}

async function RequestStatus({ params }) {
  const { sessionId } = await params;
  const authSession = await getSession();
  if (!authSession?.user?.id) redirect(`/sign-in?next=${encodeURIComponent(`/requests/${sessionId}`)}`);
  if (!isAgentConfigured()) notFound();

  const session = await getOwnedSession(sessionId, authSession.user.id);
  if (!session) notFound();
  const [{ activity, idleReason }, request, calls] = await Promise.all([
    listActivity(session.id),
    getRequest(authSession.user.id, session.id),
    listProviderCalls(session.id),
  ]);
  const status = describeStatus(session, idleReason);
  // The agent finished its turn: it's either done or asking the requester something.
  const waitingOnYou = session.status === "idle" && idleReason === "end_turn";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      {status.live && <AutoRefresh seconds={5} />}
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Request</p>
      <p className="mt-2 text-sm text-ink-soft">Started {formatStarted(session.created_at)}</p>

      <div className="mt-6 rounded-[28px] border border-line bg-surface/80 p-2 shadow-[0_30px_80px_-30px_rgb(21_20_15/0.35)]">
        <RequestSummaryCard
          label="Your request"
          live={status.live}
          statusLabel={status.label}
          title={request?.title ?? session.title ?? "Your quote request"}
          titleAs="h1"
          where={request?.where}
          when={request?.when}
          budget={request?.budget}
        />
        {calls.length > 0 ? (
          <CallList calls={calls} />
        ) : (
          <p className="px-4 py-6 text-sm text-ink-soft">
            {status.live ? "The agent is finding businesses to call. They’ll appear here as it goes." : "No businesses were contacted for this request."}
          </p>
        )}
        {request && (
          <CallCount placed={request.callsPlaced} cap={request.callCap}>
            {request.quotes > 0 && (
              <span className="font-medium text-sage">
                {request.quotes} {request.quotes === 1 ? "quote" : "quotes"} so far
              </span>
            )}
          </CallCount>
        )}
      </div>

      <section aria-labelledby="conversation-heading" className="mt-10">
        <h2 id="conversation-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">
          Updates from the agent
        </h2>
        {activity.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-line bg-surface/60 p-5 text-ink-soft">
            The agent is getting started. Its updates and questions appear here.
          </p>
        ) : (
          <ol className="mt-4 space-y-3" aria-live="polite">
            {activity.map((item) => (
              <li
                key={item.id}
                className={`rounded-2xl border p-5 ${item.kind === "user" ? "ml-8 border-signal/20 bg-signal-soft/40" : "mr-8 border-line bg-surface/60"}`}
              >
                <p className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                  <span>{item.kind === "user" ? "You" : item.kind === "error" ? "Problem" : "Agent"}</span>
                  {item.at ? <time dateTime={item.at}>{formatTime(item.at)}</time> : <span>Queued</span>}
                </p>
                <p className={`mt-2 whitespace-pre-wrap break-words ${item.kind === "error" ? "text-sm text-signal" : ""}`} role={item.kind === "error" ? "alert" : undefined}>
                  {item.text}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="message-heading" className="mt-6">
        <h2 id="message-heading" className="sr-only">
          Message the agent
        </h2>
        {waitingOnYou && (
          <p className="mb-3 text-sm font-medium text-amber">The agent has paused. If it asked you something above, reply here.</p>
        )}
        <MessageBox
          sessionId={session.id}
          blockedReason={
            canStartCalls(authSession.user.email)
              ? messageBlockedReason(session, idleReason)
              : "Calling isn’t available for your account."
          }
          waitingOnYou={waitingOnYou}
        />
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/requests" className="font-medium underline-offset-4 hover:underline">
            All your requests
          </Link>
          <Link href="/requests/new" className="font-medium underline-offset-4 hover:underline">
            Start another request
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RequestPage({ params }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader label="Your request">
        <Suspense fallback={<AccountNavigationFallback />}>
          <AccountNavigation />
        </Suspense>
      </AppHeader>
      <main className="flex-1">
        <Suspense fallback={<p role="status" className="px-6 py-16 text-center text-ink-soft">Loading your request…</p>}>
          <RequestStatus params={params} />
        </Suspense>
      </main>
    </div>
  );
}
