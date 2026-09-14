/**
 * Backpack Exchange public API client (unsigned endpoints only).
 * Shapes verified against live responses on 2026-09-14 and docs.backpack.exchange.
 * Signed endpoints (mint and redeem) are not in the public docs on that date; see BackpackSecuritiesRail.
 */
import { z } from "zod";
import { HttpClient } from "./http.js";

export const BACKPACK_BASE_URL = "https://api.backpack.exchange";

export const SecuritySession = z
  .object({ name: z.string(), minQuantity: z.string(), maxQuantity: z.string(), stepSize: z.string() })
  .loose();

export const Security = z
  .object({ asset: z.string(), name: z.string(), cusip: z.string().nullable().optional(), sessions: z.array(SecuritySession) })
  .loose();
export type Security = z.infer<typeof Security>;

export const MarketSession = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    timezone: z.string(),
    startWeekday: z.number(),
    endWeekday: z.number()
  })
  .loose();
export type MarketSession = z.infer<typeof MarketSession>;

export const MarketHoliday = z
  .object({
    market: z.string(),
    name: z.string(),
    date: z.string(),
    startTime: z.string().nullable().optional(),
    endTime: z.string().nullable().optional(),
    timezone: z.string().optional()
  })
  .loose();
export type MarketHoliday = z.infer<typeof MarketHoliday>;

export const Ticker = z
  .object({ symbol: z.string(), lastPrice: z.string(), priceChangePercent: z.string().optional(), high: z.string().optional(), low: z.string().optional() })
  .loose();
export type Ticker = z.infer<typeof Ticker>;

export class BackpackClient {
  private readonly http: HttpClient;

  constructor(opts?: { baseUrl?: string; fetchImpl?: typeof fetch; logger?: (m: string) => void; cacheTtlMs?: number }) {
    this.http = new HttpClient({
      baseUrl: opts?.baseUrl ?? BACKPACK_BASE_URL,
      ...(opts?.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts?.logger ? { logger: opts.logger } : {}),
      ...(opts?.cacheTtlMs !== undefined ? { cacheTtlMs: opts.cacheTtlMs } : {})
    });
  }

  /** GET /api/v1/securities */
  async securities(): Promise<Security[]> {
    return z.array(Security).parse(await this.http.get<unknown>("/api/v1/securities"));
  }

  /** GET /api/v1/market-sessions */
  async marketSessions(): Promise<MarketSession[]> {
    return z.array(MarketSession).parse(await this.http.get<unknown>("/api/v1/market-sessions"));
  }

  /** GET /api/v1/market-holidays */
  async marketHolidays(): Promise<MarketHoliday[]> {
    return z.array(MarketHoliday).parse(await this.http.get<unknown>("/api/v1/market-holidays"));
  }

  /** GET /api/v1/ticker?symbol=…&source=External. Returns null when Backpack rejects the symbol or source. */
  async externalTicker(symbol: string): Promise<Ticker | null> {
    try {
      return Ticker.parse(await this.http.get<unknown>("/api/v1/ticker", { symbol, source: "External" }));
    } catch (err) {
      if (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 400) return null;
      throw err;
    }
  }
}

/**
 * Maps a Backpack-listed security (by ticker such as AAPL.US, or CUSIP) to registry metadata.
 * Mint and redeem are not exposed here: docs.backpack.exchange carried no such endpoint on 2026-09-14,
 * so `mintRedeemStatus` reports that honestly instead of guessing a path.
 */
export class BackpackSecuritiesRail {
  constructor(private readonly client: BackpackClient) {}

  async findSecurity(query: { ticker?: string; cusip?: string }): Promise<Security | null> {
    const all = await this.client.securities();
    const upper = query.ticker?.toUpperCase();
    return (
      all.find((s) => (upper && (s.asset.toUpperCase() === upper || s.asset.toUpperCase() === `${upper}.US`)) || (query.cusip && s.cusip === query.cusip)) ??
      null
    );
  }

  mintRedeemStatus(): { available: false; reason: string } {
    return {
      available: false,
      reason: "Backpack Securities mint and redeem endpoints are not in the public API docs as of 2026-09-14. Not implemented."
    };
  }
}
