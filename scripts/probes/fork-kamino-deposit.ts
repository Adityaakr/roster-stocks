/**
 * Probe on the fork: deposit AAPLx into the Kamino xStocks market reserve with @kamino-finance/klend-sdk 12 (kit 2.3.0),
 * then read the obligation back and check the adapter's cToken accounting reproduces the deposit.
 * Usage: pnpm tsx scripts/probes/fork-kamino-deposit.ts
 */
import "dotenv/config";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction
} from "@solana/kit";
import { KaminoAction, KaminoMarket, PROGRAM_ID, VanillaObligation, Obligation, Reserve } from "@kamino-finance/klend-sdk";

const FORK = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8899";
const FORK_WS = FORK.replace("http", "ws").replace("8899", "8900");
const AAPLX = new PublicKey("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp");
const MARKET = address("5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua");
const RESERVE = address("CKJbqakbPGyhziowm19LPYz636UszuezfkitmpRtcLSH");

async function cheat(method: string, params: unknown[]) {
  const res = await fetch(FORK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = (await res.json()) as { result?: unknown; error?: unknown };
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const connection = new Connection(FORK, "confirmed");
  const wallet = Keypair.generate();
  await connection.confirmTransaction(await connection.requestAirdrop(wallet.publicKey, 5_000_000_000), "confirmed");
  const ata = getAssociatedTokenAddressSync(AAPLX, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
  await sendAndConfirmTransaction(connection, new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, wallet.publicKey, AAPLX, TOKEN_2022_PROGRAM_ID)), [wallet]);
  const rawAmount = 4_000_000_000n; // 40 raw AAPLx units at 8 decimals
  await cheat("surfnet_setTokenAccount", [wallet.publicKey.toBase58(), AAPLX.toBase58(), { amount: Number(rawAmount) }, TOKEN_2022_PROGRAM_ID.toBase58()]);

  const rpc = createSolanaRpc(FORK);
  const rpcSubscriptions = createSolanaRpcSubscriptions(FORK_WS);
  const signer = await createKeyPairSignerFromBytes(wallet.secretKey);
  const market = await KaminoMarket.load(rpc, MARKET, 400, PROGRAM_ID);
  if (!market) throw new Error("market not found");
  const reserve = market.getReserveByAddress(RESERVE);
  if (!reserve) throw new Error("reserve not found");
  console.log("reserve", { symbol: reserve.symbol, liquidityMint: reserve.getLiquidityMint(), cToken: reserve.getCTokenMint(), borrowLimit: reserve.state.config.borrowLimit.toString(), available: reserve.getLiquidityAvailableAmount().toString() });

  const slot = await rpc.getSlot().send();
  const blockTime = (await rpc.getBlockTime(slot).send()) ?? BigInt(Math.floor(Date.now() / 1000));
  const action = await KaminoAction.buildDepositTxns({
    kaminoMarket: market,
    amount: rawAmount.toString(),
    reserveAddress: RESERVE,
    owner: signer,
    obligation: new VanillaObligation(PROGRAM_ID),
    useV2Ixs: true,
    scopeRefreshConfig: undefined,
    currentLedgerInstant: { slot, blockTime },
    extraComputeBudget: 1_000_000,
    initUserMetadata: { skipInitialization: false, skipLutCreation: true }
  });
  console.log("ixs", { setup: action.setupIxsLabels, lending: action.lendingIxsLabels, cleanup: action.cleanupIxsLabels, luts: action.luts });
  // Two transactions: account setup first, then refreshes plus the deposit (refreshes must sit next to the deposit).
  const isRefresh = (label: string) => label.startsWith("Refresh");
  const setup = action.setupIxs.filter((_, i) => !isRefresh(action.setupIxsLabels[i] ?? ""));
  const refresh = action.setupIxs.filter((_, i) => isRefresh(action.setupIxsLabels[i] ?? ""));
  const send = async (ixs: Instruction[], label: string) => {
    const { value: bh } = await rpc.getLatestBlockhash().send();
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
      (m) => appendTransactionMessageInstructions(ixs, m)
    );
    const tx = await signTransactionMessageWithSigners(msg);
    await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(tx, { commitment: "confirmed" });
    console.log(`${label} sent`, { sig: getSignatureFromTransaction(tx), ixs: ixs.length });
  };
  if (setup.length) await send(setup, "setup");
  await send([...refresh, ...action.lendingIxs, ...action.cleanupIxs], "deposit");

  // Read back: the obligation for this wallet and its deposit in cTokens; the reserve vault delta.
  const obligations = await market.getAllUserObligations(signer.address, { slot, blockTime });
  const reserveAfter = Reserve.decode(Buffer.from((await connection.getAccountInfo(new PublicKey(RESERVE)))!.data));
  for (const ob of obligations) {
    const raw = Obligation.decode(Buffer.from((await connection.getAccountInfo(new PublicKey(ob.obligationAddress)))!.data));
    const dep = raw.deposits.find((d) => d.depositReserve.toString() === RESERVE);
    console.log("obligation", {
      address: ob.obligationAddress,
      depositedCTokens: dep?.depositedAmount.toString(),
      cTokenSupplyAfter: reserveAfter.collateral.mintTotalSupply.toString(),
      supplyVaultBalanceAfter: (await connection.getTokenAccountBalance(new PublicKey(reserveAfter.liquidity.supplyVault.toString()))).value.amount,
      attributedByRule: dep ? ((BigInt(dep.depositedAmount.toString()) * BigInt((await connection.getTokenAccountBalance(new PublicKey(reserveAfter.liquidity.supplyVault.toString()))).value.amount)) / BigInt(reserveAfter.collateral.mintTotalSupply.toString())).toString() : null,
      deposited: rawAmount.toString()
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
