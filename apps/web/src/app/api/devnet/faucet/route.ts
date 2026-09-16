import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { demoInfo, registrarKeypair } from "@lookthrough/registrar";
import { cluster, connection, errorJson, json } from "@/lib/server";

export const dynamic = "force-dynamic";

const SHARES = 10;
const recent = new Map<string, number>();

/** Devnet only: mint 10 demo shares (and a little SOL for fees) to any wallet, once per wallet per 10 minutes. */
export async function POST(req: Request) {
  if (cluster() !== "devnet") return errorJson("The faucet only exists on devnet.", 404);
  const body = (await req.json().catch(() => ({}))) as { wallet?: string };
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(body.wallet ?? "");
  } catch {
    return errorJson("wallet must be a base58 public key");
  }
  const last = recent.get(wallet.toBase58()) ?? 0;
  if (Date.now() - last < 10 * 60_000) return errorJson("This wallet already used the faucet in the last 10 minutes.", 429);
  const info = demoInfo() as { mint: string; multiplier?: number; decimals?: number };
  const mint = new PublicKey(info.mint);
  const registrar = registrarKeypair();
  const conn = connection();
  const ata = getAssociatedTokenAddressSync(mint, wallet, false, TOKEN_2022_PROGRAM_ID);
  const raw = BigInt(Math.ceil((SHARES * 10 ** (info.decimals ?? 8)) / (info.multiplier ?? 1)));
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(registrar.publicKey, ata, wallet, mint, TOKEN_2022_PROGRAM_ID),
    createMintToInstruction(mint, ata, registrar.publicKey, raw, [], TOKEN_2022_PROGRAM_ID)
  );
  const sol = await conn.getBalance(wallet);
  if (sol < 0.01 * LAMPORTS_PER_SOL) tx.add(SystemProgram.transfer({ fromPubkey: registrar.publicKey, toPubkey: wallet, lamports: 0.01 * LAMPORTS_PER_SOL }));
  try {
    const signature = await sendAndConfirmTransaction(conn, tx, [registrar], { commitment: "confirmed" });
    recent.set(wallet.toBase58(), Date.now());
    return json({ signature, shares: SHARES, raw: raw.toString(), solTopUp: sol < 0.01 * LAMPORTS_PER_SOL });
  } catch (err) {
    return errorJson(`faucet transaction failed: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}
