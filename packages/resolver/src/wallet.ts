/**
 * Live per-wallet ledger: what one wallet holds of a mint right now across direct balances, Raydium CLMM positions
 * and Kamino deposits. Uses the same math as the adapters but without the pool-wide pro rata step, so the DeFi rows
 * are labelled "estimated" until a record-date snapshot exists for the mint.
 */
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { CLMM_PROGRAM_ID, LiquidityMathUtil, PersonalPositionLayout, PoolInfoLayout, TickUtil, getPdaPersonalPositionAddress } from "@raydium-io/raydium-sdk-v2";
import { Obligation, PROGRAM_ID as KLEND_PROGRAM_ID_ADDR, Reserve, VanillaObligation } from "@kamino-finance/klend-sdk";
import { address } from "@solana/kit";
import { KAMINO_LEND_PROGRAM, RAYDIUM_CLMM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, rawToShares6, type Base58, type ChainReader, type MintInfo } from "@lookthrough/core";
import { KaminoLendAdapter, OBLIGATION_SIZE, POOL_STATE_SPAN, RESERVE_OFFSETS, RESERVE_SPAN, RaydiumClmmAdapter } from "@lookthrough/adapters";
import { readMintInfo } from "@lookthrough/datasources";

export interface LedgerRow {
  source: "direct" | "raydium_clmm" | "kamino_lend";
  container: Base58;
  label: string;
  rawAmount: bigint;
  shares6: bigint;
  estimated: boolean;
  evidence: Record<string, unknown>;
}

export interface WalletLedger {
  wallet: Base58;
  mint: Base58;
  slot: number;
  timestamp: number;
  multiplier: string;
  decimals: number;
  rows: LedgerRow[];
  walletVisibleShares6: bigint;
  totalShares6: bigint;
}

const pk = (d: Uint8Array, o: number) => new PublicKey(d.subarray(o, o + 32)).toBase58();

/** Reserve discovery is a program-wide scan (slow through an RPC proxy) and its result changes rarely: memoise for 10 minutes. */
const reserveCache = new Map<string, { keys: string[]; at: number }>();
async function reservesForMint(reader: ChainReader, mint: Base58): Promise<string[]> {
  const hit = reserveCache.get(mint);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.keys;
  const keys = (await reader.getProgramAccounts(KAMINO_LEND_PROGRAM, [{ dataSize: RESERVE_SPAN }, { memcmp: { offset: RESERVE_OFFSETS.liquidityMint, bytes: mint } }], { offset: 0, length: 0 })).map((r) => r.pubkey);
  reserveCache.set(mint, { keys, at: Date.now() });
  return keys;
}
const amountAt64 = (d: Uint8Array) => new DataView(d.buffer, d.byteOffset + 64, 8).getBigUint64(0, true);

