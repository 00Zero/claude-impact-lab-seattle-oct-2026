import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession, isAuthConfigured } from "@/auth";
import { signInWithGoogle, signOutOfAccount } from "./actions";
import { safeNextPath } from "@/lib/safe-path";
import SubmitButton from "./submit-button";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Sign in — RingAround",
  description: "Sign in to RingAround with Google and hand off the phone work.",
  robots: { index: false, follow: false },
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

function errorMessage(error) {
  if (error === "AccessDenied") {
    return "Google sign-in was not approved. Please try again and allow access to your basic profile.";
  }
  if (error === "OAuthAccountNotLinked") {
    return "This email is linked to another sign-in method. Please use your original account.";
  }
  if (error === "Configuration") {
    return "Google sign-in is temporarily unavailable. Please try again later.";
  }
  return "We couldn’t complete your Google sign-in. Please try again.";
}

async function SignInCard({ searchParams }) {
  const { error, next } = await searchParams;
  const nextPath = safeNextPath(next);
  const configured = isAuthConfigured();
  const user = (await getSession())?.user;

  // Signed-in visitors go straight on to where they were headed.
  if (user) redirect(nextPath);

  return <SignInCardContent user={user} configured={configured} error={error} nextPath={nextPath} />;
}

function SignInCardContent({ user, configured, error, nextPath, loading = false }) {
  return (
    <div className="rise rounded-[28px] border border-line bg-surface/90 p-7 shadow-[0_30px_80px_-30px_rgb(21_20_15/0.25)] backdrop-blur sm:p-10" style={{ animationDelay: "0.12s" }} aria-busy={loading}>
      <span className={`mb-7 grid h-12 w-12 place-items-center rounded-2xl ${user ? "bg-sage-soft text-sage" : "bg-signal-soft text-signal"}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {user ? <path d="m5 12 4 4L19 6" /> : <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></>}
        </svg>
      </span>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">{user ? "You’re signed in" : "Welcome to RingAround"}</p>
      <h2 id="sign-in-heading" className="mt-3 font-display text-4xl leading-tight tracking-tight">{user ? "Good to have you here." : "Let’s get you started."}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        {user ? "Your Google account is connected. You’re ready for your next step with RingAround." : "Sign in or create your account with Google. One less password to keep track of."}
      </p>

      {loading ? (
        <div role="status" className="mt-8 flex min-h-14 items-center justify-center rounded-full border border-line bg-paper/70 px-5 py-3.5 text-sm text-ink-soft">
          Checking your session…
        </div>
      ) : user ? (
        <>
          <div className="my-7 rounded-2xl border border-line bg-paper/70 p-4">
            <p className="font-medium">{user.name || "Google account"}</p>
            <p className="mt-1 break-all text-sm text-ink-soft">{user.email}</p>
          </div>
          <form action={signOutOfAccount}>
            <SubmitButton pendingLabel="Signing out…">Sign out</SubmitButton>
          </form>
        </>
      ) : (
        <>
          {(error || !configured) && (
            <p role="alert" className="mt-6 rounded-2xl border border-amber/30 bg-amber-soft px-4 py-3 text-sm leading-relaxed text-ink">
              {errorMessage(!configured ? "Configuration" : error)}
            </p>
          )}
          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="next" value={nextPath ?? ""} />
            <SubmitButton pendingLabel="Connecting to Google…" disabled={!configured}>
              <GoogleIcon />Continue with Google
            </SubmitButton>
          </form>
          <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">Google shares your name, email, and profile photo.<br />Your Google password stays with Google.</p>
        </>
      )}
      <div className="mt-8 flex items-center gap-2 border-t border-line pt-5 text-xs text-ink-soft">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />You stay in control. Every round of calls needs your approval.
      </div>
    </div>
  );
}

export default function SignInPage({ searchParams }) {
  return (
    <div className="grain relative isolate flex flex-1 flex-col overflow-hidden">
      <header className="relative z-10 border-b border-line/60 bg-paper/80">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="RingAround home" className="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
              <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
              <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" opacity="0.65" />
              <circle cx="16" cy="16" r="4" fill="var(--signal)" />
            </svg>
            <span className="text-[1.15rem] font-semibold tracking-tight">RingAround</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" className="rounded-full px-3 py-2 text-sm text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">
              <span aria-hidden="true">← </span>Back to home
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <section className="rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />Your next step
          </p>
          <h1 className="mt-6 max-w-xl font-display text-[3.4rem] leading-[0.98] tracking-tight sm:text-7xl">
            Less phone tag.<br /><em className="text-signal">More time back.</em>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            You have a business to run. Let RingAround help with the calls, the follow-ups, and the quotes.
          </p>
          <ul className="mt-9 space-y-4 text-sm text-ink-soft">
            {["Describe the job once", "Approve who we call", "Compare quotes, side by side"].map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-paper font-mono text-[10px] text-signal">0{index + 1}</span>
                {step}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sign-in-heading" className="relative mx-auto w-full max-w-md">
          <svg viewBox="0 0 600 600" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[155%] max-w-none -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            {[150, 210, 270].map((radius, index) => (
              <circle key={radius} cx="300" cy="300" r={radius} fill="none" stroke="var(--ink)" strokeOpacity="0.09" strokeDasharray={index === 1 ? "2 8" : undefined} />
            ))}
            <circle cx="300" cy="30" r="5" fill="var(--signal)" />
            <circle cx="510" cy="300" r="4" fill="var(--sage)" />
          </svg>
          <Suspense fallback={<SignInCardContent loading />}>
            <SignInCard searchParams={searchParams} />
          </Suspense>
        </section>
      </main>

      <footer className="relative border-t border-line/60 px-4 py-6 text-center text-xs text-ink-soft sm:px-6">© 2026 RingAround · We make the calls. You make the decisions.</footer>
    </div>
  );
}
