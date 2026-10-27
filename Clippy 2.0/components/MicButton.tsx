"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const MAX_SECONDS = 60; // caps ElevenLabs cost per recording
const FALLBACK_ERROR = "Clippy could not turn your voice into text. Please try again or type your list.";

type State = { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "transcribing" } | { kind: "error"; message: string };

const noSubscribe = () => () => {};
const canRecord = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

// Tap to record, tap again to stop; the words go through /api/transcribe (ElevenLabs Scribe) into the list.
export default function MicButton({ onText, disabled = false }: { onText: (text: string) => void; disabled?: boolean }) {
  const supported = useSyncExternalStore(noSubscribe, canRecord, () => false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Let go of the mic if the page goes away mid-recording.
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  if (!supported) return null;

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setState({ kind: "error", message: "Allow microphone access to speak your list." });
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      transcribe(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    };
    recorder.current = rec;
    rec.start();
    setState({ kind: "recording", seconds: 0 });
    let seconds = 0;
    timer.current = setInterval(() => {
      seconds += 1;
      if (seconds >= MAX_SECONDS) stop();
      else setState({ kind: "recording", seconds });
    }, 1000);
  }

  async function transcribe(audio: Blob) {
    setState({ kind: "transcribing" });
    const form = new FormData();
    const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", audio, `voice.${ext}`);
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.text !== "string") {
        return setState({ kind: "error", message: body?.error || FALLBACK_ERROR });
      }
      onText(body.text);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error", message: FALLBACK_ERROR });
    }
  }

  const recording = state.kind === "recording";
  const busy = state.kind === "transcribing";

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        data-testid="mic-btn"
        aria-label={recording ? "Stop recording" : "Speak your list"}
        aria-pressed={recording}
        onClick={recording ? stop : start}
        disabled={disabled || busy}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 disabled:opacity-60 ${
          recording ? "bg-rose-50 text-rose-700 ring-rose-300" : "bg-white text-emerald-800 ring-emerald-300 hover:bg-emerald-50"
        }`}
      >
        {recording ? (
          <>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" aria-hidden />
            Stop · 0:{String(state.seconds).padStart(2, "0")}
          </>
        ) : busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" aria-hidden />
            Listening…
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="7" y="2.5" width="6" height="10" rx="3" />
              <path d="M4.5 9.5a5.5 5.5 0 0011 0M10 15v2.5" strokeLinecap="round" />
            </svg>
            Speak your list
          </>
        )}
      </button>
      {state.kind === "error" && (
        <span data-testid="mic-error" role="alert" className="mt-1 max-w-64 text-right text-xs text-rose-600">
          {state.message}
        </span>
      )}
    </span>
  );
}
