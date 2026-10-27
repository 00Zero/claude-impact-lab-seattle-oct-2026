"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from "d3-zoom";
import type { FitTier, LngLat, ViewportBounds } from "@/lib/contracts";
import { WA_PLACES } from "@/lib/taxonomy";
import { COUNTY_SHAPES, NEIGHBOR_OUTLINES, STATE_OUTLINE, TERRAIN, WA_BOUNDS, boundsToPixels, project, unproject } from "./geo";
import { clusterPoints, type ScreenPoint } from "./cluster";
import { TierGlyph } from "@/explorer/components/Icons";

// Replaceable renderer. Everything the app needs from a map goes through these
// props and the imperative handle, so a MapLibre or Mapbox implementation can
// take its place once a tile provider and token are approved (SRS 2.3).

export interface MapPoint {
  key: string;
  oppId: string;
  lngLat: LngLat;
  approximate: boolean;
  title: string;
  /** undefined before personalization; null while unassessed. */
  tier?: FitTier | null;
  /** Service area preview: reachable only with the draft area, or no longer reachable with it. */
  preview?: "added" | "removed";
}

/** County roles while previewing a service area change; keyed by county name. */
export type ServiceAreaPreview = Readonly<Record<string, "current" | "kept" | "added" | "removed">>;

export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapHandle {
  zoomBy(factor: number): void;
  resetToWashington(): void;
  flyToBounds(b: ViewportBounds, maxZoom?: number): void;
  flyToPoints(points: LngLat[]): void;
  getBounds(): ViewportBounds | null;
}

interface Props {
  points: MapPoint[];
  selectedId: string | null;
  hoveredId: string | null;
  serviceCounties: string[];
  filterCounties: string[];
  /** When set, replaces the service-area styling with the preview's county roles. */
  serviceAreaPreview?: ServiceAreaPreview | null;
  personalized: boolean;
  insets: MapInsets;
  showMarkers: boolean;
  onSelect(id: string): void;
  onHover(id: string | null): void;
  onCountyClick(name: string): void;
  onUserMove(): void;
  onImageryError(): void;
}

