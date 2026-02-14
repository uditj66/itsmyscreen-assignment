import type { NextConfig } from "next";

const sseOrigin = process.env.NEXT_PUBLIC_SSE_SERVER_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `connect-src 'self' ${sseOrigin} ${sseOrigin.replace(/^http/, "https")}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
