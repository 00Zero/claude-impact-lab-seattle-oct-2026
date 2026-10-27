import { geoMercator, geoPath, geoCentroid } from "d3-geo";
import type { LngLat, ViewportBounds } from "@/lib/contracts";
import waGeo from "./assets/wa-geo.json";
import terrainAsset from "./assets/wa-terrain.jpg";

// The base map lives in "world pixels" at Web Mercator zoom 9, offset so the
// terrain image starts at (0, 0). The terrain image was rendered from AWS
// Terrain Tiles (Terrarium) for exactly this extent; county shapes come from
// the US Census cartographic boundaries via the us-atlas package.

const Z = 9;
const WORLD = 256 * 2 ** Z;
export const ORIGIN = { x: 19712, y: 44800 };
export const TERRAIN = { width: 3584, height: 2304, href: typeof terrainAsset === "string" ? terrainAsset : terrainAsset.src };

export const projection = geoMercator()
  .scale(WORLD / (2 * Math.PI))
  .translate([WORLD / 2 - ORIGIN.x, WORLD / 2 - ORIGIN.y]);

export const project = (p: LngLat): [number, number] => projection(p) as [number, number];
export const unproject = (p: [number, number]): LngLat => projection.invert!(p) as LngLat;

const path = geoPath(projection);

type GeoFile = {
  counties: { fips: string; name: string; geometry: GeoJSON.Geometry }[];
  state: GeoJSON.Geometry;
  neighbors: { name: string; geometry: GeoJSON.Geometry }[];
};
const geo = waGeo as unknown as GeoFile;

export const COUNTY_SHAPES = geo.counties.map((c) => ({
  name: c.name,
  d: path(c.geometry as GeoJSON.GeometryObject) ?? "",
  label: project(geoCentroid(c.geometry as GeoJSON.GeometryObject) as LngLat),
}));
export const STATE_OUTLINE = path(geo.state as GeoJSON.GeometryObject) ?? "";
export const NEIGHBOR_OUTLINES = geo.neighbors.map((n) => ({ name: n.name, d: path(n.geometry as GeoJSON.GeometryObject) ?? "" }));

/** Washington's extent, used for the opening view and "Reset to Washington". */
export const WA_BOUNDS: ViewportBounds = { west: -124.85, south: 45.54, east: -116.91, north: 49.0 };

export function boundsToPixels(b: ViewportBounds) {
  const [x0, y0] = project([b.west, b.north]);
  const [x1, y1] = project([b.east, b.south]);
  return { x0, y0, x1, y1 };
}

export function countyBounds(name: string): ViewportBounds | null {
  const c = geo.counties.find((x) => x.name === name);
  if (!c) return null;
  const [[w, s], [e, n]] = geoPath().bounds(c.geometry as GeoJSON.GeometryObject);
  return { west: w, south: s, east: e, north: n };
}
