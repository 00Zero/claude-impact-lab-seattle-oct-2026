import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Uses WebAssembly that shouldn't go through the server bundler.
  serverExternalPackages: ["heic-convert"],
  experimental: {
    serverActions: {
      // Price-book documents can be up to 10 MB (profile pictures 5 MB),
      // plus multipart overhead and the other form fields.
      bodySizeLimit: "11mb",
    },
    // The proxy buffers request bodies; keep its cap above the action limit
    // so large uploads aren't truncated.
    proxyClientMaxBodySize: "12mb",
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
