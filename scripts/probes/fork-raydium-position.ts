/**
 * Probe on the fork: fund a throwaway wallet with AAPLx (real ATA first, then the surfnet cheatcode sets the amount),
 * open a single-sided Raydium CLMM position above the current price with raydium-sdk-v2, and read it back.
 * Records: whether Token-2022 CPIs accept the seeded account, the position NFT program, and the decoded amounts.
 * Usage: pnpm tsx scripts/probes/fork-raydium-position.ts
 */
import "dotenv/config";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import Decimal from "decimal.js";
import { Raydium, TxVersion, TickUtil, PersonalPositionLayout, getPdaPersonalPositionAddress, CLMM_PROGRAM_ID, LiquidityMathUtil } from "@raydium-io/raydium-sdk-v2";

const FORK = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8899";
const AAPLX = new PublicKey("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp");
const POOL = "CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y";

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(FORK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = (await res.json()) as { result?: unknown; error?: unknown };
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const connection = new Connection(FORK, "confirmed");
  const wallet = Keypair.generate();
  const sig = await connection.requestAirdrop(wallet.publicKey, 5_000_000_000);
  await connection.confirmTransaction(sig, "confirmed");

  // 1. Real ATA (with the extensions the mint requires), then set the balance with the cheatcode.
  const ata = getAssociatedTokenAddressSync(AAPLX, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
  await sendAndConfirmTransaction(connection, new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, wallet.publicKey, AAPLX, TOKEN_2022_PROGRAM_ID)), [wallet]);
  const sizeBefore = (await connection.getAccountInfo(ata))?.data.length;
  const rawAmount = 10_000_000_000n; // 100 raw AAPLx units at 8 decimals
  await rpc("surfnet_setTokenAccount", [wallet.publicKey.toBase58(), AAPLX.toBase58(), { amount: Number(rawAmount) }, TOKEN_2022_PROGRAM_ID.toBase58()]);
  const after = await connection.getAccountInfo(ata);
  const bal = await connection.getTokenAccountBalance(ata);
  console.log("seeded", { ata: ata.toBase58(), sizeBefore, sizeAfter: after?.data.length, amount: bal.value.amount });

  // 2. Open a single-sided position above the current price (only mintA = AAPLx is deposited).
  const raydium = await Raydium.load({ connection, owner: wallet, disableLoadToken: true, cluster: "mainnet", disableFeatureCheck: true });
  const { poolInfo, poolKeys, computePoolInfo } = await raydium.clmm.getPoolInfoFromRpc(POOL);
  const tickSpacing = poolInfo.config.tickSpacing;
  const current = computePoolInfo.tickCurrent;
  const lower = TickUtil.toTickIndex(current + 10 * tickSpacing, tickSpacing);
  const upper = TickUtil.toTickIndex(current + 40 * tickSpacing, tickSpacing);
  const baseAmount = new BN((rawAmount / 2n).toString());
  console.log("pool", { price: poolInfo.price, tickCurrent: current, tickSpacing, lower, upper, mintA: poolInfo.mintA.address, mintAProgram: poolInfo.mintA.programId });

  const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
    poolInfo,
    poolKeys,
    tickLower: lower,
    tickUpper: upper,
    base: "MintA",
    baseAmount,
    otherAmountMax: new BN(0),
    liquidity: new BN(0),
    ownerInfo: { useSOLBalance: true },
    nft2022: true,
    txVersion: TxVersion.V0,
    computeBudgetConfig: { units: 600_000, microLamports: 1000 }
  });
  const { txId } = await execute({ sendAndConfirm: true });
  const nftMint = extInfo.nftMint;
  console.log("position opened", { txId, nftMint: nftMint.toBase58() });

  // 3. Read it back and reproduce the amount with the same math the adapter uses.
  const posAddr = getPdaPersonalPositionAddress(CLMM_PROGRAM_ID, nftMint).publicKey;
  const posAcc = await connection.getAccountInfo(posAddr);
  if (!posAcc) throw new Error("position account not found");
  const pos = PersonalPositionLayout.decode(posAcc.data);
  const { amountA, amountB } = LiquidityMathUtil.getAmountsForLiquidity(computePoolInfo.sqrtPriceX64, TickUtil.getSqrtPriceAtTick(pos.tickLower), TickUtil.getSqrtPriceAtTick(pos.tickUpper), pos.liquidity, false);
  // the adapter finds NFT holders with a memcmp on the mint at offset 0; check the fork answers that for a locally created NFT
  const nftAcc = (await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: nftMint.toBase58() } }], dataSlice: { offset: 0, length: 72 } }))[0];
  const remaining = await connection.getTokenAccountBalance(ata);
  console.log("readback", {
    position: posAddr.toBase58(),
    liquidity: pos.liquidity.toString(),
    amountA: amountA.toString(),
    amountB: amountB.toString(),
    deposited: baseAmount.toString(),
    walletRemaining: remaining.value.amount,
    nftTokenAccount: nftAcc?.pubkey.toBase58(),
    nftHolder: nftAcc ? new PublicKey(nftAcc.account.data.subarray(32, 64)).toBase58() : null,
    holderIsWallet: nftAcc ? new PublicKey(nftAcc.account.data.subarray(32, 64)).equals(wallet.publicKey) : null,
    dustVsDeposit: new Decimal(baseAmount.toString()).sub(amountA.toString()).toString()
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
