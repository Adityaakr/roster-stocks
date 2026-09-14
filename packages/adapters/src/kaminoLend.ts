/**
 * Kamino Lend adapter.
 *
 * Discovery: every reserve whose liquidity mint is the mint; the container is `liquidity.supplyVault`.
 * Resolution (issuer rule `kamino_lend`): a depositor's entitlement is their share of collateral tokens (cTokens)
 * multiplied by the tokens physically in the supply vault at the snapshot:
 *   weight_i = obligation deposits of reserve R (in cTokens), summed per owner, plus cTokens held directly by on-curve wallets
 *   attributed_i = proRata(vaultBalance, [...weights, unenumerated]) where unenumerated = mintTotalSupply − Σ weights
 * Economic exposure through the exchange rate (deposits + borrowed − fees) is recorded as exposureRaw; when the reserve
 * is collateral-only (borrowLimit 0, nothing borrowed) it equals the attributed amount. Borrowers get nothing here.
 *
 * Layout facts verified with @kamino-finance/klend-sdk 12.0.0 decoders on mainnet (scripts/probes/kamino-reserve.ts,
 * 2026-09-14): Reserve lendingMarket@32, liquidity.mintPubkey@128, liquidity.supplyVault@160; Obligation account size
 * = layout.span + 8 = 3344, owner@64, deposits from byte 96 with stride 136 (depositReserve@+0, depositedAmount@+32).
 * 293 obligations deposited exactly the cTokens in the collateral vault; borrowLimit is 0 on the AAPLx reserve.
 */
import { PublicKey } from "@solana/web3.js";
import { Fraction, Obligation, Reserve } from "@kamino-finance/klend-sdk";
import {
  KAMINO_LEND_PROGRAM,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  proRata,
  type Base58,
  type ContainerInfo,
  type EntitlementPosition,
  type PositionAdapter,
  type SnapshotContext
} from "@lookthrough/core";

export const RESERVE_SPAN = 8624;
export const RESERVE_OFFSETS = { lendingMarket: 32, liquidityMint: 128, liquiditySupplyVault: 160 } as const;
export const OBLIGATION_SIZE = (Obligation as unknown as { layout: { span: number } }).layout.span + 8;
export const OBLIGATION_OFFSETS = { lendingMarket: 32, owner: 64, deposits: 96, depositStride: 136, depositSlots: 8 } as const;

const pk = (data: Uint8Array, offset: number) => new PublicKey(data.subarray(offset, offset + 32)).toBase58();

export function lendingMarketAuthority(lendingMarket: string): string {
  return PublicKey.findProgramAddressSync([Buffer.from("lma"), new PublicKey(lendingMarket).toBuffer()], new PublicKey(KAMINO_LEND_PROGRAM))[0].toBase58();
}

export class KaminoLendAdapter implements PositionAdapter {
  readonly id = "kamino_lend";
  readonly status: "implemented" | "stub" = "implemented";

  async discoverContainers(mint: string, ctx: SnapshotContext): Promise<ContainerInfo[]> {
    const reserves = await ctx.reader.getProgramAccounts(
      KAMINO_LEND_PROGRAM,
      [{ dataSize: RESERVE_SPAN }, { memcmp: { offset: RESERVE_OFFSETS.liquidityMint, bytes: mint } }],
      { offset: RESERVE_OFFSETS.lendingMarket, length: 160 }
    );
    const containers = reserves.map((r) => {
      // Some RPCs ignore dataSlice (surfpool for datasource-proxied accounts); detect the full span and read absolute offsets.
      const base = r.data.length >= RESERVE_SPAN ? RESERVE_OFFSETS.lendingMarket : 0;
      const lendingMarket = pk(r.data, base);
      const supplyVault = pk(r.data, base + RESERVE_OFFSETS.liquiditySupplyVault - RESERVE_OFFSETS.lendingMarket);
      return {
        address: supplyVault,
        adapterId: this.id,
        program: KAMINO_LEND_PROGRAM,
        label: "Kamino Lend reserve vault",
        meta: { reserve: r.pubkey, lendingMarket, lendingMarketAuthority: lendingMarketAuthority(lendingMarket) }
      } satisfies ContainerInfo;
    });
    ctx.log.info(`kamino_lend: ${containers.length} reserve vaults hold ${mint.slice(0, 6)}…`);
    return containers;
  }

