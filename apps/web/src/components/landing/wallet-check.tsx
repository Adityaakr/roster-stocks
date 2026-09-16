"use client";

import Image from "next/image";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { LookthroughClient } from "@lookthrough/sdk";
import { useDemoWallet } from "@/lib/demo-wallet";
import { useCluster } from "@/lib/cluster";
import { sharesSmart, short, slotLabel } from "@/lib/format";
import { Roll, Stagger } from "@/components/motion";

interface Row {
  source: "direct" | "raydium_clmm" | "kamino_lend";
  label: string;
  shares6: string;
  rawAmount: string;
  estimated: boolean;
}
interface Asset {
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
interface Other {
  mint: string;
  symbol: string;
  name: string;
  category: string | null;
  uiAmount: string;
  imageUrl: string | null;
}
interface WalletAssets {
  wallet: string;
  slot: number;
  configured: boolean;
  assets: Asset[];
  others: Other[];
  error?: string;
}

const VENUE: Record<Row["source"], { label: string; mark: string }> = {
  direct: { label: "In the wallet", mark: "W" },
  raydium_clmm: { label: "Raydium CLMM position", mark: "R" },
  kamino_lend: { label: "Kamino Lend deposit", mark: "K" }
};

const usd = (v: number | null) => (v == null ? null : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`);

function Logo({ src, symbol, size = 34 }: { src: string | null; symbol: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="wc-logo" style={{ width: size, height: size, fontSize: Math.round(size / 3) }}>
        {symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return <Image className="wc-logo" src={src} alt="" width={size} height={size} unoptimized onError={() => setBroken(true)} style={{ width: size, height: size }} />;
}

/** The instrument: paste a wallet, see every tokenized stock in it by name, and what a record date would miss. */
export function WalletCheck({ example, id = "check" }: { example: string | null; id?: string }) {
  const demo = useDemoWallet();
  const cluster = useCluster();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [input, setInput] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [data, setData] = useState<WalletAssets | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Record<string, string>>({});
  const [key, setKey] = useState(0);

  async function check(target?: string) {
    const w = (target ?? input).trim();
    if (!w) return;
    try {
      new PublicKey(w);
    } catch {
      setError("That is not a Solana public key.");
      setState("error");
      return;
    }
    setState("loading");
    setError(null);
    setWallet(w);
    try {
      const res = await fetch(`/api/wallet/assets?wallet=${w}`);
      const j = (await res.json()) as WalletAssets;
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
      setKey((k) => k + 1);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
      setData(null);
    }
  }

  /** Register the checked wallet for one mint: server-signed for a sample wallet, the SDK for the connected one. */
  async function register(mint: string) {
    if (!wallet) return;
    setRegistering(mint);
    setError(null);
    try {
      const name = demo.wallets.find((d) => d.pubkey === wallet)?.name;
      if (name) {
        const res = await fetch(`/api/demo/${name}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint }) });
        const j = (await res.json()) as { error?: string; slot?: string };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        setRegistered((r) => ({ ...r, [mint]: String(j.slot ?? "") }));
      } else if (anchorWallet && anchorWallet.publicKey.toBase58() === wallet) {
        const client = new LookthroughClient(connection, anchorWallet as unknown as ConstructorParameters<typeof LookthroughClient>[1]);
        await client.register(new PublicKey(mint));
        const after = await client.isRegistered(new PublicKey(mint));
        setRegistered((r) => ({ ...r, [mint]: String(after.slot ?? "") }));
      } else {
        throw new Error("Connect this wallet to sign its registration.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegistering(null);
    }
  }

  const canSign = !!wallet && (demo.wallets.some((d) => d.pubkey === wallet) || anchorWallet?.publicKey.toBase58() === wallet);
  const inputId = `${id}-input`;
  const tryExample = example ? (
    <button type="button" className="mono link" onClick={() => { setInput(example); void check(example); }}>{short(example, 4)}</button>
  ) : null;

  return (
    <div className="wc">
      <form className="wc-form" onSubmit={(e) => { e.preventDefault(); void check(); }}>
        <label htmlFor={inputId} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Solana wallet</label>
        <input id={inputId} className="field mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste any Solana wallet" autoComplete="off" spellCheck={false} />
        <button className="btn primary" type="submit" style={{ flex: "none" }} disabled={state === "loading" || !input.trim()}>
          <Roll>{state === "loading" ? "Reading" : "Check wallet"}</Roll>
        </button>
      </form>

      {state === "loading" ? <p className="note wc-note">Reading token accounts, pool positions and vault deposits on {cluster.label.toLowerCase()}.</p> : null}
      {state === "error" && error ? <p className="note wc-note" style={{ color: "var(--amber)" }} role="alert">{error}</p> : null}

      {data && wallet && state !== "loading" ? (
        data.assets.length === 0 ? (
          <div className="wc-empty">
            <p className="body" style={{ margin: 0 }}>No tokenized stock in this wallet.{tryExample ? <> Try {tryExample}.</> : null}</p>
            {data.others.length ? (
              <p className="note" style={{ marginTop: 10 }}>
                It holds {data.others.slice(0, 4).map((o, i) => <span key={o.mint}>{i ? ", " : ""}<b style={{ color: "var(--ink-2)", fontWeight: 500 }}>{o.symbol}</b></span>)}
                {data.others.length > 4 ? ` and ${data.others.length - 4} more` : ""}, which the directory does not classify as equities, so no record date applies to them.
              </p>
            ) : null}
          </div>
        ) : (
          <Stagger key={key} step={0.12} className="wc-assets">
            {[
              ...data.assets.map((a) => {
                const total = BigInt(a.shares6);
                const visible = BigInt(a.visibleShares6);
                const hidden = total - visible;
                const value = a.priceUsd != null && total > 0n ? usd((Number(total) / 1e6) * a.priceUsd) : null;
                const reg = registered[a.mint];
                return (
                  <div key={a.mint} className="wc-asset">
                    <div className="wc-head">
                      <Logo src={a.imageUrl} symbol={a.symbol} />
                      <div className="min-w-0">
                        <div className="wc-sym">{a.symbol}{a.wrapper ? <span className="wc-wrap">{a.wrapper}</span> : null}</div>
                        <div className="note">{a.name}</div>
                      </div>
                      <div className="wc-amt">
                        <div className="mono num">{sharesSmart(total)}</div>
                        <div className="note">share equivalents{value ? ` · ${value}` : ""}</div>
                      </div>
                    </div>
                    {a.rows.length ? (
                      <>
                        <div className="wc-rows">
                          {a.rows.map((r, i) => (
                            <div key={`${r.source}-${i}`} className="wc-row">
                              <span className="wc-mark">{VENUE[r.source].mark}</span>
                              <span className="wc-where">{VENUE[r.source].label}{r.estimated ? <span className="note"> estimated</span> : null}</span>
                              <span className="mono num">{sharesSmart(r.shares6)}</span>
                            </div>
                          ))}
                          {a.rows.length > 1 ? (
                            <div className="wc-row total">
                              <span className="wc-mark" aria-hidden />
                              <span className="wc-where">Share equivalents</span>
                              <span className="mono num">{sharesSmart(total)}</span>
                            </div>
                          ) : null}
                        </div>
                        <p className="wc-verdict">
                          {hidden > 0n ? (
                            <>A wallet scan sees <b>{sharesSmart(visible)}</b>. <b>{sharesSmart(hidden)}</b> of this {a.symbol} is invisible to the issuer.</>
                          ) : (
                            <>All of it sits in the wallet, so a record date can see it today. Move any into a pool or a vault and the issuer loses that part.</>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="wc-verdict">
                        Balance <b>{a.uiAmount} {a.symbol}</b>. The look-through did not run on {cluster.label.toLowerCase()} just now, so pool and vault positions are not counted here.
                      </p>
                    )}
                    <div className="wc-actions">
                      {reg ? (
                        <span className="mono" style={{ fontSize: 13, color: "var(--green)" }}>Registered at slot {slotLabel(reg)}</span>
                      ) : (
                        <button className="btn primary" onClick={() => register(a.mint)} disabled={registering !== null || !canSign} title={canSign ? undefined : "Connect this wallet to sign its registration"}>
                          <Roll>{registering === a.mint ? "Registering" : `Register for ${a.symbol}`}</Roll>
                        </button>
                      )}
                      {!canSign && !reg ? <span className="note">Connect this wallet to sign its registration.</span> : null}
                    </div>
                  </div>
                );
              }),
              ...(data.others.length
                ? [
                    <div key="others" className="wc-others">
                      <span className="note">Also holds</span>
                      {data.others.slice(0, 5).map((o) => (
                        <span key={o.mint} className="wc-chip"><Logo src={o.imageUrl} symbol={o.symbol} size={16} />{o.symbol}</span>
                      ))}
                      <span className="note">{data.others.length > 5 ? `and ${data.others.length - 5} more, ` : ""}not equities, so no record date applies.</span>
                    </div>
                  ]
                : []),
              <p key="foot" className="note wc-foot">
                Read at slot {slotLabel(data.slot)} on {cluster.label.toLowerCase()}. Attributed under issuer-defined rules. Not a determination of legal ownership.
                {error ? <span style={{ color: "var(--amber)" }}> {error}</span> : null}
              </p>
            ]}
          </Stagger>
        )
      ) : null}

      {!data && state !== "loading" && state !== "error" ? (
        <p className="note wc-note">
          {example ? <>Nothing checked yet. Try {tryExample} to see what a pool hides.</> : "Reads the wallet's balances, pool positions and vault deposits on the network in the masthead."}
        </p>
      ) : null}
    </div>
  );
}
