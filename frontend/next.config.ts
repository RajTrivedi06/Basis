import type { NextConfig } from "next";

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

export default nextConfig;
