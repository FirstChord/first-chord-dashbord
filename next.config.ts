import type { NextConfig } from "next";

// Bundle analyzer setup (safe, read-only)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Keep production tracing inside this repository when a parent directory also
  // contains a lockfile. This avoids host-specific workspace-root inference.
  outputFileTracingRoot: process.cwd(),
  eslint: {
    // CI and `npm run lint` enforce the zero-warning lint gate explicitly.
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default withBundleAnalyzer(nextConfig);
