"use client";

import { useState } from "react";
import { useExplorer } from "../store";
import { isServiceError } from "@/lib/services/types";

/** Sign-up and sign-in are the only public screens (ACC-01). */
export function AuthScreen({ reauth = false }: { reauth?: boolean }) {
  const { actions, services } = useExplorer();
  const [mode, setMode] = useState<"signin" | "signup">(reauth ? "signin" : "signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionOnly = services.integration.auth === "session_only";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await actions.signIn(mode, username, password);
    } catch (err) {
      setError(isServiceError(err) ? err.message : "Couldn't sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={reauth ? "auth-scrim" : "auth-stage"} role={reauth ? "dialog" : undefined} aria-modal={reauth || undefined} aria-labelledby="auth-title">
      <div className="auth-card">
        {!reauth && (
          <div className="auth-intro">
            <p className="auth-kicker">Washington Contract Explorer</p>
            <h1 id="auth-title" className="auth-title">Find public work across Washington that fits your business.</h1>
            <p className="auth-lede">See open city, county, port, and utility solicitations on one map, check how each one fits your crew, and contact the agency directly.</p>
          </div>
        )}
        {reauth && (
          <div className="auth-intro">
            <h2 id="auth-title" className="auth-title is-small">Your session ended</h2>
            <p className="auth-lede">Sign in again to keep working. Your map, filters, and selection are still here.</p>
          </div>
        )}
        <form onSubmit={submit} className="auth-form" noValidate>
          {!reauth && (
            <div className="segmented" role="tablist" aria-label="Account">
              <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "is-on" : ""} onClick={() => setMode("signup")}>Create account</button>
              <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "is-on" : ""} onClick={() => setMode("signin")}>Sign in</button>
            </div>
          )}
          <label className="field">
            <span className="field-label">Username</span>
            <input id="auth-username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input id="auth-password" className="input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
            {mode === "signup" && <span className="field-hint">At least 10 characters.</span>}
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-filled btn-block" disabled={busy || !username || !password}>
            {busy ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          {sessionOnly && (
            <p className="auth-note">
              Development sign-in. Accounts live only in this browser tab and are cleared when you reload. The real account service from the data team isn't connected yet.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
