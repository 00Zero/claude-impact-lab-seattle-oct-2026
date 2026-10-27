import Link from "next/link";
import { connection } from "next/server";
import { getSession } from "@/auth";
import { signOutOfAccount } from "@/app/sign-in/actions";
import { SignOutButton } from "./sign-out-button";
import { Arrow } from "./icons";

const buttonClass = "inline-flex min-h-9 min-w-20 items-center justify-center whitespace-nowrap rounded-full border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal";
const requestButtonClass = "group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-signal hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal";

// Read per request: without connection() the nav is prerendered once at build
// time, so signed-in visitors would still see "Get started".
async function isSignedIn() {
  await connection();
  return Boolean((await getSession())?.user);
}

// Short label on phones, where the header has the least room.
function RequestsLink({ display = "inline-flex" }) {
  return (
    <Link href="/requests" className={`${buttonClass.replace("inline-flex ", "")} ${display}`}>
      <span className="sm:hidden">Requests</span>
      <span className="hidden sm:inline">Your requests</span>
    </Link>
  );
}

function AccountAction({ signedIn, requestsLinkDisplay }) {
  return signedIn ? (
    <>
      <RequestsLink display={requestsLinkDisplay} />
      <form action={signOutOfAccount}>
        <SignOutButton className={buttonClass} />
      </form>
    </>
  ) : (
    <Link href="/sign-in" className={buttonClass}>Sign in</Link>
  );
}

export function AccountNavigationFallback() {
  return <button type="button" disabled aria-label="Checking your session" aria-busy="true" className={`${buttonClass} opacity-50`}>…</button>;
}

export function AuthNavigationFallback() {
  return (
    <>
      <button type="button" disabled aria-label="Loading request button" aria-busy="true" className={`${requestButtonClass} min-w-36 opacity-50`}>…</button>
      <AccountNavigationFallback />
    </>
  );
}

export async function AuthNavigation() {
  const signedIn = await isSignedIn();

  return (
    <>
      <Link href={signedIn ? "/requests/new" : "/#pricing"} className={requestButtonClass}>
        {signedIn ? "New request" : "Get started"} <Arrow />
      </Link>
      {/* The New request button already crowds a phone-width header. */}
      <AccountAction signedIn={signedIn} requestsLinkDisplay="hidden sm:inline-flex" />
    </>
  );
}

// Sign out for signed-in visitors, Sign in for everyone else.
export async function AccountNavigation() {
  return <AccountAction signedIn={await isSignedIn()} />;
}
