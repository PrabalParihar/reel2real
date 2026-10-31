import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "64mb" },
  },
};

export default nextConfig;
