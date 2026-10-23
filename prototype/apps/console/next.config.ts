import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@internal/platform", "@internal/kyc", "@internal/refunds", "@internal/flags"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
