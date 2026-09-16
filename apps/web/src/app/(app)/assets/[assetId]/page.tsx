"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { LineChart, type Candle } from "@/components/line-chart";
import { Address, Badge, ErrorState, KV, Loading, Logo, Stat, Tabs, fmtCompact, fmtPct, fmtUsd } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useCluster } from "@/lib/cluster";

interface Market {
  address: string;
  name?: string;
  price?: number | null;
  liquidity?: number | null;
  volume24h?: number | null;
  quote?: { symbol?: string };
}
interface Variant {
  mint: string;
  symbol?: string;
  name?: string;
  label?: string | null;
  issuer?: string | null;
  issuerUrl?: string | null;
  stockVariantTier?: string;
  liquidityTier?: string;
  trustTier?: string;
  decimals?: number;
  market?: { price?: number | null; liquidity?: number | null; volume24hUSD?: number | null; holder?: number | null; marketCap?: number | null; priceChange24hPercent?: number | null; logoURI?: string | null } | null;
  markets: Market[];
  advisory?: unknown;
}
interface Detail {
  configured?: boolean;
  error?: string;
  asset?: {
    assetId: string;
    name: string;
    symbol: string;
    description?: string | null;
    category?: string;
    imageUrl?: string | null;
    stats?: { price?: number | null; liquidity?: number | null; volume24hUSD?: number | null; marketCap?: number | null; fdv?: number | null; priceChange24hPercent?: number | null; totalSupply?: number | null; circulatingSupply?: number | null } | null;
    canonicalMarket?: { source?: string; price?: number | null; priceChange24hPercent?: number | null } | null;
  };
  variants?: Variant[];
}

type Range = "1D" | "1W" | "1M" | "3M" | "1Y";
const LOOKTHROUGH_MINT = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";

const RIGHTS: Record<string, { voting: string; dividends: string; note: string }> = {
  xstock: { voting: "none, tracker certificate", dividends: "reinvested via the mint multiplier", note: "Backed tracker certificates. Not offered to US persons." },
  ondo: { voting: "per issuer documentation", dividends: "per issuer documentation", note: "Ondo Global Markets tokens. Not profiled by Lookthrough yet; check the issuer's terms." },
  "backpack securities": { voting: "per issuer documentation", dividends: "per issuer documentation", note: "Backpack Securities tokenized claims and entitlements, not native shares." },
  prestocks: { voting: "none, economic exposure only", dividends: "liquidity-event proceeds", note: "SPV exposure to a private company. Transfer fee and permanent delegate on the mint." }
};

