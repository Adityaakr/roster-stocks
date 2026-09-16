"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Empty, ErrorState, Loading, Logo, Tabs, fmtCompact, fmtPct, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/icons";

interface Variant {
  mint: string;
  symbol?: string;
  name?: string;
  label?: string | null;
  stockVariantTier?: string;
  liquidityTier?: string;
  market?: { price?: number | null; liquidity?: number | null; volume24hUSD?: number | null; holder?: number | null } | null;
}
interface Asset {
  assetId: string;
  name: string;
  symbol: string;
  category?: string;
  imageUrl?: string | null;
  stats?: { price?: number | null; liquidity?: number | null; volume24hUSD?: number | null; marketCap?: number | null; priceChange24hPercent?: number | null } | null;
  primaryVariant?: Variant | null;
  variants?: Variant[];
}
interface Page {
  configured?: boolean;
  error?: string;
  pagination?: { offset: number; limit: number; total: number; hasMore: boolean; nextOffset?: number | null };
  assets?: Asset[];
}
interface PreIpoRow {
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

type Tab = "stocks" | "etfs" | "preipo";
type Sort = "liquidity" | "volume" | "change" | "name";
const PAGE = 50;

export default function AssetsPage() {
  const [tab, setTab] = useState<Tab>("stocks");
  const [q, setQ] = useState("");
  const [wrapper, setWrapper] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("liquidity");
  const [pages, setPages] = useState<Record<"stocks" | "etfs", { assets: Asset[]; total: number | null; next: number | null; error: string | null; configured: boolean }>>({
    stocks: { assets: [], total: null, next: 0, error: null, configured: true },
    etfs: { assets: [], total: null, next: 0, error: null, configured: true }
  });
  const [loading, setLoading] = useState(false);
  const [preipo, setPreipo] = useState<{ rows: PreIpoRow[]; errors: string[] } | null>(null);
  const inflight = useRef<string | null>(null);

  async function loadMore(list: "stocks" | "etfs") {
    const offset = pages[list].next;
    if (offset === null) return;
    const key = `${list}:${offset}`;
    if (inflight.current === key) return;
    inflight.current = key;
    setLoading(true);
    try {
      const res = await fetch(`/api/tokens/curated?list=${list}&limit=${PAGE}&offset=${offset}`);
      const j = (await res.json()) as Page;
      if (j.configured === false) {
        setPages((p) => ({ ...p, [list]: { ...p[list], configured: false, error: j.error ?? "not configured", next: null } }));
        return;
      }
      if (!res.ok || j.error) throw new Error(j.error ?? `HTTP ${res.status}`);
      setPages((p) => {
        const seen = new Set(p[list].assets.map((a) => a.assetId));
        const fresh = (j.assets ?? []).filter((a) => !seen.has(a.assetId));
        return { ...p, [list]: { assets: [...p[list].assets, ...fresh], total: j.pagination?.total ?? null, next: j.pagination?.hasMore ? (j.pagination.nextOffset ?? offset + PAGE) : null, error: null, configured: true } };
      });
    } catch (e) {
      setPages((p) => ({ ...p, [list]: { ...p[list], error: e instanceof Error ? e.message : String(e) } }));
    } finally {
      inflight.current = null;
      setLoading(false);
    }
  }

  const untouched = tab === "preipo" ? false : pages[tab].assets.length === 0 && pages[tab].next === 0 && !pages[tab].error;
  const preipoMissing = tab === "preipo" && preipo === null;
  useEffect(() => {
    if (preipoMissing) {
      fetch("/api/preipo")
        .then((r) => r.json())
        .then((j: { rows: PreIpoRow[]; errors: string[] }) => setPreipo(j))
        .catch((e) => setPreipo({ rows: [], errors: [String(e)] }));
    }
  }, [preipoMissing]);
  useEffect(() => {
    // loadMore reads the latest page state through its closure at call time, so it is not a dependency here.
    if (untouched && tab !== "preipo") void loadMore(tab);
  }, [untouched, tab]);

  const list = tab === "preipo" ? null : pages[tab];
  const wrappers = useMemo(() => {
    if (!list) return [];
    const set = new Map<string, number>();
    for (const a of list.assets) for (const v of a.variants ?? []) if (v.label) set.set(v.label, (set.get(v.label) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);
  const filtered = useMemo(() => {
    if (!list) return [];
    const s = q.trim().toLowerCase();
    let out = list.assets.filter((a) => {
      if (wrapper !== "all" && !(a.variants ?? []).some((v) => v.label === wrapper)) return false;
      if (!s) return true;
      return a.symbol.toLowerCase().includes(s) || a.name.toLowerCase().includes(s) || (a.variants ?? []).some((v) => (v.symbol ?? "").toLowerCase().includes(s) || v.mint.toLowerCase() === s);
    });
    const n = (v: number | null | undefined) => v ?? -Infinity;
    out = out.slice().sort((a, b) => sort === "name" ? a.symbol.localeCompare(b.symbol) : sort === "volume" ? n(b.stats?.volume24hUSD) - n(a.stats?.volume24hUSD) : sort === "change" ? n(b.stats?.priceChange24hPercent) - n(a.stats?.priceChange24hPercent) : n(b.stats?.liquidity) - n(a.stats?.liquidity));
    return out;
  }, [list, q, wrapper, sort]);
  const preFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = preipo?.rows ?? [];
    return s ? rows.filter((r) => r.symbol.toLowerCase().includes(s) || r.name.toLowerCase().includes(s) || r.mint.toLowerCase() === s) : rows;
  }, [preipo, q]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="h3">Assets</h1>
          <p className="body-sm">Every tokenized stock and ETF on Solana with all of its wrappers, from the tokens.xyz curated lists, plus pre-IPO tokens from Tessera and PreStocks. Prices and liquidity refresh each minute.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
        <Tabs value={tab} onChange={(t) => { setTab(t); setWrapper("all"); }} items={[
          { id: "stocks", label: <>Stocks{pages.stocks.total !== null ? <span className="muted"> {pages.stocks.total}</span> : null}</> },
          { id: "etfs", label: <>ETFs{pages.etfs.total !== null ? <span className="muted"> {pages.etfs.total}</span> : null}</> },
          { id: "preipo", label: <>Pre-IPO{preipo ? <span className="muted"> {preipo.rows.length}</span> : null}</> }
        ]} />
        <div className="relative" style={{ minWidth: 240, flex: "1 1 240px", maxWidth: 360 }}>
          <Icon.Search width={14} height={14} className="absolute" style={{ left: 12, top: 13, color: "var(--text-4)" }} />
          <input className="field" style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol, name or mint" aria-label="Filter assets" />
        </div>
        {tab !== "preipo" ? (
          <>
            <select className="field" style={{ width: "auto" }} value={wrapper} onChange={(e) => setWrapper(e.target.value)} aria-label="Wrapper">
              <option value="all">All wrappers</option>
              {wrappers.map(([w, n]) => <option key={w} value={w}>{w} ({n})</option>)}
            </select>
            <select className="field" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="liquidity">Liquidity</option><option value="volume">Volume 24h</option><option value="change">Change 24h</option><option value="name">Symbol</option>
            </select>
          </>
        ) : null}
      </div>

      {tab !== "preipo" && list ? (
        <>
          {!list.configured ? <ErrorState message={list.error ?? "tokens.xyz is not configured."} next="Set TOKENS_API_KEY in .env and restart the app." /> : null}
          {list.error && list.configured ? <ErrorState message={list.error} next="tokens.xyz request failed. Try again in a moment." /> : null}
          {loading && list.assets.length === 0 ? <Loading what={`${tab === "etfs" ? "ETFs" : "stocks"} from tokens.xyz`} /> : null}
          {list.assets.length && filtered.length === 0 ? <Empty title="Nothing matches." action="Try a different symbol, name or wrapper." /> : null}
          <div className="asset-grid">
            {filtered.map((a) => {
              const vs = a.variants && a.variants.length ? a.variants : a.primaryVariant ? [a.primaryVariant] : [];
              const ch = a.stats?.priceChange24hPercent;
              return (
                <Link key={a.assetId} href={`/assets/${encodeURIComponent(a.assetId)}`} className="card asset-card">
                  <div className="flex items-center gap-3">
                    <Logo src={a.imageUrl} symbol={a.symbol} />
                    <div className="min-w-0">
                      <div className="h6 truncate">{a.symbol}</div>
                      <div className="small truncate">{a.name}</div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="h4 num">{fmtUsd(a.stats?.price)}</div>
                    <div className={`small num ${ch == null ? "" : ch >= 0 ? "up" : "down"}`}>{fmtPct(ch)}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2 small">
                    <span>Liquidity <b className="num" style={{ color: "var(--text-2)", fontWeight: 500 }}>{fmtCompact(a.stats?.liquidity)}</b></span>
                    <span>Vol 24h <b className="num" style={{ color: "var(--text-2)", fontWeight: 500 }}>{fmtCompact(a.stats?.volume24hUSD)}</b></span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {vs.slice(0, 4).map((v, i) => <Badge key={`${v.mint}-${i}`}>{v.label ?? v.symbol ?? "wrapper"}</Badge>)}
                    {vs.length > 4 ? <Badge>+{vs.length - 4}</Badge> : null}
                  </div>
                </Link>
              );
            })}
          </div>
          {list.next !== null && list.configured ? (
            <div className="btnrow" style={{ marginTop: 20 }}>
              <button className="btn secondary" onClick={() => loadMore(tab)} disabled={loading}>{loading ? "Loading" : `Load ${Math.min(PAGE, (list.total ?? PAGE) - list.assets.length)} more`}</button>
              <span className="small">Showing {list.assets.length}{list.total !== null ? ` of ${list.total}` : ""}.</span>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "preipo" ? (
        <>
          {!preipo ? <Loading what="pre-IPO tokens from Tessera and PreStocks" /> : null}
          {preipo?.errors.length ? <div style={{ marginBottom: 16 }}><ErrorState message={preipo.errors.join("; ")} next="The other source still loaded; the missing one is reported, not hidden." /></div> : null}
          {preipo?.rows.length ? (
            <div className="card scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Token</th><th>Issuer</th><th>Mint</th><th className="num">Mark price</th><th className="num">Token price</th><th className="num">Mark valuation</th><th className="num">Holders</th></tr>
                </thead>
                <tbody>
                  {preFiltered.map((r) => (
                    <tr key={`${r.source}-${r.mint}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Logo symbol={r.symbol.replace(/^T-/, "")} size="sm" />
                          <div>
                            <div style={{ fontWeight: 500 }}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={{ borderBottom: "1px solid var(--line-strong)" }}>{r.symbol}</a> : r.symbol}</div>
                            <div className="small">{r.name}{r.sector ? ` · ${r.sector}` : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone={r.source === "Tessera" ? "purple" : "blue"}>{r.source}</Badge></td>
                      <td className="mono small" title={r.mint}>{r.mint.slice(0, 6)}…{r.mint.slice(-6)}</td>
                      <td className="num">{fmtUsd(r.markPrice)}</td>
                      <td className="num">{fmtUsd(r.tokenPrice)}</td>
                      <td className="num">{fmtCompact(r.markValuation)}</td>
                      <td className="num">{r.holders != null ? r.holders.toLocaleString("en-US") : "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="small" style={{ marginTop: 14, maxWidth: 760 }}>
            Sources: rest-api.tessera.pe/v1/public/token-details and prestocks.com/api/prestocks. Mark price is the issuer&apos;s reference price for the private company; token price is the on-chain price where published. Pre-IPO tokens carry a transfer fee and a permanent delegate; look-through adapters for their venues are on the bounties branch.
          </p>
        </>
      ) : null}
    </div>
  );
}
