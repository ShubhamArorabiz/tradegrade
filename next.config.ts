import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL.trim()).hostname
  : "localhost";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
