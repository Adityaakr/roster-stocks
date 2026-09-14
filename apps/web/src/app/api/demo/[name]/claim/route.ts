import { PublicKey } from "@solana/web3.js";
import { demoWallets, register, claim, vote } from "@lookthrough/registrar";
import { demoMode, errorJson, forkReachable, FORK_DOWN_MESSAGE, json, store } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Demo wallets are server-signed on the fork. Only available in demo mode. */
export async function POST(req: Request, ctx: { params: Promise<{ name: string }> }) {
  if (!demoMode()) return errorJson("Demo mode is off. Start the app with DEMO_MODE=1 or open it with ?demo=1.", 403);
  const { name } = await ctx.params;
  if (!["alice", "bob", "carol"].includes(name)) return errorJson("Unknown demo wallet", 404);
  if (!(await forkReachable())) return errorJson(FORK_DOWN_MESSAGE, 503);
  let wallets;
  try {
    wallets = demoWallets();
  } catch {
    return errorJson("Demo wallets are not seeded. Run pnpm seed with the fork up.", 409);
  }
  const kp = wallets[name as "alice" | "bob" | "carol"];
  const body = (await req.json().catch(() => ({}))) as { mint?: string; actionId?: string; choice?: "for" | "against" | "abstain" };
  const lines: string[] = [];
  const log = (m: string, data?: unknown) => lines.push(data === undefined ? m : `${m} ${JSON.stringify(data)}`);
  try {
    const op: string = "claim";
    if (op === "register") {
      if (!body.mint) return errorJson("mint is required");
      const r = await register(kp, new PublicKey(body.mint), log);
      return json({ ok: true, signature: r.signature, slot: r.slot, lines });
    }
    if (!body.actionId) return errorJson("actionId is required");
    if (op === "claim") {
      const r = await claim(store(), body.actionId, kp, log);
      return json({ ok: true, ...r, lines });
    }
    const r = await vote(store(), body.actionId, kp, body.choice ?? "for", log);
    return json({ ok: true, ...r, lines });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.match(/Error Code: (\w+)/)?.[1];
    return errorJson(code ? `Rejected by the program: ${code}` : msg, 422, { lines, detail: msg.slice(0, 600) });
  }
}