export default function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const cluster = useCluster();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("1M");
  const [series, setSeries] = useState<string>("canonical");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [chartErr, setChartErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tokens/asset?assetId=${encodeURIComponent(assetId)}`)
      .then(async (r) => {
        const j = (await r.json()) as Detail;
        if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
        setD(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [assetId]);

  useEffect(() => {
    setCandles(null);
    setChartErr(null);
    const mint = series === "canonical" ? "" : `&mint=${series}`;
    fetch(`/api/tokens/price-chart?assetId=${encodeURIComponent(assetId)}&range=${range}${mint}`)
      .then(async (r) => {
        const j = (await r.json()) as { candles?: Candle[]; error?: string };
        if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
        setCandles(j.candles ?? []);
      })
      .catch((e) => setChartErr(e instanceof Error ? e.message : String(e)));
  }, [assetId, range, series]);

  if (error) return <ErrorState message={error} next="Check the asset id in the URL, or go back to the assets directory." />;
  if (!d?.asset) return <Loading what="the asset from tokens.xyz" />;
  const a = d.asset;
  const vs = d.variants ?? [];
  const ch = a.stats?.priceChange24hPercent;
  const first = candles?.[0]?.close;
  const last = candles?.[candles.length - 1]?.close;
  const rangeChange = first && last ? ((last - first) / first) * 100 : null;
  const seriesLabel = series === "canonical" ? `${a.symbol} underlying` : (vs.find((v) => v.mint === series)?.symbol ?? "wrapper");

  return (
    <div>
      <div className="small" style={{ marginBottom: 14 }}><Link href="/assets" className="muted">Assets</Link> <span className="muted">/</span> {a.symbol}</div>
      <div className="page-head">
        <div className="flex items-center gap-4">
          <Logo src={a.imageUrl} symbol={a.symbol} size="lg" />
          <div>
            <h1 className="h3">{a.name} <span className="muted">{a.symbol}</span></h1>
            <p className="body-sm">{a.category === "etf" ? "ETF" : "Equity"} · {vs.length} {vs.length === 1 ? "wrapper" : "wrappers"} on Solana · canonical price from {a.canonicalMarket?.source?.replace("clickhouse_", "") ?? "tokens.xyz"}</p>
          </div>
        </div>
        <div className="btnrow">
          {vs.some((v) => v.mint === LOOKTHROUGH_MINT) && cluster.cluster !== "devnet" ? <Link href="/portfolio" className="btn primary sm">Resolve my position</Link> : null}
          <Link href="/issuer" className="btn secondary sm">Run a record date</Link>
        </div>
      </div>

      <div className="grid-4">
        <Stat k="Price" v={fmtUsd(a.stats?.price)} s={<span className={ch == null ? "" : ch >= 0 ? "up" : "down"}>{fmtPct(ch)} 24h</span>} />
        <Stat k="Liquidity on Solana" v={fmtCompact(a.stats?.liquidity)} s="across every wrapper and venue" />
        <Stat k="Volume 24h" v={fmtCompact(a.stats?.volume24hUSD)} s="on-chain" />
        <Stat k="Tokenized supply" v={a.stats?.totalSupply != null ? a.stats.totalSupply.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "n/a"} s={a.stats?.circulatingSupply != null ? `${a.stats.circulatingSupply.toLocaleString("en-US", { maximumFractionDigits: 0 })} circulating` : undefined} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div className="h6">Price, {seriesLabel}</div>
            <div className="small" style={{ marginTop: 4 }}>
              {candles?.length ? <>{fmtUsd(last)} · <span className={rangeChange == null ? "" : rangeChange >= 0 ? "up" : "down"}>{fmtPct(rangeChange)}</span> over {range}</> : "tokens.xyz price-chart"}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select className="field" style={{ width: "auto", height: 34 }} value={series} onChange={(e) => setSeries(e.target.value)} aria-label="Series">
              <option value="canonical">{a.symbol} underlying</option>
              {vs.map((v, i) => <option key={`${v.mint}-${i}`} value={v.mint}>{v.symbol ?? v.label ?? v.mint.slice(0, 6)} on Solana</option>)}
            </select>
            <Tabs value={range} onChange={setRange} items={(["1D", "1W", "1M", "3M", "1Y"] as Range[]).map((r) => ({ id: r, label: r }))} />
          </div>
        </div>
        <div style={{ padding: "16px 12px 8px" }}>
          {chartErr ? <p className="msg red">{chartErr}</p> : candles === null ? <Loading what="candles" /> : <LineChart candles={candles} />}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div className="h6">Wrappers on Solana</div>
          <div className="small" style={{ marginTop: 4 }}>Every token that represents {a.symbol}, side by side: issuer, redemption tier, liquidity tier, price and where it trades. Tiers are tokens.xyz classifications, informational only.</div>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Wrapper</th><th>Mint</th><th>Redemption</th><th>Liquidity tier</th><th className="num">Price</th><th className="num">Liquidity</th><th className="num">Holders</th><th>Venues</th></tr>
            </thead>
            <tbody>
              {vs.map((v, i) => (
                <tr key={`${v.mint}-${i}`}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Logo src={v.market?.logoURI ?? a.imageUrl} symbol={v.symbol ?? a.symbol} size="sm" />
                      <div>
                        <div style={{ fontWeight: 500 }}>{v.symbol ?? v.name ?? "wrapper"}{v.mint === LOOKTHROUGH_MINT ? <Badge tone="green"> demo mint</Badge> : null}</div>
                        <div className="small">{v.label ?? ""}{v.issuer ? ` · ${v.issuer}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td><Address value={v.mint} href={`https://solscan.io/token/${v.mint}`} /></td>
                  <td>{v.stockVariantTier ? <Badge tone={v.stockVariantTier === "share_redeemable" ? "green" : v.stockVariantTier === "cash_redeemable" ? "blue" : "yellow"}>{v.stockVariantTier.replaceAll("_", " ")}</Badge> : <span className="muted">n/a</span>}</td>
                  <td>{v.liquidityTier ? <Badge>{v.liquidityTier}</Badge> : <span className="muted">n/a</span>}</td>
                  <td className="num">{fmtUsd(v.market?.price)}</td>
                  <td className="num">{fmtCompact(v.market?.liquidity)}</td>
                  <td className="num">{v.market?.holder != null ? v.market.holder.toLocaleString("en-US") : "n/a"}</td>
                  <td className="small">
                    {v.markets.length ? v.markets.slice(0, 3).map((m) => (
                      <div key={m.address} className="flex items-center gap-2">
                        <span>{m.name ?? m.address.slice(0, 6)}</span>
                        <span className="num muted">{fmtCompact(m.liquidity)}</span>
                        {/Raydium CLMM/i.test(m.name ?? "") || /Kamino/i.test(m.name ?? "") ? <Badge tone="green">looked through</Badge> : null}
                      </div>
                    )) : <span className="muted">none indexed</span>}
                  </td>
                </tr>
              ))}
              {vs.length === 0 ? <tr><td colSpan={8} className="muted">No wrappers indexed for this asset.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card pad">
          <div className="h6">About {a.name}</div>
          <p className="body-sm" style={{ margin: "10px 0 0" }}>{a.description ?? "No description from tokens.xyz."}</p>
          <div style={{ marginTop: 16 }}>
            <KV items={[
              { k: "Asset id", v: <span className="mono">{a.assetId}</span> },
              { k: "Market cap", v: fmtCompact(a.stats?.marketCap) },
              { k: "Tokenized FDV", v: fmtCompact(a.stats?.fdv) },
              { k: "Canonical price", v: fmtUsd(a.canonicalMarket?.price) }
            ]} />
          </div>
        </div>
        <div className="card pad">
          <div className="h6">Rights profiles by wrapper</div>
          <p className="small" style={{ marginTop: 6 }}>What each wrapper carries, from the issuers&apos; own documentation. Informational, not legal advice. Lookthrough entitlements are issuer-defined rules, never a determination of legal ownership.</p>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {vs.map((v, i) => {
              const key = (v.label ?? "").toLowerCase();
              const r = RIGHTS[key];
              return (
                <div key={`${v.mint}-${i}`} className="inset" style={{ padding: 12 }}>
                  <div className="flex items-center justify-between gap-2"><span style={{ fontWeight: 500 }}>{v.symbol ?? v.label}</span><span className="small">{v.label}</span></div>
                  {r ? (
                    <div className="small" style={{ marginTop: 6 }}>Voting: {r.voting}. Dividends: {r.dividends}. {r.note}</div>
                  ) : (
                    <div className="small" style={{ marginTop: 6 }}>Not profiled yet. Check the issuer&apos;s documentation{v.issuerUrl ? <> at <a href={v.issuerUrl} target="_blank" rel="noreferrer" style={{ borderBottom: "1px solid var(--line-strong)" }}>{v.issuerUrl.replace(/^https?:\/\//, "")}</a></> : null}.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card pad" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="h6">Run a record date on {a.symbol}</div>
          <div className="small" style={{ marginTop: 4 }}>Pick a wrapper in the issuer console, schedule the record slot, snapshot, publish the root, then fund a distribution or open a vote.</div>
        </div>
        <Link href="/issuer" className="btn primary">Open the issuer console <Icon.Arrow width={14} height={14} /></Link>
      </div>
    </div>
  );
}
