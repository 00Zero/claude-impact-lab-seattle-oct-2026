import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HouseRules } from "@/components/house-rules";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { getEvent } from "@/lib/events";
import { getHouseRulesForSpace } from "@/lib/spaces";
import { formatDate, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Event details · ALongTable" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Link href="/events" className="text-sm text-neutral-600 hover:text-neutral-900">
        ← All events
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-neutral-500">Loading event…</p>}>
        {params.then(({ id }) => (
          <EventDetails id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function EventDetails({ id }: { id: string }) {
  const event = await getEvent(id);
  if (!event) notFound();
  const houseRules = await getHouseRulesForSpace(event.spaceId);

  // Reading the clock is request-time work under Cache Components.
  await connection();
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const past = start <= new Date();
  const soldOut = event.seatsLeft === 0;

  return (
    <article className="mt-4">
      {(event.photoUrl ?? event.restaurantPhotoUrl) && (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-photo bg-sunken">
          <Image
            src={(event.photoUrl ?? event.restaurantPhotoUrl)!}
            alt={event.photoUrl ? event.title : `Inside ${event.restaurantName}`}
            fill
            priority
            sizes="(min-width: 640px) 576px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <Badge tone={soldOut || past ? "neutral" : "green"}>
          {past ? "Ended" : soldOut ? "Sold out" : `${event.seatsLeft} ${event.seatsLeft === 1 ? "spot" : "spots"} left`}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-neutral-600">Hosted by {event.organizerName}</p>

      {event.description && <p className="mt-6 whitespace-pre-line">{event.description}</p>}

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-neutral-500">Date</dt>
        <dd>{formatDate(start)}</dd>
        <dt className="text-neutral-500">Time</dt>
        <dd>{formatTimeRange(start, end)} (Seattle time)</dd>
        <dt className="text-neutral-500">Where</dt>
        <dd>
          {event.restaurantName} · {event.label}
          <br />
          <span className="text-neutral-600">{event.location}</span>
        </dd>
        <dt className="text-neutral-500">Spots</dt>
        <dd>
          {event.seatsLeft} of {event.capacity} left
        </dd>
        {event.priceInfo && (
          <>
            <dt className="text-neutral-500">Pricing</dt>
            <dd>{event.priceInfo}</dd>
          </>
        )}
      </dl>

      <HouseRules rules={houseRules} className="mt-6" />

      <div className="mt-8">
        {past ? (
          <p role="status" className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
            This event has already happened.{" "}
            <Link href="/events" className="font-medium underline">
              Find upcoming events
            </Link>
          </p>
        ) : soldOut ? (
          <>
            <Button disabled>Sold out</Button>
            <p className="mt-2 text-sm text-neutral-600">All spots are taken. Reservations are closed.</p>
          </>
        ) : (
          <ButtonLink href={`/events/${event.id}/join`}>Join this event</ButtonLink>
        )}
      </div>
    </article>
  );
}
