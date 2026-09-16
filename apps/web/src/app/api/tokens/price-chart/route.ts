import { errorJson, json, tokensClient } from "@/lib/server";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { interval: "1H" | "4H" | "1D" | "1W"; seconds: number }> = {
  "1D": { interval: "1H", seconds: 86_400 },
  "1W": { interval: "4H", seconds: 7 * 86_400 },
  "1M": { interval: "1D", seconds: 30 * 86_400 },
  "3M": { interval: "1D", seconds: 90 * 86_400 },
  "1Y": { interval: "1W", seconds: 365 * 86_400 }
};

/** Candles for an asset (canonical underlying series) or one wrapper mint, by range: 1D, 1W, 1M, 3M, 1Y. */
export async function GET(req: Request) {
  const client = tokensClient();
  if (!client) return json({ configured: false, error: "tokens.xyz is not configured: set TOKENS_API_KEY in .env and restart the app." });
  const p = new URL(req.url).searchParams;
  const assetId = p.get("assetId") ?? "";
  if (!assetId) return errorJson("assetId is required");
  const range = RANGES[p.get("range") ?? "1M"] ?? RANGES["1M"]!;
  const mint = p.get("mint");
  try {
    const candles = await client.priceChart(assetId, { ...(mint ? { mint } : {}), interval: range.interval, from: Math.floor(Date.now() / 1000) - range.seconds });
    return json({ assetId, mint: mint ?? null, interval: range.interval, candles });
  } catch (err) {
    const e = err as { status?: number; requestId?: string; message: string };
    return errorJson(`tokens.xyz request failed: ${e.message}`, e.status && e.status >= 400 && e.status < 600 ? e.status : 502, { requestId: e.requestId ?? null });
  }
}
