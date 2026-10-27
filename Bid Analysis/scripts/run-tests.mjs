// Bundles tests/*.test.ts with esbuild (path aliases, JSON, TSX) and runs them with node:test.
import { build } from "esbuild";
import { readdirSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "node_modules/.cache/tests");
mkdirSync(out, { recursive: true });
const entries = readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".test.ts")).map((f) => path.join(root, "tests", f));
await build({
  entryPoints: entries, outdir: out, bundle: true, platform: "node", format: "esm", outExtension: { ".js": ".mjs" },
  alias: { "@": path.join(root, "src") }, loader: { ".jpg": "dataurl" }, jsx: "automatic", logLevel: "warning",
  external: ["react", "react-dom"],
});
const r = spawnSync(process.execPath, ["--test", ...entries.map((e) => path.join(out, path.basename(e).replace(/\.ts$/, ".mjs")))], { stdio: "inherit" });
process.exit(r.status ?? 1);
