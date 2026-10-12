import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['node:sqlite'],
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
