// Bundles the explorer into one self-contained HTML file for a Claude artifact.
// React and ReactDOM load as pinned UMD builds from cdnjs; everything else is inlined.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "artifact/dist");
mkdirSync(out, { recursive: true });

const globals = { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM" };
const globalsPlugin = {
  name: "umd-globals",
  setup(b) {
    b.onResolve({ filter: /^(react|react-dom|react-dom\/client|react\/jsx-runtime)$/ }, (a) => ({ path: a.path, namespace: "umd" }));
    b.onLoad({ filter: /.*/, namespace: "umd" }, (a) => ({
      contents:
        a.path === "react/jsx-runtime"
          ? "const R = window.React; const jsx = (t, p, k) => R.createElement(t, k === undefined ? p : { ...p, key: k }); export { jsx, jsx as jsxs }; export const Fragment = R.Fragment;"
          : `module.exports = window.${globals[a.path]};`,
      loader: "js",
    }));
  },
};

const result = await build({
  entryPoints: [path.join(root, "artifact/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  loader: { ".jpg": "dataurl" },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_DATA_MODE": '"fixtures"', "process.env.NEXT_PUBLIC_API_BASE_URL": '""', "process.env.NEXT_PUBLIC_BOOKING_URL": JSON.stringify(process.env.NEXT_PUBLIC_BOOKING_URL ?? "") },
  alias: { "@": path.join(root, "src") },
  plugins: [globalsPlugin],
  legalComments: "none",
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = ["app.css", "service-area.css"].map((f) => readFileSync(path.join(root, "src/styles", f), "utf8")).join("\n");
const html = `<title>Bid Analytics</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600&display=swap">
<meta name="description" content="Map-first discovery of Washington public works opportunities with fit explanations. Development fixtures.">
<style>${css}
#root{height:100%}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync(path.join(out, "washington-contract-explorer.html"), html);
console.log(`artifact: ${(html.length / 1024).toFixed(0)} KB`);
