import type { NextConfig } from "next";

// Same-origin /api requests are forwarded to the Tech Atlas backend.
const API_URL = process.env.TECH_ATLAS_API_URL ?? "http://127.0.0.1:8100";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
