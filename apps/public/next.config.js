/** @type {import("next").NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  basePath: process.env.PAGE_URL ? new URL(process.env.PAGE_URL).pathname.replace(/\/$/, "") : "",
  trailingSlash: false,
  ...(process.env.VERCEL ? {} : { output: "export" }),
};

module.exports = nextConfig;
