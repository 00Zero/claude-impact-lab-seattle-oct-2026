"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useState } from "react";
import type { Event } from "@/lib/events";
import { seattleDateKey } from "@/lib/time";
import { EventTile } from "./cards";
import { Row } from "./row";

type When = "all" | "today" | "week";

const FILTERS: { value: When; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

/** The upcoming-events row with real Today / This week filters. */
export function EventsRow({ events, todayKey, weekKeys }: { events: Event[]; todayKey: string; weekKeys: string[] }) {
  const [when, setWhen] = useState<When>("all");

  const shown = events.filter((e) => {
    const key = seattleDateKey(new Date(e.startsAt));
    return when === "all" || (when === "today" ? key === todayKey : weekKeys.includes(key));
  });

  const chips = (
    <ToggleGroup
      value={[when]}
      // A single-select group lets you un-press the active chip; keep one chip always on.
      onValueChange={(v) => v.length && setWhen(v[v.length - 1] as When)}
      aria-label="Show events"
      className="flex flex-wrap gap-2"
    >
      {FILTERS.map((f) => (
        <Toggle
          key={f.value}
          value={f.value}
          className="flex min-h-11 cursor-pointer items-center rounded-control bg-sunken px-4 font-semibold text-ink outline-none transition-colors hover:bg-divider focus-visible:shadow-[var(--alt-focus)] data-[pressed]:bg-ink data-[pressed]:text-white data-[pressed]:hover:bg-ink"
        >
          {f.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );

  return (
    <Row title="Upcoming events" href="/events" linkLabel="See all events" toolbar={chips}>
      {shown.length === 0 ? (
        <li data-reveal-item className="alt-card alt-secondary w-full">
          {when === "today"
            ? "No events today. Check this week, or host one yourself."
            : "No events this week yet. Check all upcoming events, or host one yourself."}
        </li>
      ) : (
        shown.map((e, i) => (
          <li key={e.id} data-reveal-item>
            <EventTile event={e} i={i} />
          </li>
        ))
      )}
    </Row>
  );
}
