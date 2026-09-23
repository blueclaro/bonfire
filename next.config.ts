import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.BONFIRE_BUILD_DIR || ".next",
};

export default nextConfig;
