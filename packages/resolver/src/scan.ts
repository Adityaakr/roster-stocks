/**
 * Enumerate every token account for a mint under its token program.
 * Filter: memcmp mint at offset 0. No dataSize filter, because Token-2022 extensions change the size.
 * Data slice 0..72 covers mint (0..32), owner (32..64) and amount (64..72) for both token programs
 * (verified in @solana/spl-token AccountLayout: mint@0, owner@32, amount@64).
 */
import { PublicKey } from "@solana/web3.js";
import type { Base58, ChainReader, MintInfo, TokenAccountRow } from "@lookthrough/core";

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
