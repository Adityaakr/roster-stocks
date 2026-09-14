/**
 * Registrar CLI. Every command is idempotent and logs what it did.
 *   schedule --mint <mint> --symbol AAPLx --kind distribution|vote --label <id> --in-minutes 3 [--usdc-per-share 0.25] [--question "..."] [--deadline-minutes 30] [--registry a,b,c]
 *   snapshot --action <id> [--reuse-from <otherId>]   wait for the record slot, resolve, write entitlements.json and tree.json, print the supply panel
 *   register --keypair <path> --mint <mint>            one signature, opt in for corporate actions
 *   publish  --action <id>                             create the action on-chain with root and content hash
 *   fund     --action <id> --usdc <amount>             fund a distribution from the registrar's demo USDC
 *   claim    --action <id> --keypair <path>
 *   vote     --action <id> --keypair <path> --choice for|against|abstain
 *   proof    --action <id> --wallet <pubkey>
 *   tally    --action <id>
 * Environment: FORK_RPC_URL (default http://127.0.0.1:8899), REGISTRAR_KEYPAIR_PATH (default .keys/registrar.json).
 */
import { existsSync, readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";
import { ActionStore } from "@lookthrough/resolver";
import { formatShares6 } from "@lookthrough/core";
import { claim, fund, loadKeypair, proofFor, publish, recordDateSuggestion, register, schedule, snapshot, tally, vote } from "@lookthrough/registrar";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function need(name: string): string {
  const v = arg(name);
  if (!v) throw new Error(`--${name} is required`);
  return v;
}
const log = (m: string, data?: unknown) => console.log(data === undefined ? m : `${m} ${JSON.stringify(data)}`);

function seedRegistry(): string[] {
  const p = ".keys/registry.json";
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as string[]) : [];
}

async function main() {
  const cmd = process.argv[2];
  const store = new ActionStore(arg("dir", undefined));
  switch (cmd) {
    case "schedule": {
      await recordDateSuggestion(log);
      const kind = (arg("kind", "distribution") as "distribution" | "vote") ?? "distribution";
      await schedule(
        store,
        {
          label: need("label"),
          mint: need("mint"),
          symbol: arg("symbol", "AAPLx") as string,
          kind,
          inMinutes: Number(arg("in-minutes", "3")),
          usdcPerShare: Number(arg("usdc-per-share", "0.25")),
          question: arg("question", "Approve acquisition of XYZ"),
          deadlineMinutes: Number(arg("deadline-minutes", "30")),
          ...(arg("title") ? { title: arg("title") as string } : {}),
          registry: arg("registry")?.split(",").filter(Boolean) ?? seedRegistry()
        },
        log
      );
      return;
    }
    case "snapshot":
      await snapshot(store, need("action"), log, arg("reuse-from") ? { reuseFrom: arg("reuse-from") as string } : {});
      return;
    case "register":
      await register(loadKeypair(need("keypair")), new PublicKey(need("mint")), log);
      return;
    case "publish":
      await publish(store, need("action"), log);
      return;
    case "fund":
      await fund(store, need("action"), Number(need("usdc")), log);
      return;
    case "claim":
      await claim(store, need("action"), loadKeypair(need("keypair")), log);
      return;
    case "vote":
      await vote(store, need("action"), loadKeypair(need("keypair")), (arg("choice", "for") as "for" | "against" | "abstain") ?? "for", log);
      return;
    case "proof": {
      const p = proofFor(store, need("action"), need("wallet"));
      if (!p) log(`${need("wallet")} is not in the tree for ${need("action")} (not registered at the snapshot, or zero entitlement)`);
      else log(JSON.stringify({ action: need("action"), root: p.root, ...p.leaf, entitlementShares: formatShares6(BigInt(p.leaf.entitlement)) }, null, 2));
      return;
    }
    case "tally": {
      const s = await tally(store, need("action"));
      log(JSON.stringify({ kind: s.kind, funded: s.funded, claimedTotalUsdc: Number(s.claimedTotal) / 1e6, forWeight: formatShares6(s.forWeight), againstWeight: formatShares6(s.againstWeight), abstainWeight: formatShares6(s.abstainWeight), voters: s.voters, closed: s.closed }, null, 2));
      return;
    }
    default:
      throw new Error("usage: registrar <schedule|snapshot|register|publish|fund|claim|vote|proof|tally> ...");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
