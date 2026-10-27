import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HouseRules } from "@/components/house-rules";
import { ButtonLink } from "@/components/ui/button";
import { getHouseRulesForSpace, getSpace } from "@/lib/spaces";
import { formatDate, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Space details · ALongTable" };

export default function SpacePage({ params }: PageProps<"/spaces/[id]">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Link href="/spaces" className="text-sm text-neutral-600 hover:text-neutral-900">
        ← All spaces
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-neutral-500">Loading space…</p>}>
        {params.then(({ id }) => (
          <SpaceDetails id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function SpaceDetails({ id }: { id: string }) {
  const [space, houseRules] = await Promise.all([getSpace(id), getHouseRulesForSpace(id)]);
  if (!space) notFound();

  // Reading the clock is request-time work under Cache Components.
  await connection();
  const start = new Date(space.startsAt);
  const end = new Date(space.endsAt);
  const bookable = space.status === "available" && start > new Date();

  return (
    <article className="mt-4">
      <h1 className="text-2xl font-semibold">
        {space.restaurantName} · {space.label}
      </h1>
      <p className="mt-1 text-neutral-600">{space.location}</p>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-neutral-500">Date</dt>
        <dd>{formatDate(start)}</dd>
        <dt className="text-neutral-500">Time</dt>
        <dd>{formatTimeRange(start, end)} (Seattle time)</dd>
        <dt className="text-neutral-500">Capacity</dt>
        <dd>{space.capacity} seats</dd>
        {space.priceInfo && (
          <>
            <dt className="text-neutral-500">Pricing</dt>
            <dd>{space.priceInfo}</dd>
          </>
        )}
      </dl>

      {space.description && <p className="mt-6 whitespace-pre-line text-sm">{space.description}</p>}

      <HouseRules rules={houseRules} className="mt-6" />

      <div className="mt-8">
        {bookable ? (
          <ButtonLink href={`/spaces/${space.id}/create-event`}>Book this space &amp; create event</ButtonLink>
        ) : (
          <p role="status" className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
            {space.status === "booked" ? "This space has already been booked." : "This space is no longer available."}{" "}
            <Link href="/spaces" className="font-medium underline">
              Browse other spaces
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}
