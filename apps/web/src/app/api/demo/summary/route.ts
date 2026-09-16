import { Keypair } from "@solana/web3.js";
import { resolveWallet } from "@lookthrough/resolver";
import { LookthroughClient } from "@lookthrough/sdk";
import { proofFor } from "@lookthrough/registrar";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { connection, forkReachable, json, reader, repoRoot, store } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * The numbers behind the landing page's product card: Alice's live ledger on the fork plus the latest
 * distribution and vote. Falls back to the last demo run's action records when the fork is down, and says so.
 */
export async function GET() {
  const demoPath = path.join(repoRoot(), ".keys/demo.json");
  const alicePath = path.join(repoRoot(), ".keys/alice.json");
  if (!existsSync(demoPath) || !existsSync(alicePath)) return json({ live: false, reason: "not seeded" });
  const demo = JSON.parse(readFileSync(demoPath, "utf8")) as { mint: string };
  const alice = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(alicePath, "utf8")))).publicKey;
  const s = store();
  const actions = s.list().filter((a) => a.mint === demo.mint && a.snapshot);
  const dist = actions.find((a) => a.kind === "distribution");
  const vote = actions.find((a) => a.kind === "vote");
  const distProof = dist ? proofFor(s, dist.id, alice.toBase58()) : null;
  const voteProof = vote ? proofFor(s, vote.id, alice.toBase58()) : null;
  const base = {
    wallet: alice.toBase58(),
    mint: demo.mint,
    distribution: dist ? { id: dist.id, amountPerShareMicro: dist.amountPerShareMicro ?? "0", entitlement: distProof?.leaf.entitlement ?? null, snapshotSlot: dist.snapshot?.slotActual ?? null, attributedPct: dist.snapshot?.attributedPct ?? null } : null,
    vote: vote ? { id: vote.id, question: vote.question ?? null, entitlement: voteProof?.leaf.entitlement ?? null } : null
  };
  if (!(await forkReachable())) return json({ live: false, reason: "fork down", ...base });
  try {
    const ledger = await resolveWallet(reader(), alice.toBase58(), demo.mint);
    const client = LookthroughClient.readOnly(connection());
    const receipt = dist ? await client.fetchReceipt(new Uint8Array(Buffer.from(dist.actionIdHex, "hex")), alice) : null;
    const voteReceipt = vote ? await client.fetchReceipt(new Uint8Array(Buffer.from(vote.actionIdHex, "hex")), alice) : null;
    return json({
      live: true,
      ...base,
      slot: ledger.slot,
      rows: ledger.rows.map((r) => ({ source: r.source, label: r.label, shares6: r.shares6.toString() })),
      walletVisibleShares6: ledger.walletVisibleShares6.toString(),
      totalShares6: ledger.totalShares6.toString(),
      claimed: receipt ? receipt.amountPaid.toString() : null,
      voted: voteReceipt ? { choice: voteReceipt.choice, weight: voteReceipt.entitlement.toString() } : null
    });
  } catch (err) {
    return json({ live: false, reason: err instanceof Error ? err.message : String(err), ...base });
  }
}
