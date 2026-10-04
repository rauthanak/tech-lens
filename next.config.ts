import type { NextConfig } from "next";

// Same-origin /api requests are forwarded to the Tech Atlas backend.
const API_URL = process.env.TECH_ATLAS_API_URL ?? "http://127.0.0.1:8100";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  async redirects() {
    return [
      { source: "/", destination: "/admin", permanent: false },
      // Signals folded into the Briefing (same query names: days, run, type,
      // tech, source, signal); its other tabs moved to Setup → Signal list
      { source: "/admin/signals", has: [{ type: "query", key: "tab", value: "list" }],
        destination: "/admin/signals/list", permanent: false },
      { source: "/admin/signals", has: [{ type: "query", key: "tab", value: "other" }],
        destination: "/admin/signals/list#suggestions", permanent: false },
      { source: "/admin/signals", has: [{ type: "query", key: "tab", value: "set-aside" }],
        destination: "/admin/signals/list#set-aside", permanent: false },
      { source: "/admin/signals", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
