import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the local @babyblue/core package (shared domain logic).
  transpilePackages: ["@babyblue/core"],
};

export default nextConfig;
