"use client";

import { forwardRef } from "react";
import type { Opportunity } from "@/lib/contracts";
import { BOOKING_HOST, bookingUrlFor } from "@/lib/booking";
import { IconCalendar, IconExternal } from "./Icons";

/** Primary detail action. Scrolls to the booking card, where the details live. */
export function BookCallButton({ onClick }: { onClick(): void }) {
  return (
    <button className="btn btn-book" onClick={onClick}>
      <IconCalendar size={16} />Book a call with {BOOKING_HOST}
    </button>
  );
}

export const BookCallCard = forwardRef<HTMLElement, { o: Opportunity; tierLabel: string }>(function BookCallCard({ o, tierLabel }, ref) {
  const url = bookingUrlFor(o);
  return (
    <section className="book-card" ref={ref} aria-labelledby="book-title">
      <div className="book-icon" aria-hidden="true"><IconCalendar size={20} /></div>
      <div className="book-body">
        <h3 className="book-title" id="book-title">Want to go after this one?</h3>
        <p className="book-text">
          This job is a {tierLabel.toLowerCase()} for your business. Book a call with {BOOKING_HOST} to talk through the requirements and plan your bid.
        </p>
        {url ? (
          <a className="btn btn-book" href={url} target="_blank" rel="noopener noreferrer">
            <IconCalendar size={16} />Book a call with {BOOKING_HOST}<IconExternal size={14} />
          </a>
        ) : (
          <>
            <button className="btn btn-book" disabled aria-describedby="book-soon"><IconCalendar size={16} />Book a call with {BOOKING_HOST}</button>
            <p className="book-note" id="book-soon">Scheduling opens soon. {BOOKING_HOST}'s booking link hasn't been added yet.</p>
          </>
        )}
        {url && <p className="book-note">Opens {BOOKING_HOST}'s scheduling page in a new tab. Pick a time there.</p>}
      </div>
    </section>
  );
});
