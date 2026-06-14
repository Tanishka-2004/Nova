import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the database package from the monorepo
  transpilePackages: ["@nova/database"],

  // Environment variables exposed to the client
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },

  // Experimental features
  experimental: {
    // Enable server actions for form handling
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
