"use client";

import { useEffect, useRef, useState } from "react";
import type { BriefPhoto } from "@/lib/brief-types";

export type ViewerNote = { photoId: string; x: number | null; y: number | null; text: string; supports?: string };
export type ViewerAnswerNote = { quote: string; supports?: string };

// Full-screen photo viewer: numbered pins on the photo plus matching notes,
// with an "AI notes / Plain photo" toggle. Pins are approximate; the notes
// are the source of truth. See docs/design/README.md.
export function PhotoViewer({
  photos,
  notes: allNotes,
  answerNotes: allAnswerNotes,
  customerName,
  index,
  onIndexChange,
  onClose,
}: {
  photos: BriefPhoto[];
  notes: ViewerNote[];
  /** Evidence from the customer's answers, shown with the first photo. */
  answerNotes: ViewerAnswerNote[];
  customerName: string;
  /** Photo to show, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showNotes, setShowNotes] = useState(true);

  // A native modal dialog gives us the focus trap, Esc to close, and inert
  // page content for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) {
      setShowNotes(true);
      dialog.showModal();
    } else if (index === null && dialog.open) {
      dialog.close();
    }
  }, [index]);

  const photo = index !== null ? photos[index] : null;
  const notes = photo ? allNotes.filter((n) => n.photoId === photo.id) : [];
  // Answer notes aren't tied to a photo; show them with the first one.
  const answerNotes = index === 0 ? allAnswerNotes : [];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={photo ? `Photo ${index! + 1} of ${photos.length}: ${photo.title}` : "Photo viewer"}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-[#0c0e10] p-0 text-white backdrop:bg-black/80"
    >
      {photo ? (
        <div className="mx-auto flex max-w-6xl flex-col">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#0c0e10] px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-xl px-2 text-base font-bold text-white underline-offset-4 hover:underline"
            >
              ✕ Close
            </button>
            <div role="group" aria-label="Show" className="inline-flex rounded-xl bg-[#25292e] p-1">
              {[
                [true, "AI notes"],
                [false, "Plain photo"],
              ].map(([value, label]) => (
                <button
                  key={label as string}
                  type="button"
                  aria-pressed={showNotes === value}
                  onClick={() => setShowNotes(value as boolean)}
                  className={`min-h-10 rounded-lg px-3 text-sm font-bold ${
                    showNotes === value ? "bg-accent text-accent-ink" : "text-[#c9cdd2]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="hidden text-sm text-[#a9afb6] sm:inline">
              Photo {index! + 1} of {photos.length}
            </span>
          </div>

          <div className="grid gap-5 px-4 pb-6 sm:px-6 lg:grid-cols-[1fr_24rem] lg:items-start">
            <div className="flex justify-center">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- private signed URLs in production */}
                <img
                  src={photo.url}
                  alt={`${customerName}’s photo: ${photo.title}`}
                  width={photo.width}
                  height={photo.height}
                  className="block h-auto max-h-[65dvh] w-auto max-w-full rounded-xl border border-[#333]"
                />
                {showNotes
                  ? notes.map((note, i) =>
                      note.x !== null && note.y !== null ? (
                        <span
                          key={i}
                          aria-hidden
                          className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-ink bg-accent text-[13px] font-extrabold text-accent-ink shadow-md"
                          style={{ left: `${note.x}%`, top: `${note.y}%` }}
                        >
                          {i + 1}
                        </span>
                      ) : null,
                    )
                  : null}
              </div>
            </div>

            <div>
              {showNotes ? (
                <>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#a9afb6]">
                    What the AI saw
                  </h3>
                  {notes.length ? (
                    <ol className="space-y-2">
                      {notes.map((note, i) => (
                        <Note key={i} marker={String(i + 1)} text={note.text} supports={note.supports} />
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-[#a9afb6]">No notes on this photo.</p>
                  )}
                  {answerNotes.length ? (
                    <>
                      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-[#a9afb6]">
                        From {customerName}’s answers
                      </h3>
                      <ul className="space-y-2">
                        {answerNotes.map((note, i) => (
                          <Note key={i} marker="💬" answer text={note.quote} supports={note.supports} />
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {notes.some((n) => n.x !== null) ? (
                    <p className="mt-3 text-sm text-[#a9afb6]">
                      Pin positions are approximate. The notes are the source of truth.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[#a9afb6]">Plain photo, exactly as {customerName} sent it.</p>
              )}

              {photos.length > 1 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-current={i === index ? "true" : undefined}
                      onClick={() => onIndexChange(i)}
                      className={`min-h-12 rounded-xl border-[1.5px] px-4 text-sm font-bold ${
                        i === index
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-[#333] bg-[#1c1f23] text-white"
                      }`}
                    >
                      Photo {i + 1}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

function Note({
  marker,
  text,
  supports,
  answer = false,
}: {
  marker: string;
  text: string;
  supports?: string;
  answer?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-[#1c1f23] p-3 text-[15px]">
      <span
        aria-hidden
        className={`grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-extrabold ${
          answer ? "bg-[#3a3f45] text-white" : "bg-accent text-accent-ink"
        }`}
      >
        {marker}
      </span>
      <div>
        {text}
        {supports ? <small className="mt-1 block text-sm text-[#a9afb6]">{supports}</small> : null}
      </div>
    </li>
  );
}
