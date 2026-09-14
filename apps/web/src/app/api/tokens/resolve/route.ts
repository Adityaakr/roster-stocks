import { errorJson, json, tokensClient } from "@/lib/server";

export const dynamic = "force-dynamic";

/** tokens.xyz proxy (resolve). The API key stays on the server; responses are cached for 60 s in the client. */
export async function GET(req: Request) {
  const client = tokensClient();
  if (!client) return json({ configured: false, error: "tokens.xyz is not configured: set TOKENS_API_KEY in .env and restart the app." });
  const p = new URL(req.url).searchParams;
  try {
    const route: string = "resolve";
    if (route === "search") return json({ results: await client.search(p.get("q") ?? "", { limit: Number(p.get("limit") ?? "8") }) });
    if (route === "resolve") return json(await client.resolveMint(p.get("mint") ?? ""));
    if (route === "variants") return json({ variants: await client.variants(p.get("assetId") ?? "", { kind: p.get("kind") ?? "tokenized_equity" }) });
    return json({ markets: await client.markets(p.get("assetId") ?? "", p.get("mint") ?? "", Number(p.get("limit") ?? "20")) });
  } catch (err) {
    const e = err as { status?: number; requestId?: string; message: string };
    return errorJson(`tokens.xyz request failed: ${e.message}`, e.status && e.status >= 400 && e.status < 600 ? e.status : 502, { requestId: e.requestId ?? null });
  }
}
