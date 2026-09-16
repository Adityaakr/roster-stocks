import { z } from "zod";
import { json } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Pre-IPO tokens from the two public issuer APIs, labelled by source. No key needed.
 * Shapes observed on 2026-09-16 (see docs/BOUNTIES.md); unknown keys pass through and a failed source is reported, not hidden.
 */
const Tessera = z.array(z.object({ id: z.string(), name: z.string(), symbol: z.string(), sector: z.string().optional(), mint: z.string(), markPrice: z.number().nullable().optional(), holders: z.number().nullable().optional(), markValuation: z.number().nullable().optional() }).loose());
const PreStocks = z.array(z.object({ name: z.string(), symbol: z.string(), contract_address: z.string(), external_url: z.string().optional(), markPrice: z.number().nullable().optional(), tokenPrice: z.number().nullable().optional(), markValuation: z.number().nullable().optional(), supply: z.number().nullable().optional() }).loose());

export interface PreIpoRow {
  source: "Tessera" | "PreStocks";
  name: string;
  symbol: string;
  mint: string;
  sector?: string;
  markPrice: number | null;
  tokenPrice: number | null;
  markValuation: number | null;
  holders: number | null;
  supply: number | null;
  url?: string;
}

const cache: { at: number; rows: PreIpoRow[]; errors: string[] } = { at: 0, rows: [], errors: [] };

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function GET() {
  if (Date.now() - cache.at < 60_000) return json({ rows: cache.rows, errors: cache.errors, cachedAt: cache.at });
  const rows: PreIpoRow[] = [];
  const errors: string[] = [];
  const [t, p] = await Promise.allSettled([fetchJson("https://rest-api.tessera.pe/v1/public/token-details"), fetchJson("https://prestocks.com/api/prestocks")]);
  if (t.status === "fulfilled") {
    const parsed = Tessera.safeParse(t.value);
    if (parsed.success) for (const r of parsed.data) rows.push({ source: "Tessera", name: r.name, symbol: r.symbol, mint: r.mint, ...(r.sector ? { sector: r.sector } : {}), markPrice: r.markPrice ?? null, tokenPrice: null, markValuation: r.markValuation ?? null, holders: r.holders ?? null, supply: null });
    else errors.push(`Tessera: unexpected shape (${parsed.error.issues[0]?.message ?? "schema"})`);
  } else errors.push(`Tessera: ${t.reason instanceof Error ? t.reason.message : String(t.reason)}`);
  if (p.status === "fulfilled") {
    const parsed = PreStocks.safeParse(p.value);
    if (parsed.success) for (const r of parsed.data) rows.push({ source: "PreStocks", name: r.name, symbol: r.symbol, mint: r.contract_address, markPrice: r.markPrice ?? null, tokenPrice: r.tokenPrice ?? null, markValuation: r.markValuation ?? null, holders: null, supply: r.supply ?? null, ...(r.external_url ? { url: r.external_url } : {}) });
    else errors.push(`PreStocks: unexpected shape (${parsed.error.issues[0]?.message ?? "schema"})`);
  } else errors.push(`PreStocks: ${p.reason instanceof Error ? p.reason.message : String(p.reason)}`);
  cache.at = Date.now();
  cache.rows = rows;
  cache.errors = errors;
  return json({ rows, errors, cachedAt: cache.at });
}
