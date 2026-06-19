import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "convex/react": path.resolve(process.cwd(), "src/lib/mock-convex-react.ts"),
      "@clerk/nextjs": path.resolve(process.cwd(), "src/lib/mock-clerk.tsx"),
      "@clerk/nextjs/experimental": path.resolve(process.cwd(), "src/lib/mock-clerk.tsx"),
    };
    return config;
  },
};

export default nextConfig;
