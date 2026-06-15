import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: process.env.PAGE_URL ? new URL(process.env.PAGE_URL).pathname.replace(/\/$/, "") : "",
  trailingSlash: false,
};

export default nextConfig;
