import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/lib/events";
import { formatDate, formatTimeRange } from "@/lib/time";

export function EventCard({ event }: { event: Event }) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const soldOut = event.seatsLeft === 0;
  const photoUrl = event.photoUrl ?? event.restaurantPhotoUrl;

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
    >
      <div className="flex gap-4">
        {photoUrl && (
          <div className="relative size-20 shrink-0 overflow-hidden rounded-photo bg-sunken">
            <Image
              src={photoUrl}
              alt={event.photoUrl ? event.title : `Inside ${event.restaurantName}`}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{event.title}</p>
            <Badge tone={soldOut ? "neutral" : "green"}>
              {soldOut ? "Sold out" : `${event.seatsLeft} ${event.seatsLeft === 1 ? "spot" : "spots"} left`}
            </Badge>
          </div>
          {event.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{event.description}</p>}
          <p className="mt-2 text-sm">
            {formatDate(start)} · {formatTimeRange(start, end)}
          </p>
          <p className="text-sm text-neutral-600">
            {event.restaurantName} · {event.location}
          </p>
        </div>
      </div>
    </Link>
  );
}