const MIN_K = 0.12;
const MAX_K = 4;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const MapView = memo(
  forwardRef<MapHandle, Props>(function MapView(props, ref) {
    const { points, selectedId, hoveredId, serviceCounties, filterCounties, personalized, insets, showMarkers } = props;
    const svgRef = useRef<SVGSVGElement>(null);
    const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [t, setT] = useState<ZoomTransform>(zoomIdentity);
    const [hoverCounty, setHoverCounty] = useState<string | null>(null);
    const insetsRef = useRef(insets);
    insetsRef.current = insets;
    const cb = useRef(props);
    cb.current = props;

    const transformFor = useCallback((b: { x0: number; y0: number; x1: number; y1: number }, maxK = MAX_K) => {
      const svg = svgRef.current;
      if (!svg) return zoomIdentity;
      const { width, height } = svg.getBoundingClientRect();
      const i = insetsRef.current;
      const pad = 28;
      const aw = Math.max(80, width - i.left - i.right - pad * 2);
      const ah = Math.max(80, height - i.top - i.bottom - pad * 2);
      const k = Math.min(maxK, Math.max(MIN_K, Math.min(aw / Math.max(1, b.x1 - b.x0), ah / Math.max(1, b.y1 - b.y0))));
      const cx = i.left + pad + aw / 2;
      const cy = i.top + pad + ah / 2;
      return zoomIdentity.translate(cx - k * (b.x0 + b.x1) / 2, cy - k * (b.y0 + b.y1) / 2).scale(k);
    }, []);

    const animateTo = useCallback((target: ZoomTransform) => {
      const svg = svgRef.current;
      if (!svg || !zoomRef.current) return;
      const sel = select(svg);
      if (reducedMotion()) sel.call(zoomRef.current.transform, target);
      else sel.transition().duration(650).call(zoomRef.current.transform, target);
    }, []);

    // Size tracking
    useEffect(() => {
      const svg = svgRef.current!;
      const ro = new ResizeObserver(() => {
        const r = svg.getBoundingClientRect();
        setSize({ w: r.width, h: r.height });
      });
      ro.observe(svg);
      return () => ro.disconnect();
    }, []);

    // Zoom behavior
    useEffect(() => {
      const svg = svgRef.current!;
      const z = d3zoom<SVGSVGElement, unknown>()
        .scaleExtent([MIN_K, MAX_K])
        .translateExtent([[-TERRAIN.width * 0.5, -TERRAIN.height * 0.5], [TERRAIN.width * 1.5, TERRAIN.height * 1.5]])
        .on("zoom", (e) => {
          setT(e.transform);
          if (e.sourceEvent) cb.current.onUserMove();
        });
      zoomRef.current = z;
      const sel = select(svg).call(z).on("dblclick.zoom", null);
      sel.call(z.transform, transformFor(boundsToPixels(WA_BOUNDS)));
      return () => {
        sel.on(".zoom", null);
      };
    }, [transformFor]);

    // Refit the opening view once the real size is known.
    const fitted = useRef(false);
    useEffect(() => {
      if (!fitted.current && size.w > 0 && zoomRef.current && svgRef.current) {
        fitted.current = true;
        select(svgRef.current).call(zoomRef.current.transform, transformFor(boundsToPixels(WA_BOUNDS)));
      }
    }, [size.w, transformFor]);

    useImperativeHandle(ref, () => ({
      zoomBy(factor) {
        if (!svgRef.current || !zoomRef.current) return;
        const sel = select(svgRef.current);
        if (reducedMotion()) sel.call(zoomRef.current.scaleBy, factor);
        else sel.transition().duration(250).call(zoomRef.current.scaleBy, factor);
      },
      resetToWashington() {
        animateTo(transformFor(boundsToPixels(WA_BOUNDS)));
      },
      flyToBounds(b, maxK = 1.25) {
        animateTo(transformFor(boundsToPixels(b), maxK));
      },
      flyToPoints(pts) {
        if (!pts.length) return;
        const px = pts.map(project);
        const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]);
        const b = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
        const minSpan = 60;
        if (b.x1 - b.x0 < minSpan) { const c = (b.x0 + b.x1) / 2; b.x0 = c - minSpan / 2; b.x1 = c + minSpan / 2; }
        if (b.y1 - b.y0 < minSpan) { const c = (b.y0 + b.y1) / 2; b.y0 = c - minSpan / 2; b.y1 = c + minSpan / 2; }
        const target = transformFor(b, 1.25);
        // Don't zoom out to show a point that is already comfortably visible.
        animateTo(target.k < t.k && px.every(([x, y]) => inView(t, x, y, size, insetsRef.current)) ? t : target);
      },
      getBounds() {
        if (!size.w) return null;
        const i = insetsRef.current;
        const [west, north] = unproject(t.invert([i.left, i.top]) as [number, number]);
        const [east, south] = unproject(t.invert([size.w - i.right, size.h - i.bottom]) as [number, number]);
        return { west, south, east, north };
      },
    }), [animateTo, transformFor, t, size]);

    // Screen-space points, clustered at the current zoom. Selected work never hides in a cluster.
    const screen: ScreenPoint<MapPoint>[] = useMemo(
      () => points.map((p) => { const [x, y] = project(p.lngLat); return { x: t.applyX(x), y: t.applyY(y), data: p }; }),
      [points, t],
    );
    const { clusters, singles } = useMemo(() => clusterPoints(screen, t.k >= MAX_K * 0.95 ? 0 : 30, (p) => p.data.oppId === selectedId, (p) => p.data.lngLat.join(",")), [screen, selectedId]);

    const labelPlaces = WA_PLACES.filter((p) => p.rank <= (t.k < 0.45 ? 1 : t.k < 0.9 ? 2 : 3));
    const serviceSet = new Set(serviceCounties);
    const filterSet = new Set(filterCounties);
    const preview = props.serviceAreaPreview ?? null;
    const countyClass = (name: string) => {
      const role = preview?.[name];
      const service = preview ? role === "current" || role === "kept" : serviceSet.has(name);
      return `map-county${service ? " is-service" : ""}${role === "added" ? " is-sa-added" : ""}${role === "removed" ? " is-sa-removed" : ""}${filterSet.has(name) ? " is-filter" : ""}`;
    };
    const strongLabel = (name: string) => filterSet.has(name) || preview?.[name] === "added" || preview?.[name] === "removed";

    return (
      <svg ref={svgRef} className="map-svg" role="application" aria-label="Map of Washington opportunities. Drag to pan, scroll or pinch to zoom.">
        <defs>
          <filter id="marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <linearGradient id="fade-x" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.06" stopColor="#fff" /><stop offset="0.94" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fade-y" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.08" stopColor="#fff" /><stop offset="0.92" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="mask-x" maskUnits="userSpaceOnUse" x={0} y={0} width={TERRAIN.width} height={TERRAIN.height}><rect width={TERRAIN.width} height={TERRAIN.height} fill="url(#fade-x)" /></mask>
          <mask id="mask-y" maskUnits="userSpaceOnUse" x={0} y={0} width={TERRAIN.width} height={TERRAIN.height}><rect width={TERRAIN.width} height={TERRAIN.height} fill="url(#fade-y)" /></mask>
        </defs>
        <rect width="100%" height="100%" className="map-ocean" />
        <g transform={t.toString()}>
          <g mask="url(#mask-x)">
            <image href={TERRAIN.href} x={0} y={0} width={TERRAIN.width} height={TERRAIN.height} preserveAspectRatio="none" mask="url(#mask-y)" onError={() => cb.current.onImageryError()} />
          </g>
          {NEIGHBOR_OUTLINES.map((n) => <path key={n.name} d={n.d} className="map-neighbor" />)}
          {COUNTY_SHAPES.map((c) => (
            <path
              key={c.name}
              d={c.d}
              className={`${countyClass(c.name)}${hoverCounty === c.name ? " is-hover" : ""}`}
              onPointerEnter={() => setHoverCounty(c.name)}
              onPointerLeave={() => setHoverCounty((h) => (h === c.name ? null : h))}
              onClick={() => cb.current.onCountyClick(c.name)}
            />
          ))}
          <path d={STATE_OUTLINE} className="map-state" />
        </g>

        <g className="map-labels" aria-hidden="true">
          {t.k >= 0.55 && COUNTY_SHAPES.map((c) => (
            <text key={c.name} x={t.applyX(c.label[0])} y={t.applyY(c.label[1])} className={`map-county-label${strongLabel(c.name) || hoverCounty === c.name ? " is-strong" : ""}`}>{c.name}</text>
          ))}
          {labelPlaces.map((p) => {
            const [wx, wy] = project(p.lngLat);
            const x = t.applyX(wx), y = t.applyY(wy);
            const w = p.name.length * 7 + 8;
            const blocked = showMarkers && [...clusters, ...singles].some((m) => m.x > x - 14 && m.x < x + w + 10 && m.y > y - 26 && m.y < y + 12);
            if (blocked) return null;
            return (
              <g key={p.name} transform={`translate(${x},${y})`} className={`map-place rank-${p.rank}`}>
                <circle r={2} />
                <text x={5} y={-4}>{p.name}</text>
              </g>
            );
          })}
          {t.k < 0.55 && hoverCounty && (() => {
            const c = COUNTY_SHAPES.find((x) => x.name === hoverCounty)!;
            return <text x={t.applyX(c.label[0])} y={t.applyY(c.label[1])} className="map-county-label is-strong">{c.name} County</text>;
          })()}
        </g>

        {showMarkers && (
          <g className="map-markers">
            {clusters.map((c) => (
              <ClusterMarker
                key={c.key}
                x={c.x}
                y={c.y}
                ids={c.ids}
                tiers={personalized ? c.members.map((m) => m.data.tier ?? null) : null}
                onActivate={() => {
                  const px = c.members.map((m) => project(m.data.lngLat));
                  const xs = px.map((q) => q[0]), ys = px.map((q) => q[1]);
                  const target = transformFor({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }, MAX_K);
                  if (target.k > t.k * 1.2) animateTo(target);
                  else {
                    const [wx, wy] = t.invert([c.x, c.y]);
                    const k = Math.min(MAX_K, t.k * 2.5);
                    animateTo(zoomIdentity.translate(c.x - k * wx, c.y - k * wy).scale(k));
                  }
                }}
              />
            ))}
            {fanOut(singles).map(({ p, dx, dy }) => (
              <PointMarker
                key={p.data.key}
                p={p}
                dx={dx}
                dy={dy}
                personalized={personalized}
                selected={p.data.oppId === selectedId}
                hovered={p.data.oppId === hoveredId}
                onSelect={props.onSelect}
                onHover={props.onHover}
              />
            ))}
          </g>
        )}
      </svg>
    );
  }),
);

