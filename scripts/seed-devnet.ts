/**
 * Devnet seed. Creates what the mainnet fork gets for free from real state:
 *   a Token-2022 demo stock mint (decimals 8, scaled UI amount extension, multiplier like AAPLx),
 *   a test USDC mint (6 decimals), Alice, Bob and Carol with SOL and demo shares,
 *   and the registrar (the devnet deployer) holding test USDC to fund distributions.
 * Writes .keys/devnet/{demo,registry}.json. Idempotent: re-running reuses the recorded mints.
 *
 * Usage: LOOKTHROUGH_ENV=devnet pnpm seed:devnet   (reads .env.devnet)
 * Nothing here looks through DeFi: Raydium and Kamino positions for these mints do not exist on devnet.
 */
import "./env-load";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createInitializeScaledUiAmountConfigInstruction,
  createMintToInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMintLen,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { Decimal } from "decimal.js";
const KEYS = process.env.LOOKTHROUGH_KEYS_DIR ?? ".keys/devnet";
const RPC = process.env.FORK_RPC_URL ?? "https://api.devnet.solana.com";
const MULTIPLIER = 1.0032690125398187; // AAPLx's newMultiplier on 2026-09-14, so the share maths matches the mainnet demo
const DECIMALS = 8;

const log = (m: string, data?: unknown) => console.log(`[seed:devnet] ${m}${data === undefined ? "" : " " + JSON.stringify(data)}`);

function loadOrCreate(name: string): Keypair {
  const p = `${KEYS}/${name}.json`;
  if (existsSync(p)) return Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(p, "utf8"))));
  const kp = Keypair.generate();
  writeFileSync(p, JSON.stringify([...kp.secretKey]));
  return kp;
}

/** Raw units so that raw × multiplier / 10^decimals is at least `shares`. */
function rawForShares(shares: number): bigint {
  return BigInt(new Decimal(shares).mul(new Decimal(10).pow(DECIMALS)).div(MULTIPLIER).ceil().toFixed(0));
}

