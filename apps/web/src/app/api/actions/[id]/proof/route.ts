import { proofFor } from "@lookthrough/registrar";
import { errorJson, json, store } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return errorJson("wallet is required");
  try {
    const p = proofFor(store(), id, wallet);
    if (!p) return json({ inTree: false, message: "This wallet is not in the tree: it was not registered at the snapshot, or its entitlement was zero." });
    return json({ inTree: true, ...p });
  } catch {
    return errorJson(`No snapshot for ${id} yet.`, 404);
  }
}
