import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the local @babyblue/core package (shared domain logic) and allow
  // resolving it from outside the app root (it's a sibling file: dependency).
  transpilePackages: ["@babyblue/core"],
  experimental: { externalDir: true },
};

export default nextConfig;
