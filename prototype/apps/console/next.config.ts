import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@internal/platform", "@internal/kyc", "@internal/refunds"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
