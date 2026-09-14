import { describe, expect, it } from "vitest";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { actionIdFromLabel, buildEntitlementTree, buildTree, fromHex, getProof, hashLeaf, hashNode, hex, leafPreimage, verifyProof } from "./merkle";

const mint = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";
const wallets = ["11111111111111111111111111111112", "So11111111111111111111111111111111111111112", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS"];
const actionId = actionIdFromLabel("test");

describe("merkle", () => {
  it("leaf preimage is exactly 113 bytes with the documented layout", () => {
    const pre = leafPreimage({ actionId, wallet: wallets[0] as string, mint, snapshotSlot: 0x0102030405060708n, entitlement: 25_000_000n });
    expect(pre.length).toBe(113);
    expect(pre[0]).toBe(0);
    expect(hex(pre.subarray(97, 105))).toBe("0807060504030201"); // u64 LE
    expect(hex(pre.subarray(105, 113))).toBe("40787d0100000000"); // 25_000_000 LE
    expect(hex(hashLeaf({ actionId, wallet: wallets[0] as string, mint, snapshotSlot: 0x0102030405060708n, entitlement: 25_000_000n }))).toBe(hex(keccak_256(pre)));
  });

  it("node hashing is order independent and domain separated", () => {
    const a = keccak_256(new Uint8Array([1]));
    const b = keccak_256(new Uint8Array([2]));
    expect(hex(hashNode(a, b))).toBe(hex(hashNode(b, a)));
    expect(hex(hashNode(a, b))).not.toBe(hex(keccak_256(new Uint8Array([...a, ...b]))));
  });

  it("promotes odd leaves and verifies every proof", () => {
    for (const n of [1, 2, 3, 4, 5, 7, 8, 9]) {
      const leaves = Array.from({ length: n }, (_, i) => keccak_256(new Uint8Array([i])));
      const tree = buildTree(leaves);
      for (let i = 0; i < n; i++) {
        const proof = getProof(tree, i);
        expect(verifyProof(leaves[i] as Uint8Array, proof, tree.root)).toBe(true);
        if (n > 1) expect(verifyProof(leaves[(i + 1) % n] as Uint8Array, proof, tree.root)).toBe(false);
      }
    }
    // 3 leaves: root = H(H(l0,l1), l2)
    const l = [0, 1, 2].map((i) => keccak_256(new Uint8Array([i])));
    const t = buildTree(l);
    expect(hex(t.root)).toBe(hex(hashNode(hashNode(l[0] as Uint8Array, l[1] as Uint8Array), l[2] as Uint8Array)));
  });

  it("buildEntitlementTree sorts by wallet bytes, drops zeros and rejects duplicates", () => {
    const entries = wallets.map((w, i) => ({ wallet: w, entitlement: BigInt(i) * 1_000_000n }));
    const out = buildEntitlementTree({ actionId, mint, snapshotSlot: 1n, entries });
    expect(out.records.length).toBe(4);
    expect(out.totalEntitlement).toBe(10_000_000n);
    for (const r of out.records) expect(verifyProof(r.leaf, r.proof, out.root)).toBe(true);
    expect(() => buildEntitlementTree({ actionId, mint, snapshotSlot: 1n, entries: [...entries, { wallet: wallets[1] as string, entitlement: 5n }] })).toThrow(/duplicate/);
  });

  it("matches the shared test vectors in fixtures/merkle.json when present", () => {
    const file = resolve(__dirname, "../../../fixtures/merkle.json");
    if (!existsSync(file)) return;
    const vectors = JSON.parse(readFileSync(file, "utf8")) as {
      actionId: string;
      mint: string;
      snapshotSlot: string;
      entries: { wallet: string; entitlement: string }[];
      root: string;
      leaves: { wallet: string; leaf: string; proof: string[] }[];
    };
    const out = buildEntitlementTree({
      actionId: fromHex(vectors.actionId),
      mint: vectors.mint,
      snapshotSlot: BigInt(vectors.snapshotSlot),
      entries: vectors.entries.map((e) => ({ wallet: e.wallet, entitlement: BigInt(e.entitlement) }))
    });
    expect(hex(out.root)).toBe(vectors.root);
    out.records.forEach((r, i) => {
      expect(hex(r.leaf)).toBe(vectors.leaves[i]?.leaf);
      expect(r.proof.map(hex)).toEqual(vectors.leaves[i]?.proof);
    });
  });
});
