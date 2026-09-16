import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Next reads .env files from apps/web, but this repo keeps them at the root (shared with the scripts). Load the root
 * `.env` and, when LOOKTHROUGH_ENV is set, `.env.<profile>` on top, and expose the NEXT_PUBLIC_* keys to the client.
 */
function publicEnv(): Record<string, string> {
  const root = path.resolve(process.cwd(), "../..");
  const out: Record<string, string> = {};
  for (const f of [".env", ...(process.env.LOOKTHROUGH_ENV ? [`.env.${process.env.LOOKTHROUGH_ENV}`] : [])]) {
    const p = path.join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1]) out[m[1]] = m[2] ?? "";
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith("NEXT_PUBLIC_") && v !== undefined) out[k] = v;
  return out;
}

const nextConfig: NextConfig = {
  agentRules: false,
  // Next 16 allows one dev server per build directory, so the devnet profile uses its own (NEXT_DIST_DIR=.next-devnet).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  env: publicEnv(),
  transpilePackages: ["@lookthrough/core", "@lookthrough/datasources", "@lookthrough/adapters", "@lookthrough/resolver", "@lookthrough/sdk", "@lookthrough/registrar"],
  serverExternalPackages: ["@raydium-io/raydium-sdk-v2", "@kamino-finance/klend-sdk", "@solana/kit", "@anchor-lang/core"],
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async redirects() {
    return [{ source: "/holder", destination: "/portfolio", permanent: false }];
  }
};

export default nextConfig;
