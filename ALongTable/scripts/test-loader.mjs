// Minimal runner support for `npm test`: Node strips TypeScript types itself, and this
// hook resolves the "@/…" alias and extensionless imports the way Next does.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { existsSync } from "node:fs";
      import { fileURLToPath, pathToFileURL } from "node:url";
      const root = ${JSON.stringify(new URL("../", import.meta.url).href)};
      export async function resolve(specifier, context, next) {
        let url = null;
        if (specifier.startsWith("@/")) url = new URL(specifier.slice(2), root);
        else if (/^\\.\\.?\\//.test(specifier) && context.parentURL?.startsWith("file:")) url = new URL(specifier, context.parentURL);
        if (url && !/\\.[cm]?[jt]sx?$/.test(url.pathname)) {
          for (const ext of [".ts", ".tsx", "/index.ts"]) {
            if (existsSync(fileURLToPath(url) + ext)) return next(pathToFileURL(fileURLToPath(url) + ext).href, context);
          }
        }
        return next(url ? url.href : specifier, context);
      }
    `),
);
