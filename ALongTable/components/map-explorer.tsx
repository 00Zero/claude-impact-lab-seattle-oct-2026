"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";

// A map (one pin per restaurant) with a list of items beside it on the right (below it on
// phones), used by /events and /spaces. Tapping a pin narrows the list to that restaurant;
// hovering a list item highlights its pin. Items without a pin are still listed.
// Tiles: OpenFreeMap (free, no key; OpenStreetMap data).

/** What the map needs from each item; the wrapper renders the card. */
export type MapItem = {
  id: string;
  restaurantName: string;
  location: string;
  lat?: number | null;
  lng?: number | null;
  /** The restaurant's photo. When set, its pin shows the photo instead of a number. */
  pinPhotoUrl?: string | null;
};

type Place = { key: string; name: string; location: string; lat: number; lng: number; count: number; label: string; photo: string | null };

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const SEATTLE: [number, number] = [-122.335, 47.608];

// Each pin is a plain wrapper that MapLibre positions with an inline transform, holding the
// visible button. Hover/selection styles (including scale) go on the button only: scaling or
// transitioning the wrapper would scale MapLibre's translate too and throw the pin off its spot.
const pinClass =
  "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-basil px-2 text-sm font-semibold text-white shadow-md outline-none transition-transform focus-visible:shadow-[var(--alt-focus)] data-[selected=true]:bg-ink data-[hovered=true]:scale-125";

// A pin with the restaurant's photo: a round photo with a white edge, ringed in ink when selected. A count badge
// only appears when the restaurant has more than one item.
const photoPinClass =
  "relative size-11 cursor-pointer rounded-full border-2 border-white bg-sunken bg-cover bg-center shadow-md outline-none transition-transform focus-visible:shadow-[var(--alt-focus)] data-[selected=true]:ring-4 data-[selected=true]:ring-ink data-[hovered=true]:scale-125";
const badgeClass =
  "absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-basil px-1 text-sm font-semibold text-white";

// The photo is a CSS background, so it can't use next/image. This asks Next's image optimizer for a small copy
// (a full-size photo for a 44px pin would be wasteful).
const pinImageUrl = (url: string) => `/_next/image?url=${encodeURIComponent(url)}&w=96&q=75`;

type Pin = { wrapper: HTMLDivElement; button: HTMLButtonElement };

const placeKey = (e: MapItem) =>
  e.lat != null && e.lng != null ? `${e.restaurantName}|${e.lat.toFixed(5)}|${e.lng.toFixed(5)}` : null;

