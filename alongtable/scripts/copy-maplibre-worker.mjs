// MapLibre runs map rendering in a web worker and looks for it next to its own script,
// which doesn't exist once Next.js bundles the library. Serve it from public/ instead
// (components/events-map.tsx points MapLibre at /maplibre-gl-worker.mjs). Runs before
// dev and build so the worker always matches the installed MapLibre version.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
