import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { demoMode, json, repoRoot } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Public keys of the demo wallets (never the secrets). Empty unless DEMO_MODE=1 and pnpm seed has run. */
export async function GET() {
  if (!demoMode()) return json({ wallets: [] });
  const wallets = [];
  for (const name of ["alice", "bob", "carol"] as const) {
    const p = path.join(repoRoot(), ".keys", `${name}.json`);
    if (!existsSync(p)) continue;
    const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(p, "utf8"))));
    wallets.push({ name, pubkey: kp.publicKey.toBase58() });
  }
  return json({ wallets });
}
