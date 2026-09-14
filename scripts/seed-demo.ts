/**
 * Seed the demo on the fork (idempotent).
 *   Alice: 100 shares of AAPLx: 25 in her wallet, 35 in a Raydium CLMM position, 40 deposited into Kamino.
 *   Bob:    50 shares: 30 in wallet, 20 in a Raydium position.   Carol: 50 shares in her wallet.
 *   The registrar wallet gets USDC (set by the surfnet cheatcode) to fund the demo distribution.
 * Writes .keys/{alice,bob,carol}.json, .keys/registry.json (Phase 2 registry until the program ships) and .keys/demo.json.
 * Everything here is simulated: balances are set by the fork's cheatcode, positions are opened with real protocol instructions.
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, unpackMint, getScaledUiAmountConfig } from "@solana/spl-token";
import BN from "bn.js";
import { Decimal } from "decimal.js";
import { Raydium, TxVersion, TickUtil, PoolInfoLayout } from "@raydium-io/raydium-sdk-v2";
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
import { KaminoAction, KaminoMarket, PROGRAM_ID as KLEND_PROGRAM_ID, VanillaObligation } from "@kamino-finance/klend-sdk";
import { effectiveMultiplier, rawToShares6 } from "@lookthrough/core";

const FORK = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8899";
const FORK_WS = FORK.replace(/^http/, "ws").replace(/:(\d+)$/, (_m, p) => `:${Number(p) + 1}`);
const AAPLX = new PublicKey(process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp");
const POOL = "CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y";
const MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";
const RESERVE = "CKJbqakbPGyhziowm19LPYz636UszuezfkitmpRtcLSH";
const KEYS = ".keys";

const log = (m: string, data?: unknown) => console.log(data === undefined ? m : `${m} ${JSON.stringify(data)}`);

async function cheat(method: string, params: unknown[]) {
  const res = await fetch(FORK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = (await res.json()) as { result?: unknown; error?: unknown };
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

function loadOrCreate(name: string): Keypair {
  const p = `${KEYS}/${name}.json`;
  if (existsSync(p)) return Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(p, "utf8"))));
  const kp = Keypair.generate();
  writeFileSync(p, JSON.stringify([...kp.secretKey]));
  return kp;
}

/** Smallest raw amount whose share equivalent is at least `shares` (6-decimal share units). */
function rawForShares(shares6: bigint, multiplier: string, decimals: number): bigint {
  const raw = BigInt(new Decimal(shares6.toString()).mul(new Decimal(10).pow(decimals - 6)).div(new Decimal(multiplier)).ceil().toFixed(0));
  return rawToShares6(raw, multiplier, decimals) >= shares6 ? raw : raw + 1n;
}

async function setBalance(connection: Connection, owner: Keypair, mint: PublicKey, program: PublicKey, raw: bigint): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner.publicKey, false, program);
  await sendAndConfirmTransaction(connection, new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(owner.publicKey, ata, owner.publicKey, mint, program)), [owner]);
  await cheat("surfnet_setTokenAccount", [owner.publicKey.toBase58(), mint.toBase58(), { amount: Number(raw) }, program.toBase58()]);
  return ata;
}

async function openRaydiumPosition(connection: Connection, owner: Keypair, raw: bigint): Promise<{ tx: string; nftMint: string }> {
  const raydium = await Raydium.load({ connection, owner, disableLoadToken: true, cluster: "mainnet", disableFeatureCheck: true });
  const { poolInfo, poolKeys, computePoolInfo } = await raydium.clmm.getPoolInfoFromRpc(POOL);
  const spacing = poolInfo.config.tickSpacing;
  const current = computePoolInfo.tickCurrent;
  // single-sided range above the current price: only AAPLx is deposited, so Alice's exposure stays in AAPLx
  const lower = TickUtil.toTickIndex(current + 10 * spacing, spacing);
  const upper = TickUtil.toTickIndex(current + 40 * spacing, spacing);
  const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
    poolInfo,
    poolKeys,
    tickLower: lower,
    tickUpper: upper,
    base: "MintA",
    baseAmount: new BN(raw.toString()),
    otherAmountMax: new BN(0),
    liquidity: new BN(0),
    ownerInfo: { useSOLBalance: true },
    nft2022: true,
    txVersion: TxVersion.V0,
    computeBudgetConfig: { units: 600_000, microLamports: 1000 }
  });
  const { txId } = await execute({ sendAndConfirm: true });
  return { tx: txId, nftMint: extInfo.nftMint.toBase58() };
}

