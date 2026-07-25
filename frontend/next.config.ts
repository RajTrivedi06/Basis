import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Proxy /api/* to the local FastAPI backend during `next dev`.
  // In production builds (Vercel), no rewrite is emitted — the frontend uses
  // absolute URLs from NEXT_PUBLIC_API_URL to reach api.gpu-basis.xyz.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      // Client-side capture only this stage — no source-map upload (needs SENTRY_AUTH_TOKEN).
      silent: true,
      sourcemaps: {
        disable: true,
      },
    })
  : nextConfig;
