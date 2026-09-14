/**
 * Raydium CLMM adapter.
 *
 * Discovery: every CLMM pool whose mintA or mintB is the mint; the container is the vault on that side.
 * Resolution (issuer rule `raydium_clmm`):
 *   base     = vault balance − protocolFees − fundFees (those two go to an unattributed row)
 *   claim_i  = amount_i at the snapshot sqrt price (LiquidityMathUtil.getAmountsForLiquidity)
 *              + tokenFeesOwed_i + fees accrued since the position was last touched (PositionUtils.GetPositionFees)
 *   attributed_i = proRata(base, claims), which conserves the base exactly; the largest-remainder dust is deterministic
 *   beneficiary  = current holder of the position NFT (under either token program); off-curve holders are unattributed
 *                  with the holder's program label (recurse-once rule: we do not look through vaults that hold positions).
 *
 * PoolState layout offsets (span 1544) and PersonalPosition offsets (span 281) were verified against the installed
 * @raydium-io/raydium-sdk-v2 layouts and mainnet pool CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y on 2026-09-14
 * (scripts/probes/raydium-pool.ts). The probe showed accrued fees are material (2.9% of the vault), so they are computed.
 */
import { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { CLMM_PROGRAM_ID, LiquidityMathUtil, PersonalPositionLayout, PoolInfoLayout, PositionUtils, TickArrayLayout, TickArrayUtil, TickUtil, getPdaTickArrayAddress } from "@raydium-io/raydium-sdk-v2";
import {
  RAYDIUM_CLMM_PROGRAM,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  mapConcurrent,
  programLabel,
  proRata,
  type Base58,
  type ContainerInfo,
  type EntitlementPosition,
  type PositionAdapter,
  type SnapshotContext
} from "@lookthrough/core";

export const POOL_STATE_SPAN = 1544;
export const POOL_OFFSETS = { mintA: 73, mintB: 105, vaultA: 137, vaultB: 169, sqrtPriceX64: 253, protocolFeesTokenA: 309, fundFeesTokenA: 1064 } as const;
export const POSITION_SPAN = 281;
export const POSITION_OFFSETS = { nftMint: 9, poolId: 41 } as const;

const pk = (data: Uint8Array, offset: number) => new PublicKey(data.subarray(offset, offset + 32)).toBase58();
const big = (v: BN | bigint | number | string) => BigInt(v.toString());

/** Find the token account holding exactly 1 unit of an NFT mint under the mint's own token program. */
async function nftHolder(ctx: SnapshotContext, nftMint: Base58, tokenProgram: Base58): Promise<{ owner: Base58; tokenAccount: Base58 } | null> {
  const accounts = await ctx.reader.getProgramAccounts(tokenProgram, [{ memcmp: { offset: 0, bytes: nftMint } }], { offset: 0, length: 72 });
  for (const a of accounts) {
    const amount = new DataView(a.data.buffer, a.data.byteOffset + 64, 8).getBigUint64(0, true);
    if (amount === 1n) return { owner: pk(a.data, 32), tokenAccount: a.pubkey };
  }
  return null;
}

export class RaydiumClmmAdapter implements PositionAdapter {
  readonly id = "raydium_clmm";
  readonly status: "implemented" | "stub" = "implemented";

  async discoverContainers(mint: string, ctx: SnapshotContext): Promise<ContainerInfo[]> {
    // Fetch bytes 73..201 (mintA, mintB, vaultA, vaultB) of every pool whose mintA or mintB is the mint.
    const slice = { offset: POOL_OFFSETS.mintA, length: 128 };
    const [asA, asB] = await Promise.all([
      ctx.reader.getProgramAccounts(RAYDIUM_CLMM_PROGRAM, [{ dataSize: POOL_STATE_SPAN }, { memcmp: { offset: POOL_OFFSETS.mintA, bytes: mint } }], slice),
      ctx.reader.getProgramAccounts(RAYDIUM_CLMM_PROGRAM, [{ dataSize: POOL_STATE_SPAN }, { memcmp: { offset: POOL_OFFSETS.mintB, bytes: mint } }], slice)
    ]);
    const containers: ContainerInfo[] = [];
    for (const pool of [...asA, ...asB]) {
      // Some RPCs (surfpool for datasource-proxied accounts) ignore dataSlice; detect the full span and read absolute offsets.
      const base = pool.data.length >= POOL_STATE_SPAN ? POOL_OFFSETS.mintA : 0;
      const d = pool.data;
      const mintA = pk(d, base + 0);
      const mintB = pk(d, base + 32);
      const vaultA = pk(d, base + 64);
      const vaultB = pk(d, base + 96);
      const isA = mintA === mint;
      containers.push({
        address: isA ? vaultA : vaultB,
        adapterId: this.id,
        program: RAYDIUM_CLMM_PROGRAM,
        label: "Raydium CLMM pool vault",
        meta: { poolId: pool.pubkey, side: isA ? "A" : "B", mintA, mintB, vaultA, vaultB }
      });
    }
    ctx.log.info(`raydium_clmm: ${containers.length} pool vaults hold ${mint.slice(0, 6)}…`);
    return containers;
  }

  async resolve(container: ContainerInfo, mint: string, ctx: SnapshotContext): Promise<EntitlementPosition[]> {
    const poolId = container.meta.poolId as Base58;
    const side = container.meta.side as "A" | "B";
    const balance = BigInt(container.meta.balanceRaw as string);
    if (balance === 0n) return [];

    const poolAcc = await ctx.reader.getAccount(poolId);
    if (!poolAcc) throw new Error(`raydium pool ${poolId} not found`);
    const pool = PoolInfoLayout.decode(Buffer.from(poolAcc.data));
    const protocolFees = big(side === "A" ? pool.protocolFeesTokenA : pool.protocolFeesTokenB);
    const fundFees = big(side === "A" ? pool.fundFeesTokenA : pool.fundFeesTokenB);
    const fees = protocolFees + fundFees;
    const base = balance > fees ? balance - fees : 0n;
    if (fees > 0n) ctx.reportUnattributed({ container: container.address, program: RAYDIUM_CLMM_PROGRAM, label: "Raydium protocol and fund fees", raw: balance - base });

    // Every position in the pool.
    const positionAccounts = await ctx.reader.getProgramAccounts(CLMM_PROGRAM_ID.toBase58(), [{ dataSize: POSITION_SPAN }, { memcmp: { offset: POSITION_OFFSETS.poolId, bytes: poolId } }]);
    const positions = positionAccounts.map((a) => ({ pubkey: a.pubkey, state: PersonalPositionLayout.decode(Buffer.from(a.data)) }));

    // Tick states for accrued fees: one read per distinct tick array.
    const tickSpacing = pool.tickSpacing;
    const tickArrayAddr = (tick: number) => getPdaTickArrayAddress(CLMM_PROGRAM_ID, new PublicKey(poolId), TickArrayUtil.getTickArrayStartIndex(tick, tickSpacing)).publicKey.toBase58();
    const tickArrayAddrs = [...new Set(positions.flatMap((p) => [tickArrayAddr(p.state.tickLower), tickArrayAddr(p.state.tickUpper)]))];
    const tickArrayAccs = tickArrayAddrs.length ? await ctx.reader.getMultipleAccounts(tickArrayAddrs) : [];
    const tickArrays = new Map(tickArrayAddrs.map((a, i) => [a, tickArrayAccs[i] ? TickArrayLayout.decode(Buffer.from((tickArrayAccs[i] as { data: Uint8Array }).data)) : null]));

    // Claims per position.
    const claims: { pubkey: Base58; nftMint: Base58; amount: bigint; owed: bigint; accrued: bigint; claim: bigint; tickLower: number; tickUpper: number; liquidity: string }[] = [];
    for (const p of positions) {
      const s = p.state;
      const sqrtA = TickUtil.getSqrtPriceAtTick(s.tickLower);
      const sqrtB = TickUtil.getSqrtPriceAtTick(s.tickUpper);
      const amounts = LiquidityMathUtil.getAmountsForLiquidity(pool.sqrtPriceX64, sqrtA, sqrtB, s.liquidity, false);
      const amount = big(side === "A" ? amounts.amountA : amounts.amountB);
      const owed = big(side === "A" ? s.tokenFeesOwedA : s.tokenFeesOwedB);
      let accrued = 0n;
      const lowerArr = tickArrays.get(tickArrayAddr(s.tickLower));
      const upperArr = tickArrays.get(tickArrayAddr(s.tickUpper));
      if (lowerArr && upperArr) {
        const lowerState = lowerArr.ticks[TickArrayUtil.getTickOffsetInArray(s.tickLower, tickSpacing)];
        const upperState = upperArr.ticks[TickArrayUtil.getTickOffsetInArray(s.tickUpper, tickSpacing)];
        if (lowerState && upperState) {
          const f = PositionUtils.GetPositionFees(pool, s, lowerState, upperState);
          const total = big(side === "A" ? f.tokenFeeAmountA : f.tokenFeeAmountB);
          if (total >= owed && total < 1n << 64n) accrued = total - owed;
        }
      }
      claims.push({ pubkey: p.pubkey, nftMint: s.nftMint.toBase58(), amount, owed, accrued, claim: amount + owed + accrued, tickLower: s.tickLower, tickUpper: s.tickUpper, liquidity: s.liquidity.toString() });
    }
    const claimSum = claims.reduce((a, c) => a + c.claim, 0n);
    const attributed = proRata(base, claims.map((c) => c.claim));
    ctx.log.info(`raydium_clmm: pool ${poolId.slice(0, 6)}… ${positions.length} positions, claims ${claimSum} vs base ${base}`);

    // Beneficiaries: the NFT holders. One batched read gives each NFT mint's token program, then one filtered
    // getProgramAccounts per NFT (run concurrently) finds the account holding it.
    const live = claims.map((c, i) => ({ c, raw: attributed[i] ?? 0n })).filter((x) => x.raw > 0n);
    const nftMintAccounts = live.length ? await ctx.reader.getMultipleAccounts(live.map((x) => x.c.nftMint), { offset: 0, length: 0 }) : [];
    const holders = await mapConcurrent(live, 2, (x, i) => {
      const program = nftMintAccounts[i]?.owner === TOKEN_PROGRAM ? TOKEN_PROGRAM : TOKEN_2022_PROGRAM;
      return nftHolder(ctx, x.c.nftMint, program);
    });
    const byWallet = new Map<Base58, { raw: bigint; positions: Record<string, unknown>[] }>();
    let unresolvedRaw = 0n;
    const unresolved: Record<string, unknown>[] = [];
    for (let i = 0; i < live.length; i++) {
      const { c, raw } = live[i] as (typeof live)[number];
      const holder = holders[i] ?? null;
      const evidence = { position: c.pubkey, nftMint: c.nftMint, tickLower: c.tickLower, tickUpper: c.tickUpper, liquidity: c.liquidity, amountAtSnapshot: c.amount.toString(), feesOwed: c.owed.toString(), feesAccrued: c.accrued.toString(), claim: c.claim.toString(), attributed: raw.toString(), holderTokenAccount: holder?.tokenAccount ?? null };
      if (!holder || !PublicKey.isOnCurve(new PublicKey(holder.owner).toBytes())) {
        unresolvedRaw += raw;
        const holderProgram = holder ? (await ctx.reader.getAccount(holder.owner))?.owner ?? null : null;
        unresolved.push({ ...evidence, holder: holder?.owner ?? null, holderProgram });
        ctx.reportUnattributed({ container: container.address, program: holderProgram, label: holder ? `Raydium position held by ${programLabel(holderProgram)}` : "Raydium position NFT holder not found", raw });
        continue;
      }
      const w = byWallet.get(holder.owner) ?? { raw: 0n, positions: [] };
      w.raw += raw;
      w.positions.push(evidence);
      byWallet.set(holder.owner, w);
    }
    if (unresolvedRaw > 0n) ctx.log.warn(`raydium_clmm: ${unresolved.length} positions (${unresolvedRaw} raw) held by non-wallets in pool ${poolId.slice(0, 6)}…`);

    return [...byWallet.entries()].map(([wallet, w]) => ({
      wallet,
      mint,
      source: "raydium_clmm",
      container: container.address,
      rawAttributed: w.raw,
      ruleApplied: "raydium_clmm",
      evidence: {
        poolId,
        side,
        vault: container.address,
        vaultBalance: balance.toString(),
        protocolFees: protocolFees.toString(),
        fundFees: fundFees.toString(),
        base: base.toString(),
        sqrtPriceX64: pool.sqrtPriceX64.toString(),
        tickCurrent: pool.tickCurrent,
        claimSumAllPositions: claimSum.toString(),
        positions: w.positions
      }
    }));
  }
}