async function depositKamino(owner: Keypair, raw: bigint): Promise<{ setupTx: string | null; depositTx: string; obligation: string }> {
  const rpc = createSolanaRpc(FORK);
  const rpcSubscriptions = createSolanaRpcSubscriptions(FORK_WS);
  const signer = await createKeyPairSignerFromBytes(owner.secretKey);
  const market = await KaminoMarket.load(rpc, address(MARKET), 400, KLEND_PROGRAM_ID);
  if (!market) throw new Error("Kamino market not found on the fork");
  const slot = await rpc.getSlot().send();
  const blockTime = (await rpc.getBlockTime(slot).send()) ?? BigInt(Math.floor(Date.now() / 1000));
  const action = await KaminoAction.buildDepositTxns({
    kaminoMarket: market,
    amount: raw.toString(),
    reserveAddress: address(RESERVE),
    owner: signer,
    obligation: new VanillaObligation(KLEND_PROGRAM_ID),
    useV2Ixs: true,
    scopeRefreshConfig: undefined,
    currentLedgerInstant: { slot, blockTime },
    extraComputeBudget: 1_000_000,
    initUserMetadata: { skipInitialization: false, skipLutCreation: true }
  });
  const isRefresh = (l: string) => l.startsWith("Refresh");
  const setup = action.setupIxs.filter((_, i) => !isRefresh(action.setupIxsLabels[i] ?? ""));
  const refresh = action.setupIxs.filter((_, i) => isRefresh(action.setupIxsLabels[i] ?? ""));
  const send = async (ixs: Instruction[]) => {
    const { value: bh } = await rpc.getLatestBlockhash().send();
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
      (m) => appendTransactionMessageInstructions(ixs, m)
    );
    const tx = await signTransactionMessageWithSigners(msg);
    await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(tx, { commitment: "confirmed" });
    return getSignatureFromTransaction(tx) as string;
  };
  const setupTx = setup.length ? await send(setup) : null;
  const depositTx = await send([...refresh, ...action.lendingIxs, ...action.cleanupIxs]);
  const obligationLabel = action.setupIxsLabels.find((l) => l.startsWith("InitObligation")) ?? action.lendingIxsLabels[0] ?? "";
  const obligation = obligationLabel.match(/\[(.+)\]/)?.[1] ?? "";
  return { setupTx, depositTx, obligation };
}

