"use client";

import { useState } from "react";
import type { BriefPhoto } from "@/lib/brief-types";
import { PhotoViewer, type ViewerAnswerNote, type ViewerNote } from "./photo-viewer";

// Photo thumbnails with AI-note counts; tapping one opens the full-screen
// viewer with that photo's notes.
export function BriefPhotos({
  photos,
  notes,
  answerNotes,
  customerName,
}: {
  photos: BriefPhoto[];
  notes: ViewerNote[];
  answerNotes: ViewerAnswerNote[];
  customerName: string;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <section id="brief-photos" aria-labelledby="brief-photos-heading">
      <h3 id="brief-photos-heading" className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
        Photos · tap to see the AI’s notes
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p, i) => {
          const count = notes.filter((n) => n.photoId === p.id).length;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewing(i)}
              className="relative overflow-hidden rounded-xl border border-line bg-chip text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img src={p.url} alt={p.title} className="aspect-[4/3] w-full object-cover" />
              {count ? (
                <span className="absolute bottom-2 left-2 rounded-md bg-accent px-2 py-0.5 text-xs font-extrabold text-accent-ink">
                  {count} AI note{count === 1 ? "" : "s"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <PhotoViewer
        photos={photos}
        notes={notes}
        answerNotes={answerNotes}
        customerName={customerName}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </section>
  );
}
