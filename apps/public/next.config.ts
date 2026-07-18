import type { NextConfig } from "next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  basePath: process.env.PAGE_URL ? new URL(process.env.PAGE_URL).pathname.replace(/\/$/, "") : "",
  trailingSlash: false,
  ...(process.env.VERCEL ? {} : { output: "export" }),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.googleapis.com https://*.googlesyndication.com https://jsbarcode https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.googleapis.com https://*.firebasestorage.app https://*.googleusercontent.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://script.google.com",
              "frame-src 'self' https://*.firebaseapp.com https://*.google.com",
              "media-src 'self'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
