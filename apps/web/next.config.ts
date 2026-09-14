import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@lookthrough/core", "@lookthrough/datasources", "@lookthrough/adapters", "@lookthrough/resolver", "@lookthrough/sdk", "@lookthrough/registrar"],
  serverExternalPackages: ["@raydium-io/raydium-sdk-v2", "@kamino-finance/klend-sdk", "@solana/kit", "@anchor-lang/core"],
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname
};

export default nextConfig;
