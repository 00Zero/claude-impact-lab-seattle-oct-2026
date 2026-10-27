import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { getReservation } from "@/lib/events";
import { formatDate, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Booking confirmed · ALongTable" };

export default function ReservationPage({ params }: PageProps<"/reservations/[code]">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        {params.then(({ code }) => (
          <Content code={code} />
        ))}
      </Suspense>
    </main>
  );
}

async function Content({ code }: { code: string }) {
  const found = await getReservation(code);
  if (!found) notFound();
  const { reservation, event } = found;

  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);

  // The code is the only key to this page and there's no login, so show the
  // attendee's name but not their email.
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold">You&apos;re in, {reservation.name}!</h1>
      <p className="mt-1 text-sm text-neutral-600">Your seat is reserved. No payment was collected.</p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Confirmation code</p>
        <p className="mt-1 font-mono text-xl font-semibold tracking-widest">{reservation.confirmationCode.toUpperCase()}</p>

        <p className="mt-4 font-medium">{event.title}</p>
        <p className="mt-1 text-sm">
          {formatDate(start)} · {formatTimeRange(start, end)} (Seattle time)
        </p>
        <p className="text-sm text-neutral-600">
          {event.restaurantName} · {event.label} · {event.location}
        </p>
        {event.priceInfo && <p className="mt-1 text-sm text-neutral-600">{event.priceInfo}</p>}
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink href={`/events/${event.id}`}>View event</ButtonLink>
        <ButtonLink href="/events" variant="secondary">
          Find more events
        </ButtonLink>
      </div>
    </div>
  );
}
