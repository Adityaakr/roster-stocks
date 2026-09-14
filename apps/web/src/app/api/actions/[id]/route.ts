import { LookthroughClient } from "@lookthrough/sdk";
import { connection, errorJson, forkReachable, json, store } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Action record plus live on-chain state (funded, claimed total, tallies) when the fork is up. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let action;
  try {
    action = store().get(id);
  } catch {
    return errorJson(`No action named ${id}.`, 404);
  }
  let onchain: unknown = null;
  let forkUp = false;
  if (action.onchain && (await forkReachable())) {
    forkUp = true;
    try {
      const state = await LookthroughClient.readOnly(connection()).fetchAction(new Uint8Array(Buffer.from(action.actionIdHex, "hex")));
      onchain = state ? { ...state, address: state.address.toBase58(), authority: state.authority.toBase58(), mint: state.mint.toBase58(), usdcMint: state.usdcMint.toBase58(), vault: state.vault.toBase58(), actionId: Buffer.from(state.actionId).toString("hex"), root: Buffer.from(state.root).toString("hex"), contentHash: Buffer.from(state.contentHash).toString("hex"), questionHash: Buffer.from(state.questionHash).toString("hex") } : null;
    } catch (err) {
      onchain = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  let tree: { root: string; totalEntitlement: string; leaves: { wallet: string; entitlement: string }[] } | null = null;
  try {
    const t = store().readJson<{ root: string; totalEntitlement: string; leaves: { wallet: string; entitlement: string }[] }>(id, "tree.json");
    tree = { root: t.root, totalEntitlement: t.totalEntitlement, leaves: t.leaves.map((l) => ({ wallet: l.wallet, entitlement: l.entitlement })) };
  } catch {
    tree = null;
  }
  return json({ action, onchain, tree, forkUp });
}
