/**
 * Phase 0 live probe: proves the datasource clients return real data.
 * Usage: pnpm probe
 */
import "dotenv/config";
import { BackpackClient, BackpackSecuritiesRail, TokensClient } from "@lookthrough/datasources";

const DEFAULT_MINT = process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";

async function main() {
  const backpack = new BackpackClient({ logger: console.error });
  const rail = new BackpackSecuritiesRail(backpack);
  const aapl = await rail.findSecurity({ ticker: "AAPL.US" });
  console.log("backpack AAPL.US:", aapl ? { asset: aapl.asset, cusip: aapl.cusip, sessions: aapl.sessions.map((s) => s.name) } : null);
  const sessions = await backpack.marketSessions();
  console.log("backpack sessions:", sessions.map((s) => `${s.name} ${s.startTime}-${s.endTime} ${s.timezone}`));
  const holidays = await backpack.marketHolidays();
  console.log("backpack holidays (next 3):", holidays.filter((h) => h.date >= new Date().toISOString().slice(0, 10)).slice(0, 3));

  const key = process.env.TOKENS_API_KEY;
  if (!key) {
    console.log("tokens.xyz: TOKENS_API_KEY not set, skipped (Phase 0 acceptance for tokens.xyz is pending the key)");
    return;
  }
  const tokens = new TokensClient({ apiKey: key, logger: console.error });
  const results = await tokens.search("apple", { limit: 5 });
  console.log("tokens.xyz search apple:", results.map((r) => ({ assetId: r.assetId, symbol: r.symbol, primaryMint: r.primaryVariant?.mint })));
  const resolved = await tokens.resolveMint(DEFAULT_MINT);
  console.log("tokens.xyz resolve AAPLx:", { assetId: resolved.assetId, resolvedBy: resolved.resolvedBy, variantKind: resolved.variant?.kind });
  const variants = await tokens.variants(resolved.assetId, { kind: "tokenized_equity" });
  console.log("tokens.xyz variants:", variants.map((v) => ({ mint: v.mint, symbol: v.symbol, tier: v.stockVariantTier, liq: v.liquidityTier })));
  const markets = await tokens.markets(resolved.assetId, DEFAULT_MINT, 10);
  console.log("tokens.xyz markets:", markets.map((m) => ({ pool: m.address, name: m.name, liquidity: m.liquidity })));
  const candles = await tokens.priceChart(resolved.assetId, { mint: DEFAULT_MINT, interval: "1H" });
  console.log("tokens.xyz price-chart (mint series):", { candles: candles.length, last: candles.at(-1) });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
