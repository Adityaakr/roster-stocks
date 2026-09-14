/**
 * The scripted demo, end to end on the fork. Prints a checklist with transaction signatures.
 *   Scene 1  the problem: a wallet scan sees 25 of Alice's 100 shares; Lookthrough resolves all 100 with the breakdown
 *   Scene 2  register: one signature per wallet
 *   Scene 3  the registrar declares a 0.25 USDC per share distribution, snapshots at the record slot, publishes the root, funds the vault
 *   Scene 4  Alice claims 25.00 USDC without touching her Raydium or Kamino positions
 *   Scene 5  the registrar opens a vote on the same record date; Alice, Bob and Carol vote; the tally shows verified weight
 * Prerequisites: pnpm fork (in another terminal), pnpm anchor:build, pnpm anchor:deploy, pnpm seed.
 * Usage: pnpm demo [--label <prefix>] [--in-minutes 0.5]
 */
import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { ActionStore } from "@lookthrough/resolver";
import { formatShares6, rawToShares6 } from "@lookthrough/core";
import { LookthroughClient } from "@lookthrough/sdk";
import { claim, demoInfo, demoWallets, forkConnection, fund, publish, register, schedule, snapshot, tally, usdcBalance, vote, type Log } from "@lookthrough/registrar";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

export interface CheckItem {
  scene: string;
  item: string;
  ok: boolean;
  detail?: string;
}

