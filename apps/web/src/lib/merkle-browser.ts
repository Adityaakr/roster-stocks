/**
 * Client-side proof verification: recompute the leaf and walk the proof, byte-for-byte as the program does.
 * Uses the shared core implementation (keccak256 via @noble/hashes), so a judge can verify without trusting the server.
 */
import { buildEntitlementTree, hashLeaf, hashNode, hex, fromHex, leafPreimage, verifyProof } from "@lookthrough/core";

export interface VerifyInput {
  actionIdHex: string;
  wallet: string;
  mint: string;
  snapshotSlot: number | string;
  entitlement: string;
  proof: string[];
  root: string;
}

export function verifyLocally(input: VerifyInput): { ok: boolean; leaf: string; preimage: string; steps: string[] } {
  const leafIn = { actionId: fromHex(input.actionIdHex), wallet: input.wallet, mint: input.mint, snapshotSlot: BigInt(input.snapshotSlot), entitlement: BigInt(input.entitlement) };
  const pre = leafPreimage(leafIn);
  const leaf = hashLeaf(leafIn);
  const steps: string[] = [];
  let node = leaf;
  for (const p of input.proof) {
    node = hashNode(node, fromHex(p));
    steps.push(hex(node));
  }
  return { ok: verifyProof(leaf, input.proof.map(fromHex), fromHex(input.root)), leaf: hex(leaf), preimage: hex(pre), steps };
}

/** Rebuild the whole tree from the published leaves and compare with a root, in the browser. */
export function recomputeRoot(input: { actionIdHex: string; mint: string; snapshotSlot: number | string; leaves: { wallet: string; entitlement: string }[]; root: string }): { ok: boolean; root: string; leaves: number } {
  const tree = buildEntitlementTree({ actionId: fromHex(input.actionIdHex), mint: input.mint, snapshotSlot: BigInt(input.snapshotSlot), entries: input.leaves.map((l) => ({ wallet: l.wallet, entitlement: BigInt(l.entitlement) })) });
  return { ok: hex(tree.root) === input.root.toLowerCase(), root: hex(tree.root), leaves: tree.records.length };
}
