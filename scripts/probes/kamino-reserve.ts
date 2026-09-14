/**
 * Probe: decode the Kamino AAPLx reserve and every obligation depositing into it, without the kit RPC,
 * and check the cToken accounting: sum(obligation.depositedAmount) + wallet-held cTokens vs cToken supply,
 * and supply vault balance vs liquidity.availableAmount. Verifies the byte offsets used by the adapter
 * against the SDK's own decoders.
 * Usage: pnpm tsx scripts/probes/kamino-reserve.ts [reserve]
 */
import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import { Reserve, Obligation } from "@kamino-finance/klend-sdk";
import { RpcReader, rpcUrlsFromEnv } from "@lookthrough/datasources";
import { KAMINO_LEND_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM } from "@lookthrough/core";

const reserveId = process.argv[2] ?? "CKJbqakbPGyhziowm19LPYz636UszuezfkitmpRtcLSH";
const OBLIGATION_DEPOSITS_OFFSET = 96;
const OBLIGATION_DEPOSIT_STRIDE = 136;

async function main() {
  const urls = rpcUrlsFromEnv();
  const reader = new RpcReader({ url: urls.mainnet, fallbackUrl: urls.mainnetFallback, logger: (m) => console.error(`[rpc] ${m}`) });
  const acc = await reader.getAccount(reserveId);
  if (!acc) throw new Error("reserve not found");
  const reserve = Reserve.decode(Buffer.from(acc.data));
  const supplyVault = reserve.liquidity.supplyVault.toString();
  const cTokenMint = reserve.collateral.mintPubkey.toString();
  const vaultAcc = await reader.getAccount(supplyVault);
  if (!vaultAcc) throw new Error("supply vault not found");
  const vaultBalance = new DataView(vaultAcc.data.buffer, vaultAcc.data.byteOffset + 64, 8).getBigUint64(0, true);
  const vaultOwner = new PublicKey(vaultAcc.data.subarray(32, 64)).toBase58();

  // raw offsets in the reserve account
  const raw = Buffer.from(acc.data);
  const at = (o: number) => new PublicKey(raw.subarray(o, o + 32)).toBase58();
  console.log("reserve offsets check", {
    size: raw.length,
    lendingMarketAt32: at(32) === reserve.lendingMarket.toString(),
    liquidityMintAt128: at(128) === reserve.liquidity.mintPubkey.toString(),
    supplyVaultAt160: at(160) === supplyVault
  });

  // obligations depositing into this reserve: one memcmp per deposit slot
  const obligationSize = (Obligation as unknown as { layout: { span: number } }).layout.span + 8;
  const found = new Map<string, Uint8Array>();
  for (let slot = 0; slot < 8; slot++) {
    const list = await reader.getProgramAccounts(KAMINO_LEND_PROGRAM, [{ dataSize: obligationSize }, { memcmp: { offset: OBLIGATION_DEPOSITS_OFFSET + slot * OBLIGATION_DEPOSIT_STRIDE, bytes: reserveId } }]);
    for (const o of list) found.set(o.pubkey, o.data);
  }
  let depositedSum = 0n;
  let offsetsAgree = true;
  const owners = new Map<string, bigint>();
  for (const [pk, data] of found) {
    const ob = Obligation.decode(Buffer.from(data));
    const owner = ob.owner.toString();
    for (let i = 0; i < ob.deposits.length; i++) {
      const d = ob.deposits[i];
      if (!d || d.depositReserve.toString() !== reserveId) continue;
      const amt = BigInt(d.depositedAmount.toString());
      depositedSum += amt;
      owners.set(owner, (owners.get(owner) ?? 0n) + amt);
      const rawReserve = new PublicKey(Buffer.from(data).subarray(OBLIGATION_DEPOSITS_OFFSET + i * OBLIGATION_DEPOSIT_STRIDE, OBLIGATION_DEPOSITS_OFFSET + i * OBLIGATION_DEPOSIT_STRIDE + 32)).toBase58();
      const rawAmt = Buffer.from(data).readBigUInt64LE(OBLIGATION_DEPOSITS_OFFSET + i * OBLIGATION_DEPOSIT_STRIDE + 32);
      const rawOwner = new PublicKey(Buffer.from(data).subarray(64, 96)).toBase58();
      if (rawReserve !== reserveId || rawAmt !== amt || rawOwner !== owner) offsetsAgree = false;
    }
    void pk;
  }

  // cTokens held outside obligations
  const cAccounts = await reader.getProgramAccounts(TOKEN_PROGRAM, [{ memcmp: { offset: 0, bytes: cTokenMint } }], { offset: 0, length: 72 });
  let walletC = 0n;
  let otherC = 0n;
  let collateralVaultC = 0n;
  const collateralSupplyVault = reserve.collateral.supplyVault.toString();
  for (const a of cAccounts) {
    const owner = new PublicKey(a.data.subarray(32, 64)).toBase58();
    const amt = new DataView(a.data.buffer, a.data.byteOffset + 64, 8).getBigUint64(0, true);
    if (a.pubkey === collateralSupplyVault) collateralVaultC += amt;
    else if (PublicKey.isOnCurve(new PublicKey(owner).toBytes())) walletC += amt;
    else otherC += amt;
  }

  console.log(
    JSON.stringify(
      {
        reserveId,
        lendingMarket: reserve.lendingMarket.toString(),
        liquidityMint: reserve.liquidity.mintPubkey.toString(),
        supplyVault,
        supplyVaultOwner: vaultOwner,
        vaultBalance: vaultBalance.toString(),
        availableAmount: String(reserve.liquidity.availableAmount),
        borrowedAmountSf: String(reserve.liquidity.borrowedAmountSf),
        borrowLimit: String(reserve.config.borrowLimit),
        configKeys: Object.keys(reserve.config).slice(0, 12),
        collateralKeys: Object.keys(reserve.collateral),
        cTokenMint,
        cTokenMintOwner: (await reader.getAccount(cTokenMint))?.owner === TOKEN_2022_PROGRAM ? "token-2022" : "spl-token",
        cTokenMintTotalSupply: String(reserve.collateral.mintTotalSupply),
        obligationSize,
        obligationsFound: found.size,
        depositorsDistinct: owners.size,
        depositedSum: depositedSum.toString(),
        collateralVaultC: collateralVaultC.toString(),
        walletHeldC: walletC.toString(),
        otherOffCurveC: otherC.toString(),
        cAccounts: cAccounts.length,
        offsetsAgreeWithSdk: offsetsAgree,
        top3Depositors: [...owners.entries()].sort((a, b) => (a[1] > b[1] ? -1 : 1)).slice(0, 3).map(([o, a]) => [o, a.toString()])
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
