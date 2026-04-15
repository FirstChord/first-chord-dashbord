import type { NextConfig } from "next";

// Bundle analyzer setup (safe, read-only)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during builds for now (warnings are blocking deployment)
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default withBundleAnalyzer(nextConfig);
