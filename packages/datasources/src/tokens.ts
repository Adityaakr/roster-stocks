/**
 * tokens.xyz Assets API v1 client. Server-side only: the key never reaches the browser.
 * Endpoint shapes follow docs.tokens.xyz/v1 (endpoints/assets and endpoints/asset-by-id, read 2026-09-14).
 * Schemas are deliberately loose (unknown keys pass through) so a new optional field never breaks the app.
 */
import { z } from "zod";
import { HttpClient } from "./http";

export const TOKENS_BASE_URL = "https://api.tokens.xyz/v1";

export const StockVariantTier = z.enum(["share_redeemable", "cash_redeemable", "not_redeemable"]);
export type StockVariantTier = z.infer<typeof StockVariantTier>;

export const VariantMarket = z
  .object({
    price: z.number().nullable().optional(),
    liquidity: z.number().nullable().optional(),
    volume24hUSD: z.number().nullable().optional(),
    asOf: z.union([z.string(), z.number()]).nullable().optional()
  })
  .loose();

export const Variant = z
  .object({
    mint: z.string(),
    chain: z.string().optional(),
    kind: z.string().optional(),
    stockVariantTier: StockVariantTier.optional(),
    liquidityTier: z.string().optional(),
    symbol: z.string().optional(),
    name: z.string().optional(),
    decimals: z.number().optional(),
    issuer: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    market: VariantMarket.nullable().optional(),
    advisory: z.unknown().optional()
  })
  .loose();
export type Variant = z.infer<typeof Variant>;

export const SearchResult = z
  .object({
    assetId: z.string(),
    name: z.string(),
    symbol: z.string(),
    category: z.string().optional(),
    imageUrl: z.string().nullable().optional(),
    primaryVariant: Variant.nullable().optional(),
    variants: z.array(Variant).optional()
  })
  .loose();
export type SearchResult = z.infer<typeof SearchResult>;

const SearchResponse = z.union([
  z.object({ results: z.array(SearchResult) }).loose(),
  z.object({ data: z.array(SearchResult) }).loose(),
  z.array(SearchResult)
]);

export const ResolveResponse = z
  .object({
    assetId: z.string(),
    resolvedBy: z.string().optional(),
    mint: z.string().nullable().optional(),
    asset: z.object({ assetId: z.string(), name: z.string(), symbol: z.string() }).loose().optional(),
    variant: Variant.nullable().optional()
  })
  .loose();
export type ResolveResponse = z.infer<typeof ResolveResponse>;

/** Live shape observed on 2026-09-16 (the docs page lists `poolAddress`/`dex`; the API returns `address`, `name`, `base`, `quote`). */
export const Market = z
  .object({
    address: z.string(),
    name: z.string().optional(),
    price: z.number().nullable().optional(),
    liquidity: z.number().nullable().optional(),
    volume24h: z.number().nullable().optional(),
    trade24h: z.number().nullable().optional(),
    uniqueWallet24h: z.number().nullable().optional(),
    createdAt: z.string().optional(),
    base: z.object({ address: z.string(), symbol: z.string().optional(), decimals: z.number().optional() }).loose().optional(),
    quote: z.object({ address: z.string(), symbol: z.string().optional(), decimals: z.number().optional() }).loose().optional(),
    dex: z.string().optional(),
    venue: z.string().optional()
  })
  .loose();
export type Market = z.infer<typeof Market>;

export const Candle = z
  .object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number().nullable().optional()
  })
  .loose();
export type Candle = z.infer<typeof Candle>;

function unwrapList<T>(raw: unknown, schema: z.ZodType<T>, keys: string[]): T[] {
  if (Array.isArray(raw)) return z.array(schema).parse(raw);
  if (typeof raw === "object" && raw !== null) {
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (Array.isArray(v)) return z.array(schema).parse(v);
    }
  }
  throw new Error(`unexpected list shape, keys ${Object.keys((raw as object) ?? {}).join(",")}`);
}

export class TokensClient {
  private readonly http: HttpClient;

  constructor(opts: { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch; logger?: (m: string) => void; cacheTtlMs?: number }) {
    if (!opts.apiKey) throw new Error("TOKENS_API_KEY is required");
    this.http = new HttpClient({
      baseUrl: opts.baseUrl ?? TOKENS_BASE_URL,
      headers: { "x-api-key": opts.apiKey },
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.logger ? { logger: opts.logger } : {}),
      ...(opts.cacheTtlMs !== undefined ? { cacheTtlMs: opts.cacheTtlMs } : {})
    });
  }

  /** GET /assets/search?q=… */
  async search(q: string, opts?: { limit?: number; category?: string; variants?: "all" }): Promise<SearchResult[]> {
    const raw = await this.http.get<unknown>("/assets/search", { q, limit: opts?.limit, category: opts?.category, variants: opts?.variants });
    const parsed = SearchResponse.parse(raw);
    return unwrapList(parsed, SearchResult, ["results", "data", "assets", "items"]);
  }

  /** GET /assets/resolve?mint=… */
  async resolveMint(mint: string): Promise<ResolveResponse> {
    return ResolveResponse.parse(await this.http.get<unknown>("/assets/resolve", { mint }));
  }

  /** GET /assets/:assetId/variants?kind=… */
  async variants(assetId: string, opts?: { kind?: string; stockVariantTier?: StockVariantTier }): Promise<Variant[]> {
    const raw = await this.http.get<unknown>(`/assets/${encodeURIComponent(assetId)}/variants`, {
      kind: opts?.kind,
      stockVariantTier: opts?.stockVariantTier
    });
    return unwrapList(raw, Variant, ["variants", "data", "results", "items"]);
  }

  /** GET /assets/:assetId/markets?mint=… */
  async markets(assetId: string, mint: string, limit = 50): Promise<Market[]> {
    const raw = await this.http.get<unknown>(`/assets/${encodeURIComponent(assetId)}/markets`, { mint, limit });
    return unwrapList(raw, Market, ["markets", "data", "results", "items"]);
  }

  /** GET /assets/:assetId/price-chart?mint=…&interval=1H (omit mint for the canonical underlying series) */
  async priceChart(assetId: string, opts?: { mint?: string; interval?: "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W" }): Promise<Candle[]> {
    const raw = await this.http.get<unknown>(`/assets/${encodeURIComponent(assetId)}/price-chart`, {
      mint: opts?.mint,
      interval: opts?.interval ?? "1H"
    });
    return unwrapList(raw, Candle, ["candles", "data", "results", "items", "ohlcv"]);
  }

  /** POST /assets/market-snapshots { mints } */
  async marketSnapshots(mints: string[]): Promise<unknown> {
    return this.http.post<unknown>("/assets/market-snapshots", { mints });
  }
}
