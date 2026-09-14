/**
 * Synthetic end-to-end snapshot through the ReplayReader: three wallets, one Raydium vault, one Kamino vault,
 * one unknown program account, one PDA with no owner account. Checks classification, unattributed labels,
 * per-wallet entitlements and all invariants without network.
 */
import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { MintLayout, AccountLayout } from "@solana/spl-token";
import { KAMINO_LEND_PROGRAM, RAYDIUM_CLMM_PROGRAM, TOKEN_PROGRAM } from "@lookthrough/core";
import { RecordingReader, ReplayReader, type ReaderRecording } from "@lookthrough/datasources";
import { DirectBalanceAdapter, KaminoLendAdapter, RaydiumClmmAdapter, POOL_OFFSETS, POOL_STATE_SPAN, RESERVE_OFFSETS, RESERVE_SPAN } from "@lookthrough/adapters";
import { defaultRules, runSnapshot, supplyPanel } from "./snapshot";
import type { RawAccount } from "@lookthrough/core";

const mint = Keypair.generate().publicKey;
const alice = Keypair.generate().publicKey;
const bob = Keypair.generate().publicKey;
const carol = Keypair.generate().publicKey;
const pool = Keypair.generate().publicKey; // stands in for a pool state account (off-curve in reality; only the vault matters here)
const vaultA = Keypair.generate().publicKey;
const reserve = Keypair.generate().publicKey;
const supplyVault = Keypair.generate().publicKey;
const unknownProgram = Keypair.generate().publicKey;
const [pdaOfUnknown] = PublicKey.findProgramAddressSync([Buffer.from("x")], unknownProgram);
const [pdaNoAccount] = PublicKey.findProgramAddressSync([Buffer.from("y")], unknownProgram);
const lendingMarket = Keypair.generate().publicKey;

function tokenAccount(owner: PublicKey, amount: bigint): Uint8Array {
  const buf = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    { mint, owner, amount, delegateOption: 0, delegate: PublicKey.default, state: 1, isNativeOption: 0, isNative: 0n, delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: PublicKey.default },
    buf
  );
  return new Uint8Array(buf.subarray(0, 72));
}
const acc = (pubkey: PublicKey, owner: PublicKey, data: Uint8Array): RawAccount => ({ pubkey: pubkey.toBase58(), owner: owner.toBase58(), lamports: 1, executable: false, data });

const supply = 1_000_000n;
const balances: [PublicKey, PublicKey, bigint][] = [
  [Keypair.generate().publicKey, alice, 250_000n],
  [Keypair.generate().publicKey, bob, 100_000n],
  [Keypair.generate().publicKey, carol, 50_000n],
  [vaultA, pool, 350_000n],
  [supplyVault, lendingMarket, 200_000n],
  [Keypair.generate().publicKey, pdaOfUnknown, 30_000n],
  [Keypair.generate().publicKey, pdaNoAccount, 20_000n]
];

function poolSlice(): Uint8Array {
  const d = Buffer.alloc(128);
  mint.toBuffer().copy(d, 0); // mintA
  Keypair.generate().publicKey.toBuffer().copy(d, 32); // mintB
  vaultA.toBuffer().copy(d, 64);
  Keypair.generate().publicKey.toBuffer().copy(d, 96);
  return new Uint8Array(d);
}
function reserveSlice(): Uint8Array {
  const d = Buffer.alloc(160);
  lendingMarket.toBuffer().copy(d, 0);
  mint.toBuffer().copy(d, RESERVE_OFFSETS.liquidityMint - RESERVE_OFFSETS.lendingMarket);
  supplyVault.toBuffer().copy(d, RESERVE_OFFSETS.liquiditySupplyVault - RESERVE_OFFSETS.lendingMarket);
  return new Uint8Array(d);
}

function mintData(): Uint8Array {
  const buf = Buffer.alloc(MintLayout.span);
  MintLayout.encode({ mintAuthorityOption: 0, mintAuthority: PublicKey.default, supply, decimals: 6, isInitialized: true, freezeAuthorityOption: 0, freezeAuthority: PublicKey.default }, buf);
  return new Uint8Array(buf);
}

