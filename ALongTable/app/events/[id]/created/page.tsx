import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { getEvent } from "@/lib/events";
import { formatDate, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Event created · ALongTable" };

export default function EventCreatedPage({ params, searchParams }: PageProps<"/events/[id]/created">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        {Promise.all([params, searchParams]).then(([{ id }, query]) => (
          <Content id={id} photoFailed={query.photo === "failed"} />
        ))}
      </Suspense>
    </main>
  );
}

async function Content({ id, photoFailed }: { id: string; photoFailed: boolean }) {
  const event = await getEvent(id);
  if (!event) notFound();

  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold">Your event is live</h1>
      <p className="mt-1 text-sm text-neutral-600">
        The space is booked and others can now find and join your event. No payment was collected.
      </p>

      {photoFailed && (
        <p role="status" className="alt-notice alt-notice--info mt-4 text-left">
          Your event is live, but we couldn&apos;t save the photo. The restaurant can add one from its dashboard.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-left">
        <p className="font-medium">{event.title}</p>
        <p className="mt-2 text-sm">
          {formatDate(start)} · {formatTimeRange(start, end)}
        </p>
        <p className="text-sm text-neutral-600">
          {event.restaurantName} · {event.label} · {event.location}
        </p>
        <p className="mt-2 text-sm">{event.capacity} spots open for others to join</p>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink href={`/events/${event.id}`}>View event page</ButtonLink>
        <ButtonLink href="/events" variant="secondary">
          Browse events
        </ButtonLink>
      </div>
    </div>
  );
}
