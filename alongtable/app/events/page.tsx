import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsMap } from "@/components/events-map";
import { ButtonLink } from "@/components/ui/button";
import { listUpcomingEvents } from "@/lib/events";

export const metadata: Metadata = { title: "Find events · ALongTable" };

export default function EventsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Find events</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Upcoming gatherings at local restaurants. Reserve a seat and meet new people.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading events…</p>}>
        <Events />
      </Suspense>
    </main>
  );
}

async function Events() {
  const events = await listUpcomingEvents();

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center">
        <p className="font-medium">No events yet</p>
        <p className="mb-4 mt-1 text-sm text-neutral-600">Book a restaurant space and be the first to host.</p>
        <ButtonLink href="/spaces">Host an event</ButtonLink>
      </div>
    );
  }

  return <EventsMap events={events} />;
}
