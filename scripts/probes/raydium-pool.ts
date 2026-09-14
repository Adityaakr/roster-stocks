/**
 * Probe: decode a Raydium CLMM pool and all of its positions from mainnet, compute each position's
 * token amounts at the current sqrt price with the SDK, and compare the sum (plus owed fees, protocol
 * and fund fees) with the vault balance. Records what the pro-rata rule has to absorb.
 * Usage: pnpm tsx scripts/probes/raydium-pool.ts [poolId]
 */
import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { PoolInfoLayout, PersonalPositionLayout, TickUtil, LiquidityMathUtil, CLMM_PROGRAM_ID, TickArrayLayout, TickArrayUtil, PositionUtils, getPdaTickArrayAddress } from "@raydium-io/raydium-sdk-v2";
import { RpcReader, rpcUrlsFromEnv } from "@lookthrough/datasources";

const poolId = process.argv[2] ?? "CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y";

function offsetOf(layout: { fields: { property?: string; span: number }[] }, prop: string): number {
  let off = 0;
  for (const f of layout.fields) {
    if (f.property === prop) return off;
    off += f.span;
  }
  throw new Error(`no field ${prop}`);
}

async function main() {
  const urls = rpcUrlsFromEnv();
  const reader = new RpcReader({ url: urls.mainnet, fallbackUrl: urls.mainnetFallback, logger: (m) => console.error(`[rpc] ${m}`) });
  const poolAcc = await reader.getAccount(poolId);
  if (!poolAcc) throw new Error("pool not found");
  const pool = PoolInfoLayout.decode(Buffer.from(poolAcc.data));
  const poolLayout = PoolInfoLayout as unknown as { span: number; fields: { property?: string; span: number }[] };
  const posLayout = PersonalPositionLayout as unknown as { span: number; fields: { property?: string; span: number }[] };
  console.log("layout offsets", {
    poolSpan: poolLayout.span,
    mintA: offsetOf(poolLayout, "mintA"),
    mintB: offsetOf(poolLayout, "mintB"),
    vaultA: offsetOf(poolLayout, "vaultA"),
    vaultB: offsetOf(poolLayout, "vaultB"),
    sqrtPriceX64: offsetOf(poolLayout, "sqrtPriceX64"),
    protocolFeesTokenA: offsetOf(poolLayout, "protocolFeesTokenA"),
    fundFeesTokenA: offsetOf(poolLayout, "fundFeesTokenA"),
    positionSpan: posLayout.span,
    positionPoolId: offsetOf(posLayout, "poolId"),
    positionNftMint: offsetOf(posLayout, "nftMint")
  });
  const vaultA = pool.vaultA.toBase58();
  const vaultAcc = await reader.getAccount(vaultA);
  if (!vaultAcc) throw new Error("vault not found");
  const vaultBalance = new DataView(vaultAcc.data.buffer, vaultAcc.data.byteOffset + 64, 8).getBigUint64(0, true);

  const positions = await reader.getProgramAccounts(CLMM_PROGRAM_ID.toBase58(), [{ dataSize: posLayout.span }, { memcmp: { offset: offsetOf(posLayout, "poolId"), bytes: poolId } }]);
  // uncollected fees need the tick states at each position's bounds: fetch every distinct tick array once
  const tickSpacing = pool.tickSpacing as number;
  const decoded = positions.map((p) => PersonalPositionLayout.decode(Buffer.from(p.data)));
  const tickArrayAddr = (tick: number) => getPdaTickArrayAddress(CLMM_PROGRAM_ID, new PublicKey(poolId), TickArrayUtil.getTickArrayStartIndex(tick, tickSpacing)).publicKey.toBase58();
  const tickArrayAddrs = [...new Set(decoded.flatMap((pos) => [tickArrayAddr(pos.tickLower), tickArrayAddr(pos.tickUpper)]))];
  const tickArrayAccs = await reader.getMultipleAccounts(tickArrayAddrs);
  const tickArrays = new Map(tickArrayAddrs.map((a, i) => [a, tickArrayAccs[i] ? TickArrayLayout.decode(Buffer.from((tickArrayAccs[i] as { data: Uint8Array }).data)) : null]));
  let uncollectedA = 0n;
  let missingTickArrays = 0;
  let sumA = 0n;
  let feesOwedA = 0n;
  let liquiditySum = 0n;
  let inRange = 0;
  for (const p of positions) {
    const pos = PersonalPositionLayout.decode(Buffer.from(p.data));
    const sqrtA = TickUtil.getSqrtPriceAtTick(pos.tickLower);
    const sqrtB = TickUtil.getSqrtPriceAtTick(pos.tickUpper);
    const { amountA } = LiquidityMathUtil.getAmountsForLiquidity(pool.sqrtPriceX64, sqrtA, sqrtB, pos.liquidity, false);
    sumA += BigInt((amountA as BN).toString());
    feesOwedA += BigInt(pos.tokenFeesOwedA.toString());
    liquiditySum += BigInt(pos.liquidity.toString());
    if (pool.tickCurrent >= pos.tickLower && pool.tickCurrent < pos.tickUpper) inRange += 1;
    const lowerArr = tickArrays.get(tickArrayAddr(pos.tickLower));
    const upperArr = tickArrays.get(tickArrayAddr(pos.tickUpper));
    if (!lowerArr || !upperArr) {
      missingTickArrays += 1;
      continue;
    }
    const lowerState = lowerArr.ticks[TickArrayUtil.getTickOffsetInArray(pos.tickLower, tickSpacing)];
    const upperState = upperArr.ticks[TickArrayUtil.getTickOffsetInArray(pos.tickUpper, tickSpacing)];
    const fees = PositionUtils.GetPositionFees(pool, pos, lowerState, upperState);
    // GetPositionFees returns owed + newly accrued; subtract owed (already summed) to get the accrued-only part
    const total = BigInt(fees.tokenFeeAmountA.toString());
    const owed = BigInt(pos.tokenFeesOwedA.toString());
    if (total >= owed && total < (1n << 64n)) uncollectedA += total - owed;
  }
  const protocolFees = BigInt(pool.protocolFeesTokenA.toString());
  const fundFees = BigInt(pool.fundFeesTokenA.toString());
  const accounted = sumA + feesOwedA + uncollectedA + protocolFees + fundFees;
  console.log(
    JSON.stringify(
      {
        poolId,
        mintA: pool.mintA.toBase58(),
        vaultA,
        vaultBalance: vaultBalance.toString(),
        positions: positions.length,
        inRange,
        poolLiquidity: pool.liquidity.toString(),
        positionLiquiditySum: liquiditySum.toString(),
        sumPositionAmountA: sumA.toString(),
        feesOwedA: feesOwedA.toString(),
        uncollectedAccruedA: uncollectedA.toString(),
        tickArrays: tickArrayAddrs.length,
        missingTickArrays,
        protocolFeesA: protocolFees.toString(),
        fundFeesA: fundFees.toString(),
        accounted: accounted.toString(),
        unexplained: (vaultBalance - accounted).toString(),
        unexplainedPct: Number(((vaultBalance - accounted) * 1_000_000n) / vaultBalance) / 10_000
      },
      null,
      2
    )
  );
  void PublicKey;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
