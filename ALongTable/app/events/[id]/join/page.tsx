import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getEvent } from "@/lib/events";
import { formatDate, formatTimeRange } from "@/lib/time";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join an event · ALongTable" };

export default function JoinEventPage({ params }: PageProps<"/events/[id]/join">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        {params.then(({ id }) => (
          <Content id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function Content({ id }: { id: string }) {
  const event = await getEvent(id);
  if (!event) notFound();

  // Reading the clock is request-time work under Cache Components.
  await connection();
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const past = start <= new Date();
  const soldOut = event.seatsLeft === 0;

  return (
    <>
      <Link href={`/events/${event.id}`} className="text-sm text-neutral-600 hover:text-neutral-900">
        ← Back to event
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Reserve a seat</h1>

      <section aria-label="Event you're joining" className="mb-6 mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="font-medium">{event.title}</p>
        <p className="mt-2 text-sm">
          {formatDate(start)} · {formatTimeRange(start, end)}
        </p>
        <p className="text-sm text-neutral-600">
          {event.restaurantName} · {event.location}
        </p>
        <p className="mt-2 text-sm">
          {event.seatsLeft} of {event.capacity} spots left
        </p>
      </section>

      {past || soldOut ? (
        <p role="status" className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          {past ? "This event has already happened." : "This event is full. Reservations are closed."}{" "}
          <Link href="/events" className="font-medium underline">
            Find other events
          </Link>
        </p>
      ) : (
        <JoinForm eventId={event.id} />
      )}
    </>
  );
}
