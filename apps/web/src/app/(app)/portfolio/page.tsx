"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LookthroughClient } from "@lookthrough/sdk";
import { useDemoWallet } from "@/lib/demo-wallet";
import { explorerUrl, useCluster } from "@/lib/cluster";
import { pct, shares, short, slotLabel, timeLabel, usdc } from "@/lib/format";
import { Address, Badge, Empty, ErrorState, KV, Loading, Stat } from "@/components/ui";
import { M } from "@/components/mono";
import { Icon } from "@/components/icons";
import { verifyLocally } from "@/lib/merkle-browser";

interface LedgerRow {
  source: "direct" | "raydium_clmm" | "kamino_lend";
  container: string;
  label: string;
  rawAmount: string;
  shares6: string;
  estimated: boolean;
  evidence: Record<string, unknown>;
}
interface ActionStanding {
  id: string;
  kind: "distribution" | "vote";
  title: string;
  status: string;
  snapshotSlot: number;
  root: string;
  amountPerShareMicro: string | null;
  question: string | null;
  entitlement: string | null;
  inTree: boolean;
  funded: boolean | null;
  closed: boolean | null;
  receipt: { entitlement: string; amountPaid: string; choice: string | null; slot: string } | null;
  tally: { for: string; against: string; abstain: string; voters: number } | null;
}
interface LedgerResponse {
  ledger: { wallet: string; mint: string; slot: number; timestamp: number; multiplier: string; decimals: number; rows: LedgerRow[]; walletVisibleShares6: string; totalShares6: string };
  registration: { registered: boolean; slot?: string };
  actions: ActionStanding[];
}
interface Resolved {
  assetId?: string;
  asset?: { name: string; symbol: string };
  variant?: { label?: string | null; stockVariantTier?: string; liquidityTier?: string; issuer?: string | null; symbol?: string; name?: string } | null;
}

const RULE: Record<LedgerRow["source"], string> = {
  direct: "balance × multiplier",
  raydium_clmm: "liquidity at the pool price plus fees owed, pro rata to the vault",
  kamino_lend: "cTokens × vault balance ÷ cToken supply"
};

