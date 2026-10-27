import Image from "next/image";
import Link from "next/link";
import { CalendarBlank, Clock, MapPin, UsersThree } from "@phosphor-icons/react/ssr";
import { SeatRow } from "@/components/ui/seat-row";
import type { Event } from "@/lib/events";
import type { AvailableSpace } from "@/lib/spaces";
import { dateParts, formatDate, formatTimeRange } from "@/lib/time";

// No stock photos (brand/DESIGN.md), so a card's cover is typography on a brand color:
// blush, deep basil, or sunken. White text on deep basil, ink on the others.
const COVERS = [
  { bg: "bg-blush", text: "text-ink" },
  { bg: "bg-basil-deep", text: "text-white" },
  { bg: "bg-sunken", text: "text-ink" },
] as const;

export function cover(i: number) {
  return COVERS[i % COVERS.length];
}

const cardLink =
  "group flex w-[272px] shrink-0 snap-start flex-col gap-3 rounded-card outline-none focus-visible:shadow-[var(--alt-focus)]";

function Cover({
  i,
  top,
  big,
  small,
  photoUrl,
  alt,
}: {
  i: number;
  top: string;
  big: string;
  small: string;
  photoUrl?: string | null;
  alt: string;
}) {
  // With a photo, the same date or guest count sits on top in white. A flat dark tint (no gradient,
  // per brand/DESIGN.md) keeps the white text readable on bright photos.
  if (photoUrl) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-photo bg-sunken text-white">
        <Image
          src={photoUrl}
          alt={alt}
          fill
          sizes="272px"
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-ink/55" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <span className="alt-label-text uppercase tracking-wide">{top}</span>
          <span className="flex items-baseline gap-2">
            <span className="alt-hero">{big}</span>
            <span className="text-[length:var(--alt-text-lead)] font-semibold">{small}</span>
          </span>
        </div>
      </div>
    );
  }
  const c = cover(i);
  return (
    <div className={`${c.bg} ${c.text} flex aspect-[4/3] flex-col justify-between rounded-photo p-4`}>
      <span className="alt-label-text uppercase tracking-wide">{top}</span>
      <span className="flex items-baseline gap-2">
        <span className="alt-hero">{big}</span>
        <span className="text-[length:var(--alt-text-lead)] font-semibold">{small}</span>
      </span>
    </div>
  );
}

/** An upcoming event: the date as the cover, then title, place, time and the seat row. */
export function EventTile({ event, i }: { event: Event; i: number }) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const p = dateParts(start);

  return (
    <Link href={`/events/${event.id}`} className={cardLink}>
      <Cover
        i={i}
        top={p.weekday}
        big={p.day}
        small={p.month}
        photoUrl={event.photoUrl ?? event.restaurantPhotoUrl}
        alt={event.photoUrl ? event.title : `Inside ${event.restaurantName}`}
      />
      <div className="flex flex-col gap-1">
        <h3 className="alt-lead line-clamp-2 font-semibold group-hover:underline">{event.title}</h3>
        <p className="alt-meta">
          <MapPin size={20} aria-hidden="true" />
          <span className="truncate">
            {event.restaurantName} · {event.location}
          </span>
        </p>
        <p className="alt-meta">
          <CalendarBlank size={20} aria-hidden="true" />
          <span>{formatDate(start)}</span>
        </p>
        <p className="alt-meta">
          <Clock size={20} aria-hidden="true" />
          <span className="tabular-nums">{formatTimeRange(start, end)}</span>
        </p>
      </div>
      <SeatRow total={event.capacity} taken={event.capacity - event.seatsLeft} animate />
    </Link>
  );
}

/** A space a guest could turn into an event: capacity is the headline on the cover. */
export function SpaceTile({ space, i }: { space: AvailableSpace; i: number }) {
  const start = new Date(space.startsAt);
  const end = new Date(space.endsAt);

  return (
    <Link href={`/spaces/${space.id}`} className={cardLink}>
      <Cover i={i + 1} top="Up to" big={String(space.capacity)} small="guests" photoUrl={space.photoUrl} alt={`Inside ${space.restaurantName}`} />
      <div className="flex flex-col gap-1">
        <h3 className="alt-lead line-clamp-2 font-semibold group-hover:underline">
          {space.restaurantName} · {space.label}
        </h3>
        <p className="alt-meta">
          <MapPin size={20} aria-hidden="true" />
          <span className="truncate">{space.location}</span>
        </p>
        <p className="alt-meta">
          <CalendarBlank size={20} aria-hidden="true" />
          <span>{formatDate(start)}</span>
        </p>
        <p className="alt-meta">
          <Clock size={20} aria-hidden="true" />
          <span className="tabular-nums">{formatTimeRange(start, end)}</span>
        </p>
        {/* On a photo card the capacity isn't on the cover, so it always appears in the text too. */}
        <p className="alt-meta">
          <UsersThree size={20} aria-hidden="true" />
          <span>Up to {space.capacity} guests</span>
        </p>
        {space.priceInfo && <p className="alt-secondary line-clamp-1">{space.priceInfo}</p>}
      </div>
    </Link>
  );
}
