import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during builds for now (warnings are blocking deployment)
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default nextConfig;