export default function PortfolioPage() {
  const demo = useDemoWallet();
  const cluster = useCluster();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const mint = cluster.demoMint ?? process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "";
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "green" | "red" } | null>(null);
  const [proofOpen, setProofOpen] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, "for" | "against" | "abstain">>({});
  const [lastTx, setLastTx] = useState<Record<string, string>>({});
  const wallet = demo.activePubkey;

  const load = useCallback(async () => {
    if (!wallet || !mint) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/holder/ledger?wallet=${wallet}&mint=${mint}`);
      const j = (await res.json()) as LedgerResponse & { error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [wallet, mint]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mint || cluster.cluster === "devnet") return;
    fetch(`/api/tokens/resolve?mint=${mint}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resolved | null) => setResolved(j && "assetId" in (j as object) ? j : null))
      .catch(() => setResolved(null));
  }, [mint, cluster.cluster]);

  const say = (text: string, tone: "green" | "red" = "green") => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 5000);
  };

  /** Demo wallets are server-signed; a browser wallet signs through the SDK. */
  async function act(kind: "register" | "claim" | "vote", actionId?: string, voteChoice?: "for" | "against" | "abstain") {
    if (!wallet) return;
    setBusy(`${kind}:${actionId ?? ""}`);
    try {
      if (demo.isDemo) {
        const res = await fetch(`/api/demo/${demo.selected}/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint, actionId, choice: voteChoice }) });
        const j = (await res.json()) as { error?: string; amountPaid?: string; signature?: string | null; slot?: string };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        if (actionId && j.signature) setLastTx((t) => ({ ...t, [actionId]: j.signature as string }));
        say(kind === "register" ? `Registered at slot ${slotLabel(j.slot ?? 0)}.` : kind === "claim" ? `Claimed ${usdc(j.amountPaid ?? "0")} USDC${j.signature ? `, tx ${short(j.signature, 6)}` : ""}.` : `Cast ${voteChoice}.`);
      } else {
        if (!anchorWallet) throw new Error("Connect a wallet first.");
        const client = new LookthroughClient(connection, anchorWallet as unknown as ConstructorParameters<typeof LookthroughClient>[1]);
        if (kind === "register") {
          await client.register(new PublicKey(mint));
          const after = await client.isRegistered(new PublicKey(mint));
          say(`Registered at slot ${slotLabel(after.slot ?? 0)}.`);
        } else {
          const pr = await fetch(`/api/actions/${actionId}/proof?wallet=${wallet}`).then((r) => r.json() as Promise<{ inTree: boolean; leaf?: { entitlement: string; proof: string[] } }>);
          if (!pr.inTree || !pr.leaf) throw new Error("This wallet is not in the tree for that action.");
          const a = data?.actions.find((x) => x.id === actionId);
          const idHex = await fetch(`/api/actions/${actionId}`).then((r) => r.json() as Promise<{ action: { actionIdHex: string } }>);
          const id = new Uint8Array(Buffer.from(idHex.action.actionIdHex, "hex"));
          const proof = pr.leaf.proof.map((h) => new Uint8Array(Buffer.from(h, "hex")));
          if (kind === "claim") {
            const sig = await client.claim(id, BigInt(pr.leaf.entitlement), proof);
            if (actionId) setLastTx((t) => ({ ...t, [actionId]: sig }));
            say(`Claimed ${usdc((BigInt(pr.leaf.entitlement) * BigInt(a?.amountPerShareMicro ?? "0")) / 1_000_000n)} USDC, tx ${short(sig, 6)}.`);
          } else {
            await client.castVote(id, BigInt(pr.leaf.entitlement), proof, voteChoice ?? "for");
            say(`Cast ${voteChoice}.`);
          }
        }
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      say(msg.length > 200 ? msg.slice(0, 200) : msg, "red");
    } finally {
      setBusy(null);
    }
  }

  async function faucet() {
    if (!wallet) return;
    setBusy("faucet");
    try {
      const res = await fetch("/api/devnet/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet }) });
      const j = (await res.json()) as { error?: string; shares?: number; signature?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      say(`Minted ${j.shares} demo shares to this wallet. Transaction ${short(j.signature ?? "", 6)}.`);
      await load();
    } catch (err) {
      say(err instanceof Error ? err.message : String(err), "red");
    } finally {
      setBusy(null);
    }
  }

  const rows = data?.ledger.rows ?? [];
  const total = data ? BigInt(data.ledger.totalShares6) : 0n;
  const visible = data ? BigInt(data.ledger.walletVisibleShares6) : 0n;
  const symbol = cluster.cluster === "devnet" ? "LTAAPL" : (resolved?.variant?.symbol ?? "AAPLx");
  const name = cluster.cluster === "devnet" ? "Lookthrough demo stock" : (resolved?.asset?.name ?? "Apple xStock");
  const isXStock = cluster.cluster !== "devnet" && ((resolved?.variant?.label ?? "").toLowerCase() === "xstock" || symbol.endsWith("x"));
  const openCount = data ? data.actions.filter((a) => a.inTree && !a.receipt && (a.status === "funded" || a.status === "open")).length : 0;

  if (!wallet) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="h3">Portfolio</h1>
            <p className="body-sm">Everything a wallet holds of a tokenized stock, including what sits in DeFi, and every corporate action it can act on with a proof.</p>
          </div>
        </div>
        <Empty
          title="No wallet connected."
          action={cluster.cluster === "devnet" ? "Connect a Solana wallet set to devnet, or use a demo wallet signed by the server." : "Use a demo wallet, or connect your own to read its positions on the fork."}
          cta={
            <>
              <button className="btn primary" onClick={() => setVisible(true)}>Connect wallet</button>
              {demo.enabled && demo.wallets.length ? <button className="btn secondary" onClick={() => demo.select("alice")}>Use demo wallet</button> : null}
            </>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="h3">Portfolio</h1>
          <p className="body-sm">
            {demo.isDemo ? `${demo.selected?.[0]?.toUpperCase()}${demo.selected?.slice(1)}, a demo wallet signed by the server` : "Your wallet"} · <span className="mono">{short(wallet, 6)}</span> · {name} ({symbol})
          </p>
        </div>
        <div className="btnrow">
          {cluster.faucet ? (
            <button className="btn secondary" onClick={faucet} disabled={busy !== null}>{busy === "faucet" ? "Minting" : "Get demo shares"}</button>
          ) : null}
          {data && !data.registration.registered ? (
            <button className="btn primary" disabled={busy !== null} onClick={() => act("register")}>{busy === "register:" ? "Registering" : "Register for corporate actions"}</button>
          ) : null}
          <button className="btn ghost" onClick={() => load()} disabled={loading}>{loading ? "Resolving" : "Refresh"}</button>
        </div>
      </div>

      {notice ? <div className={`card pad msg ${notice.tone}`} role="status" style={{ marginBottom: 16, padding: "12px 16px" }}>{notice.text}</div> : null}
      {error ? <div style={{ marginBottom: 16 }}><ErrorState message={error} next={cluster.cluster === "devnet" ? "The devnet RPC may be rate-limited; try again in a few seconds." : "The portfolio needs the fork. Check pnpm fork and reload."} /></div> : null}
      {loading && !data ? <Loading what="positions from chain" /> : null}

      {data ? (
        <>
          <div className="grid-4">
            <Stat k="A wallet scan sees" v={`${shares(visible, 2, 2)}`} s="shares in the wallet" />
            <Stat k="Lookthrough resolves" v={`${shares(total, 2, 2)}`} s={total > visible ? `${shares(total - visible, 2, 2)} recovered from DeFi positions` : "share equivalents"} tone="green" />
            <Stat k="Registration" v={data.registration.registered ? "Registered" : "Not registered"} s={data.registration.registered ? `slot ${slotLabel(data.registration.slot ?? 0)}` : "one signature, public, no identity"} tone={data.registration.registered ? "green" : undefined} />
            <Stat k="Open to you" v={String(openCount)} s={data.actions.length ? `of ${data.actions.length} record dates` : "no record dates yet"} />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div className="h6">Positions</div>
                <div className="small" style={{ marginTop: 4 }}>Read at slot {slotLabel(data.ledger.slot)}, {timeLabel(data.ledger.timestamp)}. Multiplier {data.ledger.multiplier}.</div>
              </div>
              <Badge tone="blue">{pct(visible, total)}% visible to a wallet scan</Badge>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Where</th><th>Container</th><th className="num">Raw balance</th><th className="num">Share equivalents</th><th>Rule</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        No tokenized stock in this wallet. Connect one that holds a position, or <Link href="/assets" style={{ borderBottom: "1px solid var(--line-strong)" }}>browse the directory</Link>.{cluster.faucet ? " On devnet, Get demo shares mints some." : ""}
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((r, i) => (
                    <tr key={`${r.container}-${i}`}>
                      <td>
                        <div className="flex items-center gap-2">{r.label}{r.estimated ? <Badge tone="yellow">estimated</Badge> : null}</div>
                      </td>
                      <td><Address value={r.container} href={explorerUrl(cluster, "address", r.container)} /></td>
                      <td className="num">{BigInt(r.rawAmount).toLocaleString("en-US")}</td>
                      <td className="num">{shares(r.shares6)}</td>
                      <td className="small">
                        {RULE[r.source]}
                        <details>
                          <summary className="mono" style={{ cursor: "pointer" }}>evidence</summary>
                          <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", maxWidth: 420, margin: "6px 0 0", fontSize: 11 }}>{JSON.stringify(r.evidence, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length ? (
                  <tfoot>
                    <tr><td>Resolved</td><td /><td /><td className="num">{shares(total)}</td><td className="small">{rows.some((r) => r.estimated) ? "estimated rows use current pool and reserve state; the record-date snapshot is the number that counts" : ""}</td></tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 16, gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
            <div className="card">
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
                <div className="h6">Record dates</div>
                <div className="small" style={{ marginTop: 4 }}>A claim or vote is one transaction: the program checks registration before the record slot, inclusion in the tree, and single use.</div>
              </div>
              {data.actions.length === 0 ? (
                <div style={{ padding: 20 }}>
                  <p className="body-sm" style={{ margin: 0 }}>No record dates have been snapshotted for this mint yet.</p>
                  <div className="btnrow" style={{ marginTop: 12 }}><Link href="/issuer" className="btn secondary sm">Open the issuer console</Link></div>
                </div>
              ) : (
                data.actions.map((a) => {
                  const ent = a.entitlement ? BigInt(a.entitlement) : 0n;
                  const pay = a.amountPerShareMicro ? (ent * BigInt(a.amountPerShareMicro)) / 1_000_000n : 0n;
                  const claimed = a.receipt && a.kind === "distribution";
                  const voted = a.receipt && a.kind === "vote";
                  const regSlot = data.registration.registered ? BigInt(data.registration.slot ?? "0") : null;
                  const lateRegistration = regSlot === null || regSlot > BigInt(a.snapshotSlot);
                  const open = (a.status === "funded" || a.status === "open") && !lateRegistration;
                  const c = choice[a.id] ?? "for";
                  return (
                    <div key={a.id} style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)" }}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/actions/${a.id}`} className="h6" style={{ borderBottom: "1px solid var(--line-strong)" }}>{a.title}</Link>
                            <Badge tone={a.status === "funded" || a.status === "open" ? "green" : a.status === "closed" ? undefined : "yellow"} dot>{a.status}</Badge>
                            {a.kind === "vote" ? <Badge tone="purple">vote</Badge> : <Badge tone="blue">distribution</Badge>}
                          </div>
                          <div className="small" style={{ marginTop: 6 }}>
                            {a.kind === "distribution" ? `${usdc(a.amountPerShareMicro ?? "0")} USDC per share, demo-funded` : `${a.question}. Simulated issuer; ${isXStock ? "xStocks carry no voting rights" : "demo token"}`}. Record slot {slotLabel(a.snapshotSlot)}.
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            {a.inTree ? <>Entitlement at the record date <b style={{ color: "var(--text)" }}>{shares(ent)}</b> shares{lateRegistration ? ". This wallet registered after the record slot, so the program will not accept a claim or vote on this action." : ""}</> : "Not in this tree: not registered at the record date, or no exposure."}
                          </div>
                          {a.tally && a.kind === "vote" ? (
                            <div className="small num" style={{ marginTop: 6 }}>for {shares(a.tally.for)} · against {shares(a.tally.against)} · abstain {shares(a.tally.abstain)} · voters {a.tally.voters}</div>
                          ) : null}
                        </div>
                        <div style={{ textAlign: "right", display: "grid", gap: 8, justifyItems: "end" }}>
                          <div className="h4 num">{a.kind === "distribution" ? `${usdc(claimed ? (a.receipt?.amountPaid ?? "0") : pay)} USDC` : `${shares(voted ? (a.receipt?.entitlement ?? "0") : ent, 2, 2)} votes`}</div>
                          {claimed ? (
                            <span className="msg green">Claimed, slot <M>{slotLabel(a.receipt?.slot ?? 0)}</M>{lastTx[a.id] ? <>, tx <M>{short(lastTx[a.id] ?? "", 4)}</M></> : null}</span>
                          ) : voted ? (
                            <span className="msg green">Cast {a.receipt?.choice}, slot <M>{slotLabel(a.receipt?.slot ?? 0)}</M></span>
                          ) : a.kind === "distribution" ? (
                            <button className="btn primary sm" disabled={!a.inTree || !open || busy !== null} onClick={() => act("claim", a.id)}>{busy === `claim:${a.id}` ? "Claiming" : <>Claim <M>{usdc(pay)}</M> USDC</>}</button>
                          ) : (
                            <div className="btnrow">
                              <select className="field" style={{ height: 32, width: "auto", fontSize: 13 }} value={c} onChange={(e) => setChoice((s) => ({ ...s, [a.id]: e.target.value as "for" | "against" | "abstain" }))} aria-label="Vote choice">
                                <option value="for">For</option><option value="against">Against</option><option value="abstain">Abstain</option>
                              </select>
                              <button className="btn primary sm" disabled={!a.inTree || !open || busy !== null} onClick={() => act("vote", a.id, c)}>{busy === `vote:${a.id}` ? "Casting" : <>Cast <M>{shares(ent, 0, 0)}</M> votes</>}</button>
                            </div>
                          )}
                          <button className="copy" onClick={() => setProofOpen(proofOpen === a.id ? null : a.id)} disabled={!a.inTree}>{proofOpen === a.id ? "hide proof" : "show proof"}</button>
                        </div>
                      </div>
                      {proofOpen === a.id ? <ProofDrawer actionId={a.id} wallet={wallet} mint={mint} /> : null}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <div className="card pad">
                <div className="h6">Asset</div>
                <div style={{ marginTop: 12 }}>
                  <KV
                    items={[
                      { k: "Token", v: `${name} (${symbol})` },
                      { k: "Mint", v: <Address value={mint} href={explorerUrl(cluster, "address", mint)} /> },
                      ...(resolved?.variant?.label ? [{ k: "Wrapper", v: `${resolved.variant.label}${resolved.variant.issuer ? `, ${resolved.variant.issuer}` : ""}` }] : []),
                      { k: "Cluster", v: cluster.label },
                      { k: "Program", v: cluster.programId ? <Address value={cluster.programId} href={explorerUrl(cluster, "address", cluster.programId)} /> : "n/a" }
                    ]}
                  />
                </div>
                {resolved?.assetId ? <div className="btnrow" style={{ marginTop: 14 }}><Link href={`/assets/${resolved.assetId}`} className="btn ghost sm">Asset page <Icon.Arrow width={14} height={14} /></Link></div> : null}
              </div>
              <div className="card pad">
                <div className="h6">Rights profile</div>
                <p className="small" style={{ marginTop: 6 }}>What this wrapper carries, from tokens.xyz and the token&apos;s own documentation. Informational, not legal advice.</p>
                <div style={{ marginTop: 12 }}>
                  <KV
                    items={[
                      { k: "Wrapper", v: cluster.cluster === "devnet" ? "demo mint, Token-2022" : (resolved?.variant?.label ?? (isXStock ? "xStock" : "unknown")) },
                      { k: "Redemption", v: cluster.cluster === "devnet" ? "none, test token" : (resolved?.variant?.stockVariantTier?.replaceAll("_", " ") ?? "not resolved") },
                      { k: "Liquidity tier", v: cluster.cluster === "devnet" ? "n/a" : (resolved?.variant?.liquidityTier ?? "not resolved") },
                      ...(isXStock ? [{ k: "Voting rights", v: "none, tracker certificate" }, { k: "Dividends", v: "reinvested via the multiplier" }, { k: "US persons", v: "not offered" }] : []),
                      { k: "Entitlements", v: "issuer-defined rules" }
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Leaf bytes, proof path, on-chain root, and a local verify that runs in the browser. */
function ProofDrawer({ actionId, wallet, mint }: { actionId: string; wallet: string; mint: string }) {
  const [state, setState] = useState<{ root: string; onchainRoot: string | null; actionIdHex: string; snapshotSlot: number; leaf: { entitlement: string; leaf: string; proof: string[] } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof verifyLocally> | null>(null);
  useEffect(() => {
    Promise.all([fetch(`/api/actions/${actionId}/proof?wallet=${wallet}`).then((r) => r.json()), fetch(`/api/actions/${actionId}`).then((r) => r.json())])
      .then(([p, a]: [{ inTree: boolean; root?: string; leaf?: { entitlement: string; leaf: string; proof: string[] } }, { action: { actionIdHex: string; snapshot?: { slotActual: number } }; onchain: { root?: string } | null }]) => {
        if (!p.inTree || !p.leaf || !p.root) throw new Error("Not in the tree.");
        setState({ root: p.root, onchainRoot: a.onchain?.root ?? null, actionIdHex: a.action.actionIdHex, snapshotSlot: a.action.snapshot?.slotActual ?? 0, leaf: p.leaf });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [actionId, wallet]);
  if (error) return <div className="msg red" style={{ marginTop: 12 }}>{error}</div>;
  if (!state) return <div className="msg" style={{ marginTop: 12 }}>Loading proof.</div>;
  return (
    <div className="inset proof" style={{ marginTop: 14, padding: 14 }}>
      <div><span className="k">leaf</span>{state.leaf.leaf}</div>
      <div><span className="k">preimage</span>0x00 · action id · wallet · mint · slot {slotLabel(state.snapshotSlot)} u64 LE · entitlement {state.leaf.entitlement} u64 LE</div>
      {state.leaf.proof.map((p, i) => (
        <div key={p}><span className="k">sibling {i + 1}</span>{p}</div>
      ))}
      <div><span className="k">published root</span>{state.root}</div>
      <div><span className="k">on-chain root</span>{state.onchainRoot ?? "not published yet"}</div>
      <div className="btnrow" style={{ marginTop: 10 }}>
        <button className="btn ghost sm" onClick={() => setResult(verifyLocally({ actionIdHex: state.actionIdHex, wallet, mint, snapshotSlot: state.snapshotSlot, entitlement: state.leaf.entitlement, proof: state.leaf.proof, root: state.onchainRoot ?? state.root }))}>Verify in this browser</button>
        {result ? result.ok ? <span className="msg green">proof verifies against the {state.onchainRoot ? "on-chain" : "published"} root</span> : <span className="msg red">proof does not verify</span> : null}
      </div>
    </div>
  );
}
