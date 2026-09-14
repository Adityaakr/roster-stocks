/**
 * Generate fixtures/merkle.json, the test vectors shared with the Rust program.
 * Deterministic inputs; run `pnpm merkle:vectors` after any change to the leaf or node format.
 */
import { writeFileSync } from "node:fs";
import { actionIdFromLabel, buildEntitlementTree, hex } from "@lookthrough/core";

const mint = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";
const entries = [
  { wallet: "11111111111111111111111111111112", entitlement: 25_000_000n },
  { wallet: "So11111111111111111111111111111111111111112", entitlement: 100_000_000n },
  { wallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", entitlement: 1n },
  { wallet: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", entitlement: 18_446_744_073_709_551_615n },
  { wallet: "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS", entitlement: 40_326_901n }
];
const actionId = actionIdFromLabel("vectors-v1");
const snapshotSlot = 446_997_808n;
const out = buildEntitlementTree({ actionId, mint, snapshotSlot, entries });
writeFileSync(
  "fixtures/merkle.json",
  JSON.stringify(
    {
      note: "leaf = keccak256(0x00 || actionId || wallet || mint || slot u64 LE || entitlement u64 LE); node = keccak256(0x01 || min || max); odd node promoted",
      actionId: hex(actionId),
      mint,
      snapshotSlot: snapshotSlot.toString(),
      entries: entries.map((e) => ({ wallet: e.wallet, entitlement: e.entitlement.toString() })),
      root: hex(out.root),
      totalEntitlement: out.totalEntitlement.toString(),
      leaves: out.records.map((r) => ({ wallet: r.wallet, entitlement: r.entitlement.toString(), leaf: hex(r.leaf), proof: r.proof.map(hex) }))
    },
    null,
    2
  )
);
console.log(`fixtures/merkle.json written, root ${hex(out.root)}`);
