import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored brand assets (static demo page + vanilla JS); not part of the app.
    "brand/**",
    // MapLibre's web worker, copied from node_modules by scripts/copy-maplibre-worker.mjs.
    "public/maplibre-gl-worker.mjs",
  ]),
]);

export default eslintConfig;
