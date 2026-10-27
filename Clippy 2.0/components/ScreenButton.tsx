"use client";

import { useState, useSyncExternalStore } from "react";

const MAX_WIDTH = 2000; // keeps the JPEG well under the 5 MB upload limit

const noSubscribe = () => () => {};
const canCapture = () => !!navigator.mediaDevices?.getDisplayMedia;

// Share a tab or window (say, the supplier's order page), grab one frame, and hand it over as an invoice photo.
export default function ScreenButton({ onFile, disabled = false }: { onFile: (f: File) => void; disabled?: boolean }) {
  const supported = useSyncExternalStore(noSubscribe, canCapture, () => false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supported) return null;

  async function capture() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      return; // the person closed the picker
    }
    setBusy(true);
    try {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Give the shared tab a moment to paint its first full frame.
      await new Promise((r) => setTimeout(r, 300));
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("no frame");
      onFile(new File([blob], `screen-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch {
      setError("Clippy could not capture your screen. Please try again or upload a screenshot.");
    } finally {
      stream.getTracks().forEach((t) => t.stop());
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-center">
      <button
        type="button"
        data-testid="screen-btn"
        onClick={capture}
        disabled={disabled || busy}
        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-50 disabled:opacity-60"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
          <path d="M7 17h6M10 13.5V17" strokeLinecap="round" />
        </svg>
        {busy ? "Capturing…" : "Capture your screen"}
      </button>
      {error && (
        <span role="alert" className="mt-1 max-w-64 text-center text-xs text-rose-600">
          {error}
        </span>
      )}
    </span>
  );
}
