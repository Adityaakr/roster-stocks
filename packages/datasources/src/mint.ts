/**
 * Mint reading with the Token-2022 scaled UI amount extension.
 */
import { PublicKey } from "@solana/web3.js";
import { getScaledUiAmountConfig, unpackMint } from "@solana/spl-token";
import { effectiveMultiplier, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, type Base58, type ChainReader, type MintInfo } from "@lookthrough/core";

export async function readMintInfo(reader: ChainReader, mint: Base58, snapshotTimestamp: number): Promise<MintInfo> {
  const acc = await reader.getAccount(mint);
  if (!acc) throw new Error(`mint ${mint} not found`);
  if (acc.owner !== TOKEN_2022_PROGRAM && acc.owner !== TOKEN_PROGRAM) throw new Error(`${mint} is not owned by a token program (owner ${acc.owner})`);
  const programId = new PublicKey(acc.owner);
  const unpacked = unpackMint(new PublicKey(mint), { ...acc, owner: programId, data: Buffer.from(acc.data) }, programId);
  const config = acc.owner === TOKEN_2022_PROGRAM ? getScaledUiAmountConfig(unpacked) : null;
  return {
    mint,
    tokenProgram: acc.owner,
    decimals: unpacked.decimals,
    supplyRaw: unpacked.supply,
    multiplier: effectiveMultiplier(
      config ? { authority: config.authority.toBase58(), multiplier: config.multiplier, newMultiplier: config.newMultiplier, newMultiplierEffectiveTimestamp: config.newMultiplierEffectiveTimestamp } : null,
      snapshotTimestamp
    )
  };
}
