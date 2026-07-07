import type { NextConfig } from "next";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: process.env.PAGE_URL ? new URL(process.env.PAGE_URL).pathname.replace(/\/$/, "") : "",
  trailingSlash: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@firebase/firestore": _require.resolve("@firebase/firestore"),
    };
    return config;
  },
};

export default nextConfig;
