import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // monorepo root를 명시 — 홈 디렉토리의 다른 lockfile에 영향받지 않도록
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
