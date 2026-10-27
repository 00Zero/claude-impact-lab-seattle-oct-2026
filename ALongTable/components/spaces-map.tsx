"use client";

import { useMemo } from "react";
import { MapExplorer } from "@/components/map-explorer";
import { SpaceCard } from "@/components/space-card";
import type { AvailableSpace } from "@/lib/spaces";

/** /spaces (Host an event): available restaurant spaces on a map, listed on the right. */
export function SpacesMap({ spaces }: { spaces: AvailableSpace[] }) {
  // Pins show the restaurant's photo. Memoized so the map isn't rebuilt on every render.
  const items = useMemo(() => spaces.map((s) => ({ ...s, pinPhotoUrl: s.photoUrl })), [spaces]);
  return (
    <MapExplorer
      items={items}
      renderItem={(s) => <SpaceCard space={s} />}
      noun={["available space", "available spaces"]}
      mapLabel="Map of available spaces"
      desktopHeight="lg:h-[calc(100dvh-16.5rem)]" // below the header, title, tabs and intro line
    />
  );
}
