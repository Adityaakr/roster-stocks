import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { actionsDir } from "@/lib/server";

export const dynamic = "force-dynamic";

/** The published entitlement set, byte-for-byte what the content hash on-chain commits to. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = path.join(actionsDir, id, "entitlements.json");
  if (!existsSync(p) || id.includes("..")) return new Response(JSON.stringify({ error: `No entitlements.json for ${id}.` }), { status: 404, headers: { "content-type": "application/json" } });
  return new Response(readFileSync(p), { headers: { "content-type": "application/json", "content-disposition": `inline; filename="entitlements-${id}.json"` } });
}
