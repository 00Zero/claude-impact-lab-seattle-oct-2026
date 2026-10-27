"use client";
/* One click: create a session, launch Claude Code behind it, and open the conversation. */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartSession() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/sessions", { method: "POST" });
    const body = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
    if (r.ok && body.id) router.push(`/session/${body.id}`);
    else { setError(body.error ?? "Couldn't start a session."); setBusy(false); }
  }

  return (
    <>
      <button className="btn" type="button" onClick={() => void start()} disabled={busy}>{busy ? "Starting…" : "Start a new session"}</button>
      {error ? <p className="draft-tag">{error}</p> : null}
    </>
  );
}