async function main() {
  mkdirSync(KEYS, { recursive: true });
  const connection = new Connection(FORK, "confirmed");
  const slot = await connection.getSlot();
  const mintAcc = await connection.getAccountInfo(AAPLX);
  if (!mintAcc) throw new Error("Couldn't read the AAPLx mint on the fork. Start it with pnpm fork.");
  const mint = unpackMint(AAPLX, mintAcc, TOKEN_2022_PROGRAM_ID);
  const cfg = getScaledUiAmountConfig(mint);
  const blockTime = (await connection.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000);
  const multiplier = effectiveMultiplier(cfg ? { authority: cfg.authority.toBase58(), multiplier: cfg.multiplier, newMultiplier: cfg.newMultiplier, newMultiplierEffectiveTimestamp: cfg.newMultiplierEffectiveTimestamp } : null, blockTime);
  const decimals = mint.decimals;
  log("fork", { slot, multiplier: multiplier.multiplier, source: multiplier.source, decimals });

  // USDC mint = the quote side of the AAPLx/USDC pool (read from the pool state, not hard-coded).
  const poolAcc = await connection.getAccountInfo(new PublicKey(POOL));
  if (!poolAcc) throw new Error("Raydium pool not found on the fork");
  const pool = PoolInfoLayout.decode(poolAcc.data);
  const usdcMint = pool.mintB;
  const usdcProgram = (await connection.getAccountInfo(usdcMint))?.owner ?? TOKEN_PROGRAM_ID;

  const alice = loadOrCreate("alice");
  const bob = loadOrCreate("bob");
  const carol = loadOrCreate("carol");
  const registrar = loadOrCreate("registrar");
  const wallets = { alice, bob, carol, registrar };

  const demoPath = `${KEYS}/demo.json`;
  if (existsSync(demoPath)) {
    const prev = JSON.parse(readFileSync(demoPath, "utf8")) as { alice: { walletRaw: string } };
    const ata = getAssociatedTokenAddressSync(AAPLX, alice.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const bal = await connection.getTokenAccountBalance(ata).catch(() => null);
    if (bal?.value.amount === prev.alice.walletRaw) {
      log("already seeded on this fork, nothing to do", { demo: demoPath });
      return;
    }
  }

  for (const [name, kp] of Object.entries(wallets)) {
    const lamports = await connection.getBalance(kp.publicKey);
    if (lamports < 2_000_000_000) await connection.confirmTransaction(await connection.requestAirdrop(kp.publicKey, 5_000_000_000), "confirmed");
    log(`${name} ${kp.publicKey.toBase58()} funded with SOL`);
  }

  const share = (n: number) => BigInt(n) * 1_000_000n;
  const plan = {
    alice: { wallet: share(25), raydium: share(35), kamino: share(40) },
    bob: { wallet: share(30), raydium: share(20), kamino: 0n },
    carol: { wallet: share(50), raydium: 0n, kamino: 0n }
  } as const;
  const out: Record<string, unknown> = { seededAtSlot: slot, multiplier: multiplier.multiplier, mint: AAPLX.toBase58(), usdcMint: usdcMint.toBase58(), pool: POOL, market: MARKET, reserve: RESERVE, registrar: registrar.publicKey.toBase58() };

  for (const [name, p] of Object.entries(plan)) {
    const kp = wallets[name as keyof typeof wallets];
    const rawWallet = rawForShares(p.wallet, multiplier.multiplier, decimals);
    const rawRaydium = p.raydium ? rawForShares(p.raydium, multiplier.multiplier, decimals) : 0n;
    const rawKamino = p.kamino ? rawForShares(p.kamino, multiplier.multiplier, decimals) : 0n;
    const total = rawWallet + rawRaydium + rawKamino;
    await setBalance(connection, kp, AAPLX, TOKEN_2022_PROGRAM_ID, total);
    const record: Record<string, unknown> = { pubkey: kp.publicKey.toBase58(), totalRaw: total.toString(), walletRaw: rawWallet.toString(), targetShares: (p.wallet + p.raydium + p.kamino).toString() };
    if (rawRaydium) {
      const r = await openRaydiumPosition(connection, kp, rawRaydium);
      record.raydium = { raw: rawRaydium.toString(), ...r };
      log(`${name}: Raydium position opened`, r);
    }
    if (rawKamino) {
      const k = await depositKamino(kp, rawKamino);
      record.kamino = { raw: rawKamino.toString(), ...k };
      log(`${name}: Kamino deposit done`, k);
    }
    const bal = await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(AAPLX, kp.publicKey, false, TOKEN_2022_PROGRAM_ID));
    record.walletRawAfter = bal.value.amount;
    out[name] = record;
    log(`${name}: wallet holds ${bal.value.amount} raw (${rawToShares6(BigInt(bal.value.amount), multiplier.multiplier, decimals)} micro-shares)`);
  }

  // Demo USDC for the registrar (the distribution is funded by this demo wallet, not by any issuer).
  await setBalance(connection, registrar, usdcMint, new PublicKey(usdcProgram), 1_000_000_000_000n);
  out.registrarUsdcRaw = "1000000000000";

  // The cheatcode sets balances without minting, so raise the mint's recorded supply by the seeded total.
  // Otherwise the resolver's supply check would (correctly) report that token accounts exceed supply.
  const seededRaw = Object.values(plan).reduce((a, p) => a + rawForShares(p.wallet + p.raydium + p.kamino, multiplier.multiplier, decimals), 0n);
  const mintNow = await connection.getAccountInfo(AAPLX);
  if (!mintNow) throw new Error("mint vanished");
  const data = Buffer.from(mintNow.data);
  const supplyBefore = data.readBigUInt64LE(36); // spl Mint layout: supply at offset 36
  data.writeBigUInt64LE(supplyBefore + seededRaw, 36);
  await cheat("surfnet_setAccount", [AAPLX.toBase58(), { data: data.toString("hex") }]);
  const mintAfter = unpackMint(AAPLX, (await connection.getAccountInfo(AAPLX))!, TOKEN_2022_PROGRAM_ID);
  out.mintSupply = { before: supplyBefore.toString(), seededRaw: seededRaw.toString(), after: mintAfter.supply.toString() };
  log("mint supply raised by the seeded total", out.mintSupply);
  writeFileSync(`${KEYS}/registry.json`, JSON.stringify([alice.publicKey.toBase58(), bob.publicKey.toBase58(), carol.publicKey.toBase58()], null, 2));
  writeFileSync(demoPath, JSON.stringify(out, null, 2));
  log("seed complete", { demo: demoPath, registry: `${KEYS}/registry.json` });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
