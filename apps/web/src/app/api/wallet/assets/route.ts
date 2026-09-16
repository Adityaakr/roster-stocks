import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { resolveWallet } from "@lookthrough/resolver";
import { connection, errorJson, json, reader, tokensClient } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Everything a wallet holds, named: its token balances joined to tokens.xyz so each one carries an asset, a wrapper,
 * a logo and a price, and every tokenized stock among them resolved through the look-through adapters.
 * Tokens the directory does not classify as equity or ETF are listed separately and never counted as shares.
 */
interface Row {
  source: "direct" | "raydium_clmm" | "kamino_lend";
  label: string;
  shares6: string;
  rawAmount: string;
  estimated: boolean;
}
interface AssetOut {
  mint: string;
  assetId: string | null;
  symbol: string;
  name: string;
  wrapper: string | null;
  category: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  decimals: number;
  rawAmount: string;
  uiAmount: string;
  shares6: string;
  visibleShares6: string;
  rows: Row[];
  lookthrough: boolean;
}

const STOCK_CATEGORIES = new Set(["equity", "etf", "stock", "index"]);
const MAX_RESOLVED = 4;
const cache = new Map<string, { at: number; value: unknown }>();

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet")?.trim() ?? "";
  try {
    new PublicKey(wallet);
  } catch {
    return errorJson("wallet must be a base58 public key");
  }
  const hit = cache.get(wallet);
  if (hit && Date.now() - hit.at < 30_000) return json(hit.value);

  const conn = connection();
  let balances: { mint: string; raw: string; decimals: number; ui: string }[] = [];
  let slot = 0;
  try {
    slot = await conn.getSlot();
    for (const programId of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
      const res = await conn.getParsedTokenAccountsByOwner(new PublicKey(wallet), { programId });
      for (const { account } of res.value) {
        const info = (account.data as unknown as { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number; uiAmountString: string } } } }).parsed.info;
        if (BigInt(info.tokenAmount.amount) === 0n) continue;
        balances.push({ mint: info.mint, raw: info.tokenAmount.amount, decimals: info.tokenAmount.decimals, ui: info.tokenAmount.uiAmountString });
      }
    }
  } catch (err) {
    return errorJson(`could not read the wallet's token accounts: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
  // Largest first, so a wallet with many dust accounts still shows its real holdings.
  balances = balances.sort((a, b) => (BigInt(b.raw) > BigInt(a.raw) ? 1 : -1)).slice(0, 40);

  const tokens = tokensClient();
  const assets: AssetOut[] = [];
  const others: { mint: string; symbol: string; name: string; category: string | null; uiAmount: string; imageUrl: string | null }[] = [];
  let resolved = 0;

  for (const b of balances) {
    let assetId: string | null = null;
    let symbol = `${b.mint.slice(0, 4)}…${b.mint.slice(-4)}`;
    let name = "Unknown token";
    let wrapper: string | null = null;
    let category: string | null = null;
    let imageUrl: string | null = null;
    let priceUsd: number | null = null;
    if (tokens) {
      try {
        const r = await tokens.resolveMint(b.mint);
        assetId = r.assetId ?? null;
        category = r.asset?.category ?? null;
        symbol = r.variant?.symbol ?? r.asset?.symbol ?? symbol;
        name = r.variant?.name ?? r.asset?.name ?? name;
        wrapper = r.variant?.label ?? null;
        if (assetId) {
          const detail = await tokens.asset(assetId).catch(() => null);
          imageUrl = detail?.imageUrl ?? null;
          priceUsd = detail?.stats?.price ?? null;
        }
      } catch {
        // not in the directory; it stays an unknown token
      }
    }
    const isStock = category !== null && STOCK_CATEGORIES.has(category);
    if (!isStock) {
      others.push({ mint: b.mint, symbol, name, category, uiAmount: b.ui, imageUrl });
      continue;
    }
    let rows: Row[] = [];
    let shares6 = "0";
    let visible6 = "0";
    if (resolved < MAX_RESOLVED) {
      resolved += 1;
      try {
        const ledger = await resolveWallet(reader(), wallet, b.mint);
        rows = ledger.rows.map((r) => ({ source: r.source, label: r.label, shares6: r.shares6.toString(), rawAmount: r.rawAmount.toString(), estimated: r.estimated }));
        shares6 = ledger.totalShares6.toString();
        visible6 = ledger.walletVisibleShares6.toString();
      } catch {
        // chain unreachable for the look-through: the card falls back to the direct balance
      }
    }
    assets.push({ mint: b.mint, assetId, symbol, name, wrapper, category, imageUrl, priceUsd, decimals: b.decimals, rawAmount: b.raw, uiAmount: b.ui, shares6, visibleShares6: visible6, rows, lookthrough: rows.length > 0 });
  }

  const value = { wallet, slot, configured: !!tokens, assets, others };
  cache.set(wallet, { at: Date.now(), value });
  return json(value);
}