export async function resolveWallet(reader: ChainReader, wallet: Base58, mint: Base58): Promise<WalletLedger> {
  const slot = await reader.getSlot();
  const timestamp = (await reader.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000);
  const mintInfo: MintInfo = await readMintInfo(reader, mint, timestamp);
  const shares = (raw: bigint) => rawToShares6(raw, mintInfo.multiplier.multiplier, mintInfo.decimals);
  const rows: LedgerRow[] = [];

  // Everything the wallet holds under both token programs: direct balances of the mint, and NFT candidates.
  const held = [...(await reader.getTokenAccountsByOwner(wallet, TOKEN_2022_PROGRAM)), ...(await reader.getTokenAccountsByOwner(wallet, TOKEN_PROGRAM))];
  const nftCandidates: { mint: Base58; tokenAccount: Base58 }[] = [];
  for (const a of held) {
    const m = pk(a.data, 0);
    const raw = amountAt64(a.data);
    if (m === mint && raw > 0n) {
      rows.push({ source: "direct", container: a.pubkey, label: "Wallet balance", rawAmount: raw, shares6: shares(raw), estimated: false, evidence: { tokenAccount: a.pubkey, rawAmount: raw.toString(), multiplier: mintInfo.multiplier.multiplier } });
    } else if (raw === 1n) nftCandidates.push({ mint: m, tokenAccount: a.pubkey });
  }
  if (nftCandidates.length) {
    const posAddrs = nftCandidates.map((c) => getPdaPersonalPositionAddress(CLMM_PROGRAM_ID, new PublicKey(c.mint)).publicKey.toBase58());
    const posAccs = await reader.getMultipleAccounts(posAddrs);
    const positions = posAccs.map((acc, i) => (acc && acc.owner === RAYDIUM_CLMM_PROGRAM ? { nft: nftCandidates[i] as (typeof nftCandidates)[number], address: posAddrs[i] as string, state: PersonalPositionLayout.decode(Buffer.from(acc.data)) } : null)).filter((p): p is NonNullable<typeof p> => p !== null);
    const poolIds = [...new Set(positions.map((p) => p.state.poolId.toBase58()))];
    const poolAccs = poolIds.length ? await reader.getMultipleAccounts(poolIds) : [];
    const pools = new Map(poolIds.map((id, i) => [id, poolAccs[i] && poolAccs[i]!.data.length >= POOL_STATE_SPAN ? PoolInfoLayout.decode(Buffer.from(poolAccs[i]!.data)) : null]));
    for (const p of positions) {
      const pool = pools.get(p.state.poolId.toBase58());
      if (!pool) continue;
      const side = pool.mintA.toBase58() === mint ? "A" : pool.mintB.toBase58() === mint ? "B" : null;
      if (!side) continue;
      const amounts = LiquidityMathUtil.getAmountsForLiquidity(pool.sqrtPriceX64, TickUtil.getSqrtPriceAtTick(p.state.tickLower), TickUtil.getSqrtPriceAtTick(p.state.tickUpper), p.state.liquidity, false);
      const amount = BigInt((side === "A" ? amounts.amountA : amounts.amountB).toString());
      const owed = BigInt((side === "A" ? p.state.tokenFeesOwedA : p.state.tokenFeesOwedB).toString());
      const raw = amount + owed;
      rows.push({
        source: "raydium_clmm",
        container: (side === "A" ? pool.vaultA : pool.vaultB).toBase58(),
        label: "Raydium CLMM position",
        rawAmount: raw,
        shares6: shares(raw),
        estimated: true,
        evidence: { position: p.address, nftMint: p.nft.mint, poolId: p.state.poolId.toBase58(), side, tickLower: p.state.tickLower, tickUpper: p.state.tickUpper, liquidity: p.state.liquidity.toString(), amountAtCurrentPrice: amount.toString(), feesOwed: owed.toString(), sqrtPriceX64: pool.sqrtPriceX64.toString(), note: "Accrued fees and the pool-wide pro rata reconciliation are applied at the record-date snapshot." }
      });
    }
  }

  // Kamino: the wallet's vanilla obligation in each market that has a reserve for this mint (derived address, one read each).
  // The record-date snapshot enumerates every obligation type; the live ledger reads the vanilla one, which is what deposits create.
  // Discovery with a data slice (cheap through an RPC proxy), then point reads for the full reserve state.
  const reserveKeys = await reservesForMint(reader, mint);
  const reserveAccs = reserveKeys.length ? await reader.getMultipleAccounts(reserveKeys) : [];
  const reserves = reserveAccs.flatMap((acc, i) => (acc ? [{ pubkey: reserveKeys[i] as string, data: acc.data }] : []));
  if (reserves.length) {
    const byReserve = new Map(reserves.map((r) => [r.pubkey, Reserve.decode(Buffer.from(r.data))]));
    const markets = [...new Set([...byReserve.values()].map((r) => r.lendingMarket.toString()))];
    const pdas = await Promise.all(markets.map((m) => new VanillaObligation(KLEND_PROGRAM_ID_ADDR).toPda(address(m), address(wallet))));
    const obligationAccs = await reader.getMultipleAccounts(pdas.map(String));
    const obligations = obligationAccs.flatMap((acc, i) => (acc && acc.owner === KAMINO_LEND_PROGRAM && acc.data.length === OBLIGATION_SIZE ? [{ pubkey: String(pdas[i]), data: acc.data }] : []));
    for (const o of obligations) {
      const ob = Obligation.decode(Buffer.from(o.data));
      for (const d of ob.deposits) {
        const reserveId = d.depositReserve.toString();
        const reserve = byReserve.get(reserveId);
        if (!reserve) continue;
        const cTokens = BigInt(d.depositedAmount.toString());
        if (cTokens === 0n) continue;
        const vault = reserve.liquidity.supplyVault.toString();
        const vaultAcc = await reader.getAccount(vault);
        const vaultBalance = vaultAcc ? amountAt64(vaultAcc.data) : 0n;
        const supply = BigInt(reserve.collateral.mintTotalSupply.toString());
        const raw = supply === 0n ? 0n : (cTokens * vaultBalance) / supply;
        rows.push({
          source: "kamino_lend",
          container: vault,
          label: "Kamino Lend deposit",
          rawAmount: raw,
          shares6: shares(raw),
          estimated: true,
          evidence: { obligation: o.pubkey, reserve: reserveId, depositedCTokens: cTokens.toString(), cTokenSupply: supply.toString(), supplyVault: vault, vaultBalance: vaultBalance.toString(), borrowLimit: reserve.config.borrowLimit.toString(), collateralOnly: BigInt(reserve.config.borrowLimit.toString()) === 0n }
        });
      }
    }
  }

  const walletVisibleShares6 = rows.filter((r) => r.source === "direct").reduce((a, r) => a + r.shares6, 0n);
  const totalRaw = rows.reduce((a, r) => a + r.rawAmount, 0n);
  return { wallet, mint, slot, timestamp, multiplier: mintInfo.multiplier.multiplier, decimals: mintInfo.decimals, rows, walletVisibleShares6, totalShares6: shares(totalRaw) };
}

void RaydiumClmmAdapter;
void KaminoLendAdapter;
void BN;
