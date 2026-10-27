import type { NextConfig } from "next";

// Restaurant photos are served from Supabase Storage (public bucket).
const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  // Photo uploads go through a server action; the default 1 MB cap is too small.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // The AI planner now lives as a tab under "Host an event".
    return [{ source: "/plan", destination: "/spaces?tab=plan", permanent: true }];
  },
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
