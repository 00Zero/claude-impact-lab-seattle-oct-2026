"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import HelperIcon from "@/components/HelperIcon";
import { supabaseBrowser } from "@/lib/supabase/client";
import { authEnabled } from "@/lib/supabase/config";

export type Mode = "login" | "signup";

export default function LoginForm({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const auth = supabaseBrowser().auth;
    const { data, error } =
      mode === "login"
        ? await auth.signInWithPassword({ email, password })
        : await auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/app` } });
    setBusy(false);
    if (error) return setError(error.message);
    // Sign up with email confirmation on returns no session until the link is clicked.
    if (!data.session) return setNotice("Check your email for a link to confirm your account, then log in.");
    router.replace("/app");
    router.refresh();
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setNotice("");
  }

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="flex items-center gap-2">
        <HelperIcon className="h-10 w-10" />
        <span className="text-2xl font-bold tracking-tight text-emerald-900">Clippy</span>
      </Link>

      <div className="mt-6 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{isLogin ? "Log in" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isLogin ? "Welcome back. Let's find you cheaper supplies." : "Free to start. No card needed."}
        </p>

        {!authEnabled ? (
          <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            Login is not set up yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or{" "}
            <Link href="/app" className="font-semibold underline">
              open Clippy
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
                {error}
              </p>
            )}
            {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">{notice}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              {busy ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
            </button>
          </form>
        )}

        {authEnabled && (
          <p className="mt-4 text-center text-sm text-slate-600">
            {isLogin ? "New to Clippy? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? "signup" : "login")}
              className="font-semibold text-emerald-800 hover:underline"
            >
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
