/**
 * Enumerate every token account for a mint under its token program.
 * Filter: memcmp mint at offset 0. No dataSize filter, because Token-2022 extensions change the size.
 * Data slice 0..72 covers mint (0..32), owner (32..64) and amount (64..72) for both token programs
 * (verified in @solana/spl-token AccountLayout: mint@0, owner@32, amount@64).
 */
import { PublicKey } from "@solana/web3.js";
import { isGpaRefused, type Base58, type ChainReader, type MintInfo, type TokenAccountRow } from "@lookthrough/core";

export interface ScanResult {
  rows: TokenAccountRow[];
  /** "program_accounts" is the full enumeration; "largest_accounts" is the 20-account fallback, complete only when the mint has at most 20 holders. */
  method: "program_accounts" | "largest_accounts";
  complete: boolean;
}

export async function scanTokenAccounts(reader: ChainReader, mintInfo: MintInfo, log?: (m: string) => void): Promise<ScanResult> {
  try {
    return { rows: await enumerateTokenAccounts(reader, mintInfo), method: "program_accounts", complete: true };
  } catch (err) {
    if (!isGpaRefused(err) || !reader.getTokenLargestAccounts) throw err;
    log?.(`getProgramAccounts refused by this RPC; falling back to getTokenLargestAccounts (20 accounts at most)`);
    const largest = await reader.getTokenLargestAccounts(mintInfo.mint);
    if (!largest) throw err;
    const accounts = await reader.getMultipleAccounts(largest.map((l) => l.address));
    const rows: TokenAccountRow[] = [];
    for (const acc of accounts) {
      if (!acc || acc.data.length < 72) continue;
      const owner: Base58 = new PublicKey(acc.data.subarray(32, 64)).toBase58();
      const amountRaw = new DataView(acc.data.buffer, acc.data.byteOffset + 64, 8).getBigUint64(0, true);
      rows.push({ pubkey: acc.pubkey, owner, amountRaw });
    }
    const total = rows.reduce((a, r) => a + r.amountRaw, 0n);
    return { rows, method: "largest_accounts", complete: largest.length < 20 || total === mintInfo.supplyRaw };
  }
}

export async function enumerateTokenAccounts(reader: ChainReader, mintInfo: MintInfo): Promise<TokenAccountRow[]> {
  const accounts = await reader.getProgramAccounts(mintInfo.tokenProgram, [{ memcmp: { offset: 0, bytes: mintInfo.mint } }], { offset: 0, length: 72 });
  const rows: TokenAccountRow[] = [];
  for (const acc of accounts) {
    if (acc.data.length < 72) continue;
    const owner: Base58 = new PublicKey(acc.data.subarray(32, 64)).toBase58();
    const amountRaw = new DataView(acc.data.buffer, acc.data.byteOffset + 64, 8).getBigUint64(0, true);
    rows.push({ pubkey: acc.pubkey, owner, amountRaw });
  }
  return rows;
}
