import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { LOOKTHROUGH_PROGRAM_ID } from "@lookthrough/sdk";
import { cluster, forkReachable, json, keysDir } from "@/lib/server";

export const dynamic = "force-dynamic";

/** What the app is pointed at: cluster, program id, demo mints, explorer base. Public, no secrets. */
export async function GET() {
  const keys = keysDir();
  const demoPath = path.join(keys, "demo.json");
  const demo = existsSync(demoPath) ? (JSON.parse(readFileSync(demoPath, "utf8")) as { mint?: string; usdcMint?: string; registrar?: string; multiplier?: number }) : null;
  const c = cluster();
  return json({
    cluster: c,
    label: c === "devnet" ? "Devnet" : "Mainnet fork",
    programId: LOOKTHROUGH_PROGRAM_ID.toBase58(),
    rpcReachable: await forkReachable(),
    demoMint: demo?.mint ?? null,
    usdcMint: demo?.usdcMint ?? null,
    registrar: demo?.registrar ?? null,
    explorer: c === "devnet" ? "https://explorer.solana.com/{path}?cluster=devnet" : null,
    faucet: c === "devnet"
  });
}