export function MapExplorer<T extends MapItem>({
  items: events,
  renderItem,
  noun,
  mapLabel,
  desktopHeight,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  /** Singular and plural, e.g. ["event", "events"]. */
  noun: [string, string];
  mapLabel: string;
  /** Tailwind height for wide screens, sized to what sits above the map on that page so the map and list fit on screen. */
  desktopHeight: string;
}) {
  const [one, many] = noun; // strings, so callers can pass a fresh array without rebuilding the map
  const n = (count: number) => `${count} ${count === 1 ? one : many}`;
  const places = useMemo(
    () => groupByPlace(events).map((p) => ({ ...p, label: `${p.name}: ${p.count} ${p.count === 1 ? one : many}` })),
    [events, one, many],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, Pin>());

  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap | undefined;
    const added: Marker[] = [];
    let cancelled = false;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        maplibre.setWorkerUrl("/maplibre-gl-worker.mjs"); // copied there by scripts/copy-maplibre-worker.mjs
        const m = new maplibre.Map({
          container: container.current,
          style: STYLE_URL,
          center: SEATTLE,
          zoom: 11,
          attributionControl: { compact: true }, // credits stay one tap away without covering pins
        });
        map = m;
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        m.on("error", (e) => console.warn("map error", e.error));

        for (const p of places) {
          const wrapper = document.createElement("div"); // MapLibre owns this element's transform
          const button = document.createElement("button");
          button.type = "button";
          if (p.photo) {
            button.className = photoPinClass;
            button.style.backgroundImage = `url("${pinImageUrl(p.photo)}")`;
            if (p.count > 1) {
              const badge = document.createElement("span");
              badge.className = badgeClass;
              badge.textContent = String(p.count);
              badge.setAttribute("aria-hidden", "true"); // the pin's label already says the count
              button.appendChild(badge);
            }
          } else {
            button.className = pinClass;
            button.textContent = String(p.count);
          }
          button.setAttribute("aria-label", p.label);
          button.addEventListener("click", () => setSelected((s) => (s === p.key ? null : p.key)));
          wrapper.appendChild(button);
          markers.current.set(p.key, { wrapper, button });
          added.push(new maplibre.Marker({ element: wrapper }).setLngLat([p.lng, p.lat]).addTo(m));
        }

        if (places.length === 1) {
          m.jumpTo({ center: [places[0].lng, places[0].lat], zoom: 14 });
        } else if (places.length > 1) {
          const bounds = new maplibre.LngLatBounds();
          for (const p of places) bounds.extend([p.lng, p.lat]);
          m.fitBounds(bounds, { padding: { top: 56, right: 56, bottom: 72, left: 56 }, maxZoom: 14, duration: 0 });
        }
      } catch (err) {
        console.error("map failed to load", err);
        setFailed(true);
      }
    })();

    const markerEls = markers.current;
    return () => {
      cancelled = true;
      added.forEach((mk) => mk.remove());
      markerEls.clear();
      map?.remove();
    };
  }, [places]);

  useEffect(() => paintPins(markers.current, selected, hovered), [selected, hovered, places]);

  const place = places.find((p) => p.key === selected) ?? null;
  const shown = place ? events.filter((e) => placeKey(e) === place.key) : events;
  const unmapped = events.filter((e) => placeKey(e) === null).length;

  return (
    <div className={`grid grid-cols-1 gap-4 lg:min-h-[420px] lg:grid-cols-[minmax(0,1fr)_420px] ${desktopHeight}`}>
      {/* Map: left on wide screens, top on phones */}
      <div className="relative h-[45vh] min-h-[300px] overflow-hidden rounded-card bg-sunken lg:h-full">
        {failed ? (
          <p className="alt-notice alt-notice--problem m-4">
            The map couldn&apos;t load. Every {noun[0]} is still listed.
          </p>
        ) : (
          // h-full, not absolute positioning: maplibre-gl.css sets position: relative on the map element.
          <div ref={container} role="region" aria-label={mapLabel} className="h-full w-full" />
        )}
      </div>

      {/* List: right on wide screens, below the map on phones */}
      <section aria-label={`${noun[1][0].toUpperCase()}${noun[1].slice(1)} list`} className="flex min-h-0 flex-col">
        <div ref={listTop} className="flex items-baseline justify-between gap-3 pb-3">
          {place ? (
            <>
              <div className="min-w-0">
                <p className="font-semibold">{place.name}</p>
                <p className="alt-secondary truncate">
                  {place.location} · {n(shown.length)}
                </p>
              </div>
              <button type="button" className="alt-link shrink-0" onClick={() => setSelected(null)}>
                Show all {noun[1]}
              </button>
            </>
          ) : (
            <p className="alt-secondary">
              {events.length} {events.length === 1 ? noun[0] : noun[1]}
              {places.length > 0 && " · tap a pin to see one restaurant"}
            </p>
          )}
        </div>

        <ul className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {shown.map((e) => {
            const key = placeKey(e);
            return (
              <li
                key={e.id}
                onMouseEnter={() => key && setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => key && setHovered(key)}
                onBlur={() => setHovered(null)}
              >
                {renderItem(e)}
              </li>
            );
          })}
        </ul>

        {!place && unmapped > 0 && (
          <p className="alt-help pt-3">
            {unmapped} {unmapped === 1 ? `${noun[0]} isn't` : `${noun[1]} aren't`} on the map yet but{" "}
            {unmapped === 1 ? "is" : "are"} listed above.
          </p>
        )}
      </section>
    </div>
  );
}

/** Pins are DOM elements owned by MapLibre markers, so they're updated directly. */
function paintPins(pins: Map<string, Pin>, selected: string | null, hovered: string | null) {
  for (const [key, { wrapper, button }] of pins) {
    button.dataset.selected = String(key === selected);
    button.dataset.hovered = String(key === hovered);
    button.setAttribute("aria-pressed", String(key === selected));
    // Raise the highlighted pin above its neighbours (z-index only; the transform stays MapLibre's).
    wrapper.style.zIndex = key === hovered ? "3" : key === selected ? "2" : "";
  }
}

function groupByPlace(events: MapItem[]): Omit<Place, "label">[] {
  const byKey = new Map<string, Omit<Place, "label">>();
  for (const e of events) {
    const key = placeKey(e);
    if (!key) continue;
    const place = byKey.get(key);
    if (place) {
      place.count++;
      place.photo ??= e.pinPhotoUrl ?? null;
    } else {
      byKey.set(key, { key, name: e.restaurantName, location: e.location, lat: e.lat!, lng: e.lng!, count: 1, photo: e.pinPhotoUrl ?? null });
    }
  }
  return [...byKey.values()];
}