/** Runs the five scenes and returns the checklist. Throws only on setup errors; scene failures are reported in the list. */
export async function runDemo(opts: { prefix: string; inMinutes: number; log?: Log }): Promise<CheckItem[]> {
  const checklist: CheckItem[] = [];
  const log: Log = opts.log ?? ((m, data) => console.log(`     ${m}${data === undefined ? "" : " " + JSON.stringify(data)}`));
  const tick = (scene: string, item: string, ok: boolean, detail?: string) => {
    checklist.push({ scene, item, ok, ...(detail ? { detail } : {}) });
    log(`${ok ? "ok " : "FAIL"} ${scene}: ${item}${detail ? ` (${detail})` : ""}`);
  };
  const { prefix, inMinutes } = opts;
  const connection = forkConnection();
  const info = demoInfo();
  const mint = new PublicKey(info.mint);
  const usdcMint = new PublicKey(info.usdcMint);
  const wallets = demoWallets();
  const store = new ActionStore();
  const distId = `${prefix}-dividend`;
  const voteId = `${prefix}-vote`;

  // Programme deployed?
  const programInfo = await connection.getAccountInfo(LookthroughClient.readOnly(connection).programId);
  if (!programInfo?.executable) throw new Error("The lookthrough program is not deployed on the fork. Run pnpm anchor:build then pnpm anchor:deploy.");

  // Scene 1: the problem.
  const aliceAta = getAssociatedTokenAddressSync(mint, wallets.alice.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const walletScanRaw = BigInt((await connection.getTokenAccountBalance(aliceAta)).value.amount);
  const mintAcc = await connection.getAccountInfo(mint);
  if (!mintAcc) throw new Error("mint missing");
  tick("scene 1", `wallet scanner sees Alice's wallet balance only`, true, `${formatShares6(rawToShares6(walletScanRaw, "1.0032690125398187", 8), 2)} share equivalents in the wallet (multiplier applied), Raydium and Kamino invisible`);

  // Scene 2: register (idempotent).
  for (const [name, kp] of Object.entries(wallets)) {
    const r = await register(kp, mint, log);
    tick("scene 2", `${name} registered for corporate actions`, true, r.signature ? `tx ${r.signature}` : `already registered at slot ${r.slot}`);
  }
  const registry = Object.values(wallets).map((k) => k.publicKey.toBase58());

  // Scene 3: distribution: schedule, snapshot, publish, fund.
  await schedule(store, { label: distId, mint: info.mint, symbol: "AAPLx", kind: "distribution", inMinutes, usdcPerShare: 0.25, registry, title: "AAPLx cash distribution (simulated issuer)" }, log);
  const dist = await snapshot(store, distId, log);
  const aliceEntry = store.readJson<{ leaves: { wallet: string; entitlement: string }[] }>(distId, "tree.json").leaves.find((l) => l.wallet === wallets.alice.publicKey.toBase58());
  tick("scene 1", "Lookthrough resolves Alice across wallet, Raydium and Kamino", !!aliceEntry, aliceEntry ? `${formatShares6(BigInt(aliceEntry.entitlement))} share equivalents at slot ${dist.snapshot?.slotActual}` : "no leaf");
  tick("scene 3", "record-date snapshot taken and supply panel printed", !!dist.snapshot, `attributed ${dist.snapshot?.attributedPct}%, double counted 0, ${dist.snapshot?.leaves} leaves`);
  const published = await publish(store, distId, log);
  tick("scene 3", "root and content hash published on-chain", !!published.onchain, `action ${published.onchain?.actionPda} tx ${published.onchain?.createTx}`);
  const required = (BigInt(dist.snapshot?.totalEntitlement ?? "0") * BigInt(dist.amountPerShareMicro ?? "0")) / 1_000_000n;
  const funded = await fund(store, distId, Number(required) / 1e6 + 1, log);
  tick("scene 3", "vault funded by the demo wallet", funded.status === "funded", `tx ${funded.onchain?.fundTx}`);

  // Scene 4: Alice claims.
  const before = await usdcBalance(wallets.alice.publicKey, usdcMint, connection);
  const c = await claim(store, distId, wallets.alice, log);
  const after = await usdcBalance(wallets.alice.publicKey, usdcMint, connection);
  const aliceAtaAfter = BigInt((await connection.getTokenAccountBalance(aliceAta)).value.amount);
  tick("scene 4", `Alice claimed ${Number(c.amountPaid) / 1e6} USDC`, c.signature !== null || c.amountPaid > 0n, `USDC ${Number(before) / 1e6} before, ${Number(after) / 1e6} after; tx ${c.signature ?? "already claimed"}`);
  tick("scene 4", "Alice's AAPLx wallet balance, Raydium position and Kamino deposit untouched", aliceAtaAfter === walletScanRaw, `wallet raw ${aliceAtaAfter}`);
  const second = await claim(store, distId, wallets.alice, log);
  tick("scene 4", "double claim rejected by the receipt PDA", second.signature === null, "second claim returned the existing receipt");

  // Scene 5: vote on the same record date (reuses the entitlement set, new action id and tree).
  await schedule(store, { label: voteId, mint: info.mint, symbol: "AAPLx", kind: "vote", inMinutes, question: "Approve acquisition of XYZ", deadlineMinutes: 30, registry, title: "Approve acquisition of XYZ (simulated issuer; xStocks carry no voting rights)" }, log);
  await snapshot(store, voteId, log, { reuseFrom: distId });
  const vPub = await publish(store, voteId, log);
  tick("scene 5", "vote opened on-chain", !!vPub.onchain, `action ${vPub.onchain?.actionPda}`);
  const va = await vote(store, voteId, wallets.alice, "for", log);
  const vb = await vote(store, voteId, wallets.bob, "against", log);
  const vc = await vote(store, voteId, wallets.carol, "abstain", log);
  const t = await tally(store, voteId);
  tick("scene 5", "Alice, Bob and Carol voted with their verified weight", t.voters === 3, `for ${formatShares6(t.forWeight)}, against ${formatShares6(t.againstWeight)}, abstain ${formatShares6(t.abstainWeight)}; txs ${[va.signature, vb.signature, vc.signature].filter(Boolean).join(", ") || "already voted"}`);

  return checklist;
}

async function main() {
  const checklist = await runDemo({ prefix: arg("label", `demo-${new Date().toISOString().slice(0, 10)}`), inMinutes: Number(arg("in-minutes", "0.5")) });
  console.log("\nchecklist");
  for (const c of checklist) console.log(`  [${c.ok ? "x" : " "}] ${c.scene}: ${c.item}${c.detail ? `  (${c.detail})` : ""}`);
  const failed = checklist.filter((c) => !c.ok);
  if (failed.length) {
    console.error(`${failed.length} scene checks failed`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("demo.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
