import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only badge can sit on top of the header buttons and block clicks in tests. Errors still show.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
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
