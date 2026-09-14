/**
 * Merkle commitment over entitlements.
 *
 * Leaf  = keccak256(0x00 || actionId[32] || wallet[32] || mint[32] || snapshotSlot u64 LE || entitlement u64 LE)
 * Node  = keccak256(0x01 || min(a, b) || max(a, b))   (byte-wise comparison)
 * An odd node at any level is promoted unchanged to the next level (not duplicated).
 * Proofs are the sibling list from leaf to root; verification sorts each pair, so no side bits are needed.
 * The same construction is implemented in the Anchor program; fixtures/merkle.json holds shared test vectors.
 */
import { keccak_256 } from "@noble/hashes/sha3.js";
import { PublicKey } from "@solana/web3.js";
import type { Base58 } from "./types";

export const LEAF_PREFIX = 0x00;
export const NODE_PREFIX = 0x01;
export const MAX_PROOF_LEN = 32;

export interface LeafInput {
  actionId: Uint8Array; // 32 bytes
  wallet: Base58;
  mint: Base58;
  snapshotSlot: bigint;
  entitlement: bigint;
}

function u64le(v: bigint): Uint8Array {
  if (v < 0n || v > 0xffff_ffff_ffff_ffffn) throw new Error("u64 out of range");
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
}

export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    if (d !== 0) return d;
  }
  return 0;
}

export function leafPreimage(input: LeafInput): Uint8Array {
  if (input.actionId.length !== 32) throw new Error("actionId must be 32 bytes");
  const out = new Uint8Array(1 + 32 + 32 + 32 + 8 + 8);
  out[0] = LEAF_PREFIX;
  out.set(input.actionId, 1);
  out.set(new PublicKey(input.wallet).toBytes(), 33);
  out.set(new PublicKey(input.mint).toBytes(), 65);
  out.set(u64le(input.snapshotSlot), 97);
  out.set(u64le(input.entitlement), 105);
  return out;
}

export function hashLeaf(input: LeafInput): Uint8Array {
  return keccak_256(leafPreimage(input));
}

export function hashNode(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [lo, hi] = compareBytes(a, b) <= 0 ? [a, b] : [b, a];
  const pre = new Uint8Array(65);
  pre[0] = NODE_PREFIX;
  pre.set(lo, 1);
  pre.set(hi, 33);
  return keccak_256(pre);
}

export interface MerkleTree {
  root: Uint8Array;
  leaves: Uint8Array[];
  /** levels[0] = leaves, levels[last] = [root] */
  levels: Uint8Array[][];
}

export function buildTree(leaves: Uint8Array[]): MerkleTree {
  if (leaves.length === 0) throw new Error("cannot build a tree with no leaves");
  const levels: Uint8Array[][] = [leaves.slice()];
  while ((levels[levels.length - 1] as Uint8Array[]).length > 1) {
    const prev = levels[levels.length - 1] as Uint8Array[];
    const next: Uint8Array[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i] as Uint8Array;
      const right = prev[i + 1];
      next.push(right ? hashNode(left, right) : left);
    }
    levels.push(next);
  }
  return { root: (levels[levels.length - 1] as Uint8Array[])[0] as Uint8Array, leaves, levels };
}

export function getProof(tree: MerkleTree, index: number): Uint8Array[] {
  if (index < 0 || index >= tree.leaves.length) throw new Error("leaf index out of range");
  const proof: Uint8Array[] = [];
  let i = index;
  for (let level = 0; level < tree.levels.length - 1; level++) {
    const nodes = tree.levels[level] as Uint8Array[];
    const sibling = i % 2 === 0 ? nodes[i + 1] : nodes[i - 1];
    if (sibling) proof.push(sibling);
    i = Math.floor(i / 2);
  }
  if (proof.length > MAX_PROOF_LEN) throw new Error("proof too long");
  return proof;
}

export function verifyProof(leaf: Uint8Array, proof: Uint8Array[], root: Uint8Array): boolean {
  if (proof.length > MAX_PROOF_LEN) return false;
  let node = leaf;
  for (const sib of proof) node = hashNode(node, sib);
  return compareBytes(node, root) === 0;
}

export const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
export const fromHex = (h: string): Uint8Array => new Uint8Array(Buffer.from(h.replace(/^0x/, ""), "hex"));

/** Deterministic 32-byte action id from a human label: keccak256("lookthrough:action:" + label). */
export function actionIdFromLabel(label: string): Uint8Array {
  return keccak_256(new TextEncoder().encode(`lookthrough:action:${label}`));
}

export interface EntitlementLeafRecord {
  wallet: Base58;
  entitlement: bigint;
  leaf: Uint8Array;
  proof: Uint8Array[];
}

/**
 * Build the tree for an action from (wallet, entitlement) pairs.
 * Wallets must be unique; entries are sorted by wallet bytes and zero entitlements are excluded,
 * so the root is a set commitment that anyone can recompute from entitlements.json.
 */
export function buildEntitlementTree(params: { actionId: Uint8Array; mint: Base58; snapshotSlot: bigint; entries: { wallet: Base58; entitlement: bigint }[] }): {
  root: Uint8Array;
  records: EntitlementLeafRecord[];
  totalEntitlement: bigint;
} {
  const filtered = params.entries.filter((e) => e.entitlement > 0n);
  const seen = new Set<string>();
  for (const e of filtered) {
    if (seen.has(e.wallet)) throw new Error(`duplicate wallet in entries: ${e.wallet}`);
    seen.add(e.wallet);
  }
  const sorted = filtered.slice().sort((a, b) => compareBytes(new PublicKey(a.wallet).toBytes(), new PublicKey(b.wallet).toBytes()));
  const leaves = sorted.map((e) => hashLeaf({ actionId: params.actionId, wallet: e.wallet, mint: params.mint, snapshotSlot: params.snapshotSlot, entitlement: e.entitlement }));
  const tree = buildTree(leaves);
  return {
    root: tree.root,
    records: sorted.map((e, i) => ({ wallet: e.wallet, entitlement: e.entitlement, leaf: leaves[i] as Uint8Array, proof: getProof(tree, i) })),
    totalEntitlement: sorted.reduce((a, e) => a + e.entitlement, 0n)
  };
}