function inView(t: ZoomTransform, x: number, y: number, size: { w: number; h: number }, i: MapInsets) {
  const sx = t.applyX(x), sy = t.applyY(y);
  return sx > i.left + 40 && sx < size.w - i.right - 40 && sy > i.top + 40 && sy < size.h - i.bottom - 40;
}

/** Points that share one display anchor (for example, two jobs at a city centroid) fan out on screen only. */
function fanOut<T>(singles: ScreenPoint<T>[]) {
  const groups = new Map<string, ScreenPoint<T>[]>();
  for (const p of singles) {
    const k = `${Math.round(p.x)}:${Math.round(p.y)}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.values()].flatMap((g) =>
    g.length === 1 ? [{ p: g[0], dx: 0, dy: 0 }] : g.map((p, i) => ({ p, dx: Math.cos((i / g.length) * 2 * Math.PI - Math.PI / 2) * 16, dy: Math.sin((i / g.length) * 2 * Math.PI - Math.PI / 2) * 16 })),
  );
}

const TIER_CLASS: Record<FitTier, string> = { good_fit: "tier-good_fit", possible_fit: "tier-possible_fit", needs_review: "tier-needs_review", not_a_fit: "tier-not_a_fit" };

function PointMarker({ p, dx, dy, personalized, selected, hovered, onSelect, onHover }: {
  p: ScreenPoint<MapPoint>; dx: number; dy: number; personalized: boolean; selected: boolean; hovered: boolean;
  onSelect(id: string): void; onHover(id: string | null): void;
}) {
  const d = p.data;
  const tierClass = personalized ? (d.tier ? TIER_CLASS[d.tier] : "tier-unassessed") : "tier-none";
  const r = personalized ? 10 : 7;
  const precisionText = d.approximate ? "approximate location" : "mapped work site";
  const tierText = personalized ? (d.tier ? `, ${d.tier.replace(/_/g, " ")}` : ", not assessed") : "";
  const previewText = d.preview === "added" ? ", newly reachable in the service area preview" : d.preview === "removed" ? ", no longer reachable in the service area preview" : "";
  return (
    <g
      transform={`translate(${p.x + dx},${p.y + dy})`}
      className={`marker ${tierClass}${d.approximate ? " is-approx" : ""}${selected ? " is-selected" : ""}${hovered ? " is-hovered" : ""}${d.preview ? ` is-sa-${d.preview}` : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${d.title}, ${precisionText}${tierText}${previewText}`}
      aria-pressed={selected}
      onClick={(e) => { e.stopPropagation(); onSelect(d.oppId); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(d.oppId); } }}
      onPointerEnter={() => onHover(d.oppId)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(d.oppId)}
      onBlur={() => onHover(null)}
    >
      {(dx || dy) ? <line x1={-dx} y1={-dy} x2={0} y2={0} className="marker-leader" /> : null}
      <circle r={22} className="marker-hit" />
      <g className="marker-body" filter="url(#marker-shadow)">
        {d.approximate ? (
          <>
            <circle r={r + 3} className="marker-halo" />
            <circle r={r} className="marker-fill" />
          </>
        ) : (
          <circle r={r} className="marker-fill" />
        )}
        {personalized && d.tier && <TierGlyph tier={d.tier} size={11} />}
      </g>
      {(selected || hovered) && (
        <g className="marker-callout" transform={`translate(0,${-r - 12})`}>
          <text className="marker-callout-text" textAnchor="middle">{d.title.length > 46 ? `${d.title.slice(0, 44)}…` : d.title}</text>
        </g>
      )}
    </g>
  );
}

function ClusterMarker({ x, y, ids, tiers, onActivate }: { x: number; y: number; ids: string[]; tiers: (FitTier | null)[] | null; onActivate(): void }) {
  const n = ids.length;
  const r = n < 5 ? 15 : n < 10 ? 18 : 22;
  const segments = useMemo(() => {
    if (!tiers) return null;
    const order: (FitTier | null)[] = ["good_fit", "possible_fit", "needs_review", "not_a_fit", null];
    const counts = order.map((o) => tiers.filter((t) => t === o).length);
    let acc = 0;
    return order.map((o, i) => {
      const start = acc / tiers.length, end = (acc += counts[i]) / tiers.length;
      return counts[i] ? { cls: o ? TIER_CLASS[o] : "tier-unassessed", d: arc(r + 1.5, start, end) } : null;
    }).filter(Boolean) as { cls: string; d: string }[];
  }, [tiers, r]);
  return (
    <g
      transform={`translate(${x},${y})`}
      className="cluster"
      role="button"
      tabIndex={0}
      aria-label={`${n} opportunities here. Zoom in to separate them.`}
      onClick={(e) => { e.stopPropagation(); onActivate(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(); } }}
    >
      <circle r={r + 8} className="marker-hit" />
      <circle r={r} className="cluster-body" filter="url(#marker-shadow)" />
      {segments?.map((s, i) => <path key={i} d={s.d} className={`cluster-seg ${s.cls}`} />)}
      <text className="cluster-count" textAnchor="middle" dy="0.35em">{n}</text>
    </g>
  );
}

function arc(r: number, a0: number, a1: number) {
  if (a1 - a0 >= 0.999) return `M0,${-r}A${r},${r} 0 1 1 0,${r}A${r},${r} 0 1 1 0,${-r}`;
  const p = (a: number) => [Math.sin(a * 2 * Math.PI) * r, -Math.cos(a * 2 * Math.PI) * r];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0},${y0}A${r},${r} 0 ${a1 - a0 > 0.5 ? 1 : 0} 1 ${x1},${y1}`;
}
