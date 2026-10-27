import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Gives `next dev` the bindings from wrangler.jsonc (the D1 database `DB`),
// backed by local copies under .wrangler/. Create the local tables once with
// `npm run db:migrate:local`.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Off because every page hangs on Cloudflare Workers (OpenNext 1.20) with
  // Cache Components on. Nothing here uses "use cache" yet. See docs/deployment.md.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
