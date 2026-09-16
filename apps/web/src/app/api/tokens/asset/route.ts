import { errorJson, json, tokensClient } from "@/lib/server";

export const dynamic = "force-dynamic";

/** One asset with every wrapper and where each trades, in one round trip for the asset page. */
export async function GET(req: Request) {
  const client = tokensClient();
  if (!client) return json({ configured: false, error: "tokens.xyz is not configured: set TOKENS_API_KEY in .env and restart the app." });
  const assetId = new URL(req.url).searchParams.get("assetId") ?? "";
  if (!assetId) return errorJson("assetId is required");
  try {
    const [asset, variants] = await Promise.all([client.asset(assetId), client.variants(assetId)]);
    const markets = await Promise.all(variants.map((v) => client.markets(assetId, v.mint, 6).catch(() => [])));
    return json({ asset, variants: variants.map((v, i) => ({ ...v, markets: markets[i] ?? [] })) });
  } catch (err) {
    const e = err as { status?: number; requestId?: string; message: string };
    return errorJson(`tokens.xyz request failed: ${e.message}`, e.status && e.status >= 400 && e.status < 600 ? e.status : 502, { requestId: e.requestId ?? null });
  }
}
