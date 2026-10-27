import Image from "next/image";
import Link from "next/link";
import { CalendarBlank, Storefront, UsersThree } from "@phosphor-icons/react/ssr";
import type { AvailableSpace } from "@/lib/spaces";
import { formatDate, formatTimeRange } from "@/lib/time";

/** A space in the list beside the map: the restaurant's photo, then where and when. */
export function SpaceCard({ space }: { space: AvailableSpace }) {
  const start = new Date(space.startsAt);
  const end = new Date(space.endsAt);

  return (
    <Link
      href={`/spaces/${space.id}`}
      className="group flex gap-4 rounded-card bg-surface p-3 outline-none focus-visible:shadow-[var(--alt-focus)]"
    >
      <div className="relative size-24 shrink-0 overflow-hidden rounded-photo bg-sunken">
        {space.photoUrl ? (
          // Decorative: the restaurant's name is in the text beside it.
          <Image src={space.photoUrl} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <Storefront size={32} aria-hidden="true" className="absolute inset-0 m-auto text-ink-soft" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold group-hover:underline">
          {space.restaurantName} · {space.label}
        </p>
        <p className="alt-secondary truncate">{space.location}</p>
        <p className="alt-meta">
          <CalendarBlank size={20} aria-hidden="true" />
          <span>
            {formatDate(start)} · {formatTimeRange(start, end)}
          </span>
        </p>
        <p className="alt-meta">
          <UsersThree size={20} aria-hidden="true" />
          <span>Up to {space.capacity} guests</span>
        </p>
      </div>
    </Link>
  );
}
