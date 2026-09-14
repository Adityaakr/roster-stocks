/**
 * Probe: why did only 2 of 181 discovered containers match token accounts on the fork?
 * Runs discovery and the token scan through the fork and reports unmatched vaults with their on-chain state.
 */
import "dotenv/config";
import { RpcReader, readMintInfo, rpcUrlsFromEnv } from "@lookthrough/datasources";
import { defaultAdapters } from "@lookthrough/adapters";
import { enumerateTokenAccounts, defaultRules } from "@lookthrough/resolver";
import type { SnapshotContext } from "@lookthrough/core";

async function main() {
  const mint = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";
  const reader = new RpcReader({ url: rpcUrlsFromEnv().fork, logger: (m) => console.error(`[rpc] ${m}`) });
  const slot = await reader.getSlot();
  const mintInfo = await readMintInfo(reader, mint, Math.floor(Date.now() / 1000));
  const ctx: SnapshotContext = { reader, slotRequested: slot, slotActual: slot, timestamp: 0, mintInfo, registry: new Set(), rules: defaultRules, log: { info: console.error, warn: console.error }, reportUnattributed: () => undefined };
  const containers = (await Promise.all(defaultAdapters().map((a) => a.discoverContainers(mint, ctx)))).flat();
  const rows = await enumerateTokenAccounts(reader, mintInfo);
  const byPk = new Map(rows.map((r) => [r.pubkey, r]));
  const matched = containers.filter((c) => byPk.has(c.address));
  console.log({ containers: containers.length, rows: rows.length, matched: matched.length });
  const missing = containers.filter((c) => !byPk.has(c.address)).slice(0, 5);
  for (const c of missing) {
    const acc = await reader.getAccount(c.address);
    console.log("missing", c.address, c.meta, acc ? { owner: acc.owner, len: acc.data.length, mint: Buffer.from(acc.data.subarray(0, 32)).toString("hex").slice(0, 16) } : "no account");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