  async resolve(container: ContainerInfo, mint: string, ctx: SnapshotContext): Promise<EntitlementPosition[]> {
    const reserveId = container.meta.reserve as Base58;
    const lendingMarket = container.meta.lendingMarket as Base58;
    const balance = BigInt(container.meta.balanceRaw as string);
    if (balance === 0n) return [];

    const reserveAcc = await ctx.reader.getAccount(reserveId);
    if (!reserveAcc) throw new Error(`kamino reserve ${reserveId} not found`);
    const reserve = Reserve.decode(Buffer.from(reserveAcc.data));
    const cTokenMint = reserve.collateral.mintPubkey.toString();
    const mintTotalSupply = BigInt(reserve.collateral.mintTotalSupply.toString());
    const collateralVault = reserve.collateral.supplyVault.toString();
    const borrowLimit = BigInt(reserve.config.borrowLimit.toString());
    const availableAmount = BigInt(reserve.liquidity.totalAvailableAmount.toString());
    const borrowedAmount = BigInt(new Fraction(reserve.liquidity.borrowedAmountSf).toDecimal().floor().toFixed(0));
    const collateralOnly = borrowLimit === 0n && borrowedAmount === 0n;

    // 1. Obligations depositing into this reserve (one memcmp per deposit slot, plus the market), summed per owner.
    const weights = new Map<Base58, { cTokens: bigint; obligations: Base58[] }>();
    const seen = new Set<Base58>();
    for (let slot = 0; slot < OBLIGATION_OFFSETS.depositSlots; slot++) {
      const list = await ctx.reader.getProgramAccounts(KAMINO_LEND_PROGRAM, [
        { dataSize: OBLIGATION_SIZE },
        { memcmp: { offset: OBLIGATION_OFFSETS.lendingMarket, bytes: lendingMarket } },
        { memcmp: { offset: OBLIGATION_OFFSETS.deposits + slot * OBLIGATION_OFFSETS.depositStride, bytes: reserveId } }
      ]);
      for (const o of list) {
        if (seen.has(o.pubkey)) continue;
        seen.add(o.pubkey);
        const ob = Obligation.decode(Buffer.from(o.data));
        const owner = ob.owner.toString();
        let c = 0n;
        for (const d of ob.deposits) if (d.depositReserve.toString() === reserveId) c += BigInt(d.depositedAmount.toString());
        if (c === 0n) continue;
        const w = weights.get(owner) ?? { cTokens: 0n, obligations: [] };
        w.cTokens += c;
        w.obligations.push(o.pubkey);
        weights.set(owner, w);
      }
    }

    // 2. cTokens outside obligations: wallet-held count for the wallet; other off-curve holders are unattributed.
    const cTokenProgram = (await ctx.reader.getAccount(cTokenMint))?.owner === TOKEN_2022_PROGRAM ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM;
    const cAccounts = await ctx.reader.getProgramAccounts(cTokenProgram, [{ memcmp: { offset: 0, bytes: cTokenMint } }], { offset: 0, length: 72 });
    let offCurveC = 0n;
    const directHolders: Base58[] = [];
    for (const a of cAccounts) {
      if (a.pubkey === collateralVault) continue;
      const amount = new DataView(a.data.buffer, a.data.byteOffset + 64, 8).getBigUint64(0, true);
      if (amount === 0n) continue;
      const owner = pk(a.data, 32);
      if (PublicKey.isOnCurve(new PublicKey(owner).toBytes())) {
        const w = weights.get(owner) ?? { cTokens: 0n, obligations: [] };
        w.cTokens += amount;
        weights.set(owner, w);
        directHolders.push(a.pubkey);
      } else offCurveC += amount;
    }

    // 3. Pro rata over cToken supply. Weights that are not obligations or wallets stay unattributed.
    const owners = [...weights.entries()];
    const enumerated = owners.reduce((a, [, w]) => a + w.cTokens, 0n) + offCurveC;
    const unenumerated = mintTotalSupply > enumerated ? mintTotalSupply - enumerated : 0n;
    const split = proRata(balance, [...owners.map(([, w]) => w.cTokens), offCurveC, unenumerated]);
    const offCurveRaw = split[owners.length] ?? 0n;
    const unenumeratedRaw = split[owners.length + 1] ?? 0n;
    if (offCurveRaw > 0n) ctx.reportUnattributed({ container: container.address, program: KAMINO_LEND_PROGRAM, label: "Kamino cTokens held by other programs", raw: offCurveRaw });
    if (unenumeratedRaw > 0n) ctx.reportUnattributed({ container: container.address, program: KAMINO_LEND_PROGRAM, label: "Kamino cTokens not held by any enumerated account", raw: unenumeratedRaw });
    ctx.log.info(`kamino_lend: reserve ${reserveId.slice(0, 6)}… ${owners.length} depositors, cToken supply ${mintTotalSupply}, vault ${balance}, collateralOnly=${collateralOnly}`);

    // Exposure via the exchange rate: cTokens × (available + borrowed) / cToken supply. Fees are ignored here on purpose
    // (they are the protocol's, not the depositor's) and the number is labelled as an estimate in the UI.
    const liquidityTotal = availableAmount + borrowedAmount;
    return owners
      .map(([wallet, w], i) => {
        const raw = split[i] ?? 0n;
        const exposure = mintTotalSupply === 0n ? 0n : (w.cTokens * liquidityTotal) / mintTotalSupply;
        return {
          wallet,
          mint,
          source: "kamino_lend",
          container: container.address,
          rawAttributed: raw,
          exposureRaw: exposure,
          ruleApplied: "kamino_lend",
          evidence: {
            reserve: reserveId,
            lendingMarket,
            supplyVault: container.address,
            vaultBalance: balance.toString(),
            cTokenMint,
            cTokenSupply: mintTotalSupply.toString(),
            depositorCTokens: w.cTokens.toString(),
            obligations: w.obligations,
            availableAmount: availableAmount.toString(),
            borrowedAmount: borrowedAmount.toString(),
            borrowLimit: borrowLimit.toString(),
            collateralOnly,
            exposureRaw: exposure.toString()
          }
        } satisfies EntitlementPosition;
      })
      .filter((p) => p.rawAttributed > 0n);
  }
}
