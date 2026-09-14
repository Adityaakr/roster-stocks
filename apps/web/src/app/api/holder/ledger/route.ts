import { PublicKey } from "@solana/web3.js";
import { resolveWallet } from "@lookthrough/resolver";
import { LookthroughClient } from "@lookthrough/sdk";
import { proofFor } from "@lookthrough/registrar";
import { connection, errorJson, forkReachable, FORK_DOWN_MESSAGE, json, reader, store } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Live ledger for one wallet and mint, plus registration status and the wallet's standing in every action for the mint. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const wallet = p.get("wallet");
  const mint = p.get("mint") ?? process.env.NEXT_PUBLIC_DEFAULT_MINT;
  if (!wallet || !mint) return errorJson("wallet and mint are required");
  try {
    new PublicKey(wallet);
  } catch {
    return errorJson("wallet is not a valid public key");
  }
  if (!(await forkReachable())) return errorJson(FORK_DOWN_MESSAGE, 503);
  try {
    const ledger = await resolveWallet(reader(), wallet, mint);
    const client = LookthroughClient.readOnly(connection());
    const registration = await client.isRegistered(new PublicKey(mint), new PublicKey(wallet));
    const s = store();
    const actions = [];
    for (const a of s.list()) {
      if (a.mint !== mint || !a.snapshot) continue;
      const proof = proofFor(s, a.id, wallet);
      let receipt = null;
      let state = null;
      if (a.onchain) {
        const actionId = new Uint8Array(Buffer.from(a.actionIdHex, "hex"));
        state = await client.fetchAction(actionId);
        receipt = await client.fetchReceipt(actionId, new PublicKey(wallet));
      }
      actions.push({ id: a.id, kind: a.kind, title: a.title, status: a.status, snapshotSlot: a.snapshot.slotActual, root: a.snapshot.root, amountPerShareMicro: a.amountPerShareMicro ?? null, question: a.question ?? null, entitlement: proof?.leaf.entitlement ?? null, inTree: !!proof, funded: state?.funded ?? null, closed: state?.closed ?? null, deadlineSlot: state?.deadlineSlot ?? null, claimsCloseSlot: state?.claimsCloseSlot ?? null, receipt, tally: state ? { for: state.forWeight, against: state.againstWeight, abstain: state.abstainWeight, voters: state.voters } : null });
    }
    return json({ ledger, registration, actions });
  } catch (err) {
    return errorJson(`Couldn't resolve this wallet: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}