async function main() {
  mkdirSync(KEYS, { recursive: true });
  const connection = new Connection(RPC, "confirmed");
  const registrarPath = process.env.REGISTRAR_KEYPAIR_PATH ?? `${KEYS}/registrar.json`;
  if (!existsSync(registrarPath)) throw new Error(`registrar keypair missing at ${registrarPath}; copy the funded devnet deployer there`);
  const registrar = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(registrarPath, "utf8"))));
  const bal = await connection.getBalance(registrar.publicKey);
  log("registrar", { pubkey: registrar.publicKey.toBase58(), sol: bal / LAMPORTS_PER_SOL });
  if (bal < 0.5 * LAMPORTS_PER_SOL) throw new Error("registrar needs at least 0.5 SOL on devnet");

  const demoPath = `${KEYS}/demo.json`;
  const prev = existsSync(demoPath) ? (JSON.parse(readFileSync(demoPath, "utf8")) as { mint?: string; usdcMint?: string }) : {};

  // Demo stock mint (Token-2022, scaled UI amount).
  let mint: PublicKey;
  if (prev.mint && (await connection.getAccountInfo(new PublicKey(prev.mint)))) {
    mint = new PublicKey(prev.mint);
    log("reusing demo stock mint", mint.toBase58());
  } else {
    const kp = Keypair.generate();
    const len = getMintLen([ExtensionType.ScaledUiAmountConfig]);
    const lamports = await connection.getMinimumBalanceForRentExemption(len);
    const tx = new Transaction().add(
      SystemProgram.createAccount({ fromPubkey: registrar.publicKey, newAccountPubkey: kp.publicKey, space: len, lamports, programId: TOKEN_2022_PROGRAM_ID }),
      createInitializeScaledUiAmountConfigInstruction(kp.publicKey, registrar.publicKey, MULTIPLIER, TOKEN_2022_PROGRAM_ID),
      createInitializeMint2Instruction(kp.publicKey, DECIMALS, registrar.publicKey, null, TOKEN_2022_PROGRAM_ID)
    );
    await sendAndConfirmTransaction(connection, tx, [registrar, kp]);
    mint = kp.publicKey;
    log("created demo stock mint", { mint: mint.toBase58(), multiplier: MULTIPLIER, decimals: DECIMALS });
  }

  // Test USDC (classic SPL, 6 decimals).
  let usdcMint: PublicKey;
  if (prev.usdcMint && (await connection.getAccountInfo(new PublicKey(prev.usdcMint)))) {
    usdcMint = new PublicKey(prev.usdcMint);
    log("reusing test USDC mint", usdcMint.toBase58());
  } else {
    const kp = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const tx = new Transaction().add(
      SystemProgram.createAccount({ fromPubkey: registrar.publicKey, newAccountPubkey: kp.publicKey, space: MINT_SIZE, lamports, programId: TOKEN_PROGRAM_ID }),
      createInitializeMint2Instruction(kp.publicKey, 6, registrar.publicKey, null, TOKEN_PROGRAM_ID)
    );
    await sendAndConfirmTransaction(connection, tx, [registrar, kp]);
    usdcMint = kp.publicKey;
    log("created test USDC mint", usdcMint.toBase58());
  }

  // Registrar's USDC for funding distributions.
  const regUsdc = getAssociatedTokenAddressSync(usdcMint, registrar.publicKey, false, TOKEN_PROGRAM_ID);
  const regUsdcBal = await connection.getTokenAccountBalance(regUsdc).catch(() => null);
  if (!regUsdcBal || BigInt(regUsdcBal.value.amount) < 100_000_000_000n) {
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(registrar.publicKey, regUsdc, registrar.publicKey, usdcMint, TOKEN_PROGRAM_ID),
      createMintToInstruction(usdcMint, regUsdc, registrar.publicKey, 1_000_000_000_000n, [], TOKEN_PROGRAM_ID)
    );
    await sendAndConfirmTransaction(connection, tx, [registrar]);
    log("minted 1,000,000 test USDC to the registrar");
  }

  // Demo wallets: a little SOL for fees and their demo shares.
  const plan: Record<string, number> = { alice: 100, bob: 60, carol: 15 };
  const out: Record<string, unknown> = { cluster: "devnet", mint: mint.toBase58(), usdcMint: usdcMint.toBase58(), registrar: registrar.publicKey.toBase58(), multiplier: MULTIPLIER, decimals: DECIMALS };
  const registry: string[] = [];
  for (const [name, shares] of Object.entries(plan)) {
    const kp = loadOrCreate(name);
    registry.push(kp.publicKey.toBase58());
    const sol = await connection.getBalance(kp.publicKey);
    const ata = getAssociatedTokenAddressSync(mint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const cur = await connection.getTokenAccountBalance(ata).catch(() => null);
    const raw = rawForShares(shares);
    const tx = new Transaction();
    if (sol < 0.02 * LAMPORTS_PER_SOL) tx.add(SystemProgram.transfer({ fromPubkey: registrar.publicKey, toPubkey: kp.publicKey, lamports: 0.03 * LAMPORTS_PER_SOL }));
    if (!cur || BigInt(cur.value.amount) < raw) {
      tx.add(createAssociatedTokenAccountIdempotentInstruction(registrar.publicKey, ata, kp.publicKey, mint, TOKEN_2022_PROGRAM_ID));
      tx.add(createMintToInstruction(mint, ata, registrar.publicKey, raw - BigInt(cur?.value.amount ?? "0"), [], TOKEN_2022_PROGRAM_ID));
    }
    if (tx.instructions.length) await sendAndConfirmTransaction(connection, tx, [registrar]);
    const after = await connection.getTokenAccountBalance(ata);
    out[name] = { pubkey: kp.publicKey.toBase58(), walletRaw: after.value.amount, shares };
    log(`${name}: ${after.value.amount} raw (${shares} shares), ${((await connection.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
  }
  writeFileSync(`${KEYS}/registry.json`, JSON.stringify(registry, null, 2));
  writeFileSync(demoPath, JSON.stringify(out, null, 2));
  log("seed complete", { demo: demoPath });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
