"use client";

import { EventCard } from "@/components/event-card";
import { MapExplorer } from "@/components/map-explorer";
import type { Event } from "@/lib/events";

/** /events: upcoming events on a map, listed on the right. */
export function EventsMap({ events }: { events: Event[] }) {
  return (
    <MapExplorer
      items={events}
      renderItem={(e) => <EventCard event={e} />}
      noun={["upcoming event", "upcoming events"]}
      mapLabel="Map of upcoming events"
      desktopHeight="lg:h-[calc(100dvh-11rem)]" // below the header and page title
    />
  );
}