/** A fake chain that answers exactly the calls the resolver makes; recorded once, then replayed. */
class FakeChain {
  async getSlot() {
    return 1000;
  }
  async getBlockTime() {
    return 1_700_000_000;
  }
  async getAccount(pubkey: string) {
    if (pubkey === mint.toBase58()) return acc(mint, new PublicKey(TOKEN_PROGRAM), mintData());
    return null;
  }
  async getMultipleAccounts(pubkeys: string[]) {
    return pubkeys.map((k) => {
      if (k === pdaOfUnknown.toBase58()) return acc(pdaOfUnknown, unknownProgram, new Uint8Array());
      if (k === pool.toBase58()) return acc(pool, new PublicKey(RAYDIUM_CLMM_PROGRAM), new Uint8Array());
      return null;
    });
  }
  async getTokenAccountsByOwner(): Promise<RawAccount[]> {
    return [];
  }
  async getProgramAccounts(programId: string, filters: { memcmp?: { offset: number; bytes: string }; dataSize?: number }[]) {
    if (programId === TOKEN_PROGRAM) return balances.map(([pk, owner, amt]) => acc(pk, new PublicKey(TOKEN_PROGRAM), tokenAccount(owner, amt)));
    if (programId === RAYDIUM_CLMM_PROGRAM) {
      const memcmp = filters.find((f) => f.memcmp)?.memcmp;
      const size = filters.find((f) => f.dataSize)?.dataSize;
      expect(size).toBe(POOL_STATE_SPAN);
      return memcmp?.offset === POOL_OFFSETS.mintA ? [acc(pool, new PublicKey(RAYDIUM_CLMM_PROGRAM), poolSlice())] : [];
    }
    if (programId === KAMINO_LEND_PROGRAM) {
      expect(filters.find((f) => f.dataSize)?.dataSize).toBe(RESERVE_SPAN);
      return [acc(reserve, new PublicKey(KAMINO_LEND_PROGRAM), reserveSlice())];
    }
    return [];
  }
}

// Discovery-only versions of the protocol adapters, so this test covers classification and labelling without protocol state.
class RaydiumDiscoveryOnly extends RaydiumClmmAdapter {
  override readonly status = "stub" as const;
}
class KaminoDiscoveryOnly extends KaminoLendAdapter {
  override readonly status = "stub" as const;
}
const adapters = () => [new DirectBalanceAdapter(), new RaydiumDiscoveryOnly(), new KaminoDiscoveryOnly()];

describe("runSnapshot (synthetic, replayed)", () => {
  it("classifies, labels unattributed rows, computes entitlements and holds the invariants", async () => {
    const recorder = new RecordingReader(new FakeChain());
    const registry = new Set([alice.toBase58(), bob.toBase58()]);
    const first = await runSnapshot({ reader: recorder, mint: mint.toBase58(), adapters: adapters(), registry, rules: defaultRules, actionId: "test" });
    // replay from the recording, as the fixture tests do
    const recording: ReaderRecording = JSON.parse(JSON.stringify(recorder.recording));
    const set = await runSnapshot({ reader: new ReplayReader(recording), mint: mint.toBase58(), adapters: adapters(), registry, rules: defaultRules, actionId: "test" });
    expect(set.attributedRaw).toBe(first.attributedRaw);

    expect(set.invariants.ok).toBe(true);
    expect(set.invariants.warnings).toEqual([]); // accounts sum equals supply
    expect(set.attributedRaw).toBe(400_000n);
    expect(set.unattributedRaw).toBe(600_000n);
    expect(set.entries.map((e) => [e.wallet, e.entitlement, e.registered])).toEqual(
      [
        [alice.toBase58(), 250_000n, true],
        [bob.toBase58(), 100_000n, true],
        [carol.toBase58(), 50_000n, false]
      ].sort((a, b) => ((a[0] as string) < (b[0] as string) ? -1 : 1))
    );
    const labels = set.unattributed.map((u) => u.label).sort();
    expect(labels).toEqual(
      [
        "Raydium CLMM pool vault (adapter raydium_clmm not implemented)",
        "Kamino Lend reserve vault (adapter kamino_lend not implemented)",
        "other programs",
        "other programs (owner has no account)"
      ].sort()
    );
    const panel = supplyPanel(set);
    expect(panel.attributedPct).toBe("40.00");
    expect(panel.doubleCounted).toBe(0);
    expect(set.adaptersUsed.find((a) => a.id === "raydium_clmm")?.containers).toBe(1);
    expect(set.adaptersUsed.find((a) => a.id === "kamino_lend")?.containers).toBe(1);
  });
});
