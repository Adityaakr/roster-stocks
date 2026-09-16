import { errorJson, json, tokensClient } from "@/lib/server";

export const dynamic = "force-dynamic";

/** tokens.xyz curated lists (stocks, etfs) with every wrapper per asset. Key stays on the server; 60 s cache in the client. */
export async function GET(req: Request) {
  const client = tokensClient();
  if (!client) return json({ configured: false, error: "tokens.xyz is not configured: set TOKENS_API_KEY in .env and restart the app." });
  const p = new URL(req.url).searchParams;
  const list = p.get("list") === "etfs" ? "etfs" : "stocks";
  const limit = Math.min(100, Math.max(1, Number(p.get("limit") ?? "50")));
  const offset = Math.max(0, Number(p.get("offset") ?? "0"));
  try {
    return json(await client.curated(list, { limit, offset }));
  } catch (err) {
    const e = err as { status?: number; requestId?: string; message: string };
    return errorJson(`tokens.xyz request failed: ${e.message}`, e.status && e.status >= 400 && e.status < 600 ? e.status : 502, { requestId: e.requestId ?? null });
  }
}
