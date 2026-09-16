"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { pct, shares, slotLabel, timeLabel, usdc } from "@/lib/format";
import { Address, Badge, ErrorState, KV, Loading, Stat } from "@/components/ui";
import { explorerUrl, useCluster } from "@/lib/cluster";
import { verifyLocally } from "@/lib/merkle-browser";

interface ActionResponse {
  action: {
    id: string;
    actionIdHex: string;
    kind: "distribution" | "vote";
    mint: string;
    title: string;
    status: string;
    recordSlot: number;
    amountPerShareMicro?: string;
    question?: string;
    snapshot?: { slotActual: number; timestamp: number; root: string; contentHash: string; totalEntitlement: string; leaves: number; attributedPct: string; reusedFrom?: string };
    onchain?: { actionPda: string; createTx: string; fundTx?: string; vault?: string };
  };
  onchain: { root: string; contentHash: string; funded: boolean; claimedTotal: string; forWeight: string; againstWeight: string; abstainWeight: string; voters: number; closed: boolean; snapshotSlot: string } | { error: string } | null;
  tree: { root: string; totalEntitlement: string; leaves: { wallet: string; entitlement: string }[] } | null;
  forkUp: boolean;
}
interface Entitlements {
  multiplier: string;
  multiplierSource: string;
  accountsScanned: number;
  attributedRaw: string;
  unattributedRaw: string;
  unattributed: { container: string; program: string | null; label: string; raw: string }[];
  adaptersUsed: { id: string; status: string; containers: number }[];
  invariants: { ok: boolean; warnings: string[] };
}

export default function ActionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const cluster = useCluster();
  const [data, setData] = useState<ActionResponse | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState("");
  const [lookup, setLookup] = useState<{ ok: boolean; entitlement: string; leaf: string; proof: string[]; message?: string } | null>(null);

  useEffect(() => {
    fetch(`/api/actions/${id}`)
      .then(async (r) => {
        const j = (await r.json()) as ActionResponse & { error?: string };
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    fetch(`/actions/${id}/entitlements.json`).then((r) => (r.ok ? r.json() : null)).then((j) => setEnt(j as Entitlements | null)).catch(() => setEnt(null));
  }, [id]);

  async function lookupWallet() {
    if (!data?.action.snapshot) return;
    const p = (await fetch(`/api/actions/${id}/proof?wallet=${wallet.trim()}`).then((r) => r.json())) as { inTree: boolean; root?: string; leaf?: { entitlement: string; leaf: string; proof: string[] }; message?: string };
    if (!p.inTree || !p.leaf || !p.root) {
      setLookup({ ok: false, entitlement: "0", leaf: "", proof: [], message: p.message ?? "Not in the tree." });
      return;
    }
    const onchainRoot = data.onchain && "root" in data.onchain ? data.onchain.root : p.root;
    const r = verifyLocally({ actionIdHex: data.action.actionIdHex, wallet: wallet.trim(), mint: data.action.mint, snapshotSlot: data.action.snapshot.slotActual, entitlement: p.leaf.entitlement, proof: p.leaf.proof, root: onchainRoot });
    setLookup({ ok: r.ok, entitlement: p.leaf.entitlement, leaf: r.leaf, proof: p.leaf.proof });
  }

  if (error) return <ErrorState message={error} next="Check the action id in the URL, or open the record list." />;
  if (!data) return <Loading what="the action" />;
  const a = data.action;
  const oc = data.onchain && "root" in data.onchain ? data.onchain : null;
  const totalRaw = ent ? BigInt(ent.attributedRaw) + BigInt(ent.unattributedRaw) : 0n;
  const grouped = ent ? Object.entries(ent.unattributed.reduce<Record<string, bigint>>((acc, u) => ((acc[u.label] = (acc[u.label] ?? 0n) + BigInt(u.raw)), acc), {})).sort((x, y) => (x[1] > y[1] ? -1 : 1)) : [];
  const rootMatch = oc ? oc.root === a.snapshot?.root : null;
  const hashMatch = oc ? oc.contentHash === a.snapshot?.contentHash : null;

  return (
    <div>
      <div className="small" style={{ marginBottom: 14 }}><Link href="/actions" className="muted">Record dates</Link> <span className="muted">/</span> {a.id}</div>
      <div className="page-head">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="h3">{a.title}</h1>
            <Badge tone={a.status === "funded" || a.status === "open" ? "green" : a.status === "closed" ? undefined : "yellow"} dot>{a.status}</Badge>
            <Badge tone={a.kind === "vote" ? "purple" : "blue"}>{a.kind}</Badge>
          </div>
          <p className="body-sm">{a.kind === "distribution" ? `${usdc(a.amountPerShareMicro ?? "0")} USDC per share equivalent, demo-funded` : `${a.question}. Simulated issuer; the token carries no voting rights of its own`}.{a.snapshot?.reusedFrom ? <> Entitlement set reused from <Link href={`/actions/${a.snapshot.reusedFrom}`} style={{ borderBottom: "1px solid var(--line-strong)" }}>{a.snapshot.reusedFrom}</Link>, which shares this record date.</> : null}</p>
        </div>
        {a.snapshot ? <a className="btn secondary sm" href={`/actions/${id}/entitlements.json`} download>Download entitlements.json</a> : null}
      </div>

      {a.snapshot ? (
        <div className="grid-4">
          <Stat k="Record slot" v={slotLabel(a.snapshot.slotActual)} s={`requested ${slotLabel(a.recordSlot)} · ${timeLabel(a.snapshot.timestamp)}`} />
          <Stat k="Attributed" v={`${a.snapshot.attributedPct}%`} s={ent ? `${ent.accountsScanned.toLocaleString("en-US")} token accounts` : "of token-account supply"} tone="green" />
          <Stat k="Leaves" v={String(a.snapshot.leaves)} s={`${shares(a.snapshot.totalEntitlement)} shares in total`} />
          <Stat k={a.kind === "distribution" ? "Claimed so far" : "Voters"} v={oc ? (a.kind === "distribution" ? `${usdc(oc.claimedTotal)} USDC` : String(oc.voters)) : "n/a"} s={oc ? (a.kind === "distribution" ? (oc.funded ? "funded, claims open" : "not funded yet") : `for ${shares(oc.forWeight, 2, 2)} · against ${shares(oc.againstWeight, 2, 2)} · abstain ${shares(oc.abstainWeight, 2, 2)}`) : data.forkUp ? "program state unavailable" : "chain not reachable"} />
        </div>
      ) : (
        <div className="card pad"><p className="body-sm" style={{ margin: 0 }}>Not snapshotted yet. Record slot {slotLabel(a.recordSlot)}.</p></div>
      )}

      {a.snapshot ? (
        <div className="grid-2" style={{ marginTop: 16, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)" }}>
          <div className="card pad">
            <div className="h6">Certificate</div>
            <div className="small" style={{ marginTop: 4 }}>What went on-chain: the root, the content hash of the entitlement file, and the slot. Anyone can recompute the root from the file.</div>
            <div className="inset proof" style={{ marginTop: 14, padding: 14 }}>
              <div><span className="k">root</span>{a.snapshot.root}</div>
              <div><span className="k">content hash</span>{a.snapshot.contentHash}</div>
              <div><span className="k">action id</span>{a.actionIdHex}</div>
            </div>
            <div style={{ marginTop: 14 }}>
              <KV items={[
                { k: "Mint", v: <Address value={a.mint} href={explorerUrl(cluster, "address", a.mint)} /> },
                ...(ent ? [{ k: "Multiplier", v: `${ent.multiplier} (${ent.multiplierSource})` }] : []),
                ...(a.onchain ? [{ k: "Action account", v: <Address value={a.onchain.actionPda} href={explorerUrl(cluster, "address", a.onchain.actionPda)} /> }, { k: "Create transaction", v: <Address value={a.onchain.createTx} href={explorerUrl(cluster, "tx", a.onchain.createTx)} /> }] : [{ k: "On-chain", v: <Badge tone="yellow">not published yet</Badge> }]),
                ...(a.onchain?.fundTx ? [{ k: "Fund transaction", v: <Address value={a.onchain.fundTx} href={explorerUrl(cluster, "tx", a.onchain.fundTx)} /> }] : []),
                ...(oc ? [{ k: "Root on-chain", v: <Badge tone={rootMatch ? "green" : "red"} dot>{rootMatch ? "matches" : "differs"}</Badge> }, { k: "Content hash on-chain", v: <Badge tone={hashMatch ? "green" : "red"} dot>{hashMatch ? "matches" : "differs"}</Badge> }] : [])
              ]} />
            </div>
          </div>
          <div className="card pad">
            <div className="h6">Look up a wallet</div>
            <div className="small" style={{ marginTop: 4 }}>Recomputes the leaf and walks the proof to the {oc ? "on-chain" : "published"} root, in this browser.</div>
            <div className="flex gap-2" style={{ marginTop: 14 }}>
              <input className="field" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Wallet public key" aria-label="Wallet public key" onKeyDown={(e) => e.key === "Enter" && lookupWallet()} />
              <button className="btn primary" onClick={lookupWallet} disabled={!wallet.trim()}>Look up</button>
            </div>
            {lookup ? (
              lookup.ok ? (
                <div className="inset proof" style={{ marginTop: 14, padding: 14 }}>
                  <div className="msg green" style={{ marginBottom: 6 }}>In the tree with {shares(lookup.entitlement)} shares; proof verifies.</div>
                  <div><span className="k">leaf</span>{lookup.leaf}</div>
                  {lookup.proof.map((p, i) => <div key={p}><span className="k">sibling {i + 1}</span>{p}</div>)}
                </div>
              ) : (
                <p className="msg red" style={{ marginTop: 12 }}>{lookup.message ?? "Proof does not verify against the root."}</p>
              )
            ) : null}
            {data.tree ? (
              <details style={{ marginTop: 14 }}>
                <summary className="small" style={{ cursor: "pointer" }}>All {data.tree.leaves.length} leaves</summary>
                <table className="table" style={{ marginTop: 8 }}>
                  <tbody>
                    {data.tree.leaves.map((l) => (
                      <tr key={l.wallet}><td><Address value={l.wallet} href={explorerUrl(cluster, "address", l.wallet)} /></td><td className="num">{shares(l.entitlement)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}

      {ent ? (
        <div className="card pad" style={{ marginTop: 16 }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="h6">Supply at the snapshot</div>
              <div className="small" style={{ marginTop: 4 }}>Attributed plus unattributed equals the supply held in token accounts. Double counted 0.</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ent.adaptersUsed.map((x) => <Badge key={x.id} tone={x.status === "implemented" ? "green" : undefined}>{x.id.replaceAll("_", " ")} · {x.containers}</Badge>)}
            </div>
          </div>
          <div className="bar" style={{ marginTop: 14 }}>
            <span style={{ width: `${pct(ent.attributedRaw, totalRaw)}%`, background: "var(--green)" }} />
            <span style={{ width: `${pct(ent.unattributedRaw, totalRaw)}%`, background: "var(--yellow)" }} />
          </div>
          <div className="flex gap-5 small" style={{ marginTop: 8 }}><span><i className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: "var(--green)" }} />attributed {pct(ent.attributedRaw, totalRaw)}%</span><span><i className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: "var(--yellow)" }} />unattributed {pct(ent.unattributedRaw, totalRaw)}%</span></div>
          {ent.invariants.warnings.length ? <p className="msg" style={{ marginTop: 12, color: "var(--yellow)" }}>{ent.invariants.warnings.join(" · ")}</p> : <p className="msg green" style={{ marginTop: 12 }}>Scanned token accounts sum exactly to mint supply.</p>}
          {grouped.length ? (
            <table className="table" style={{ marginTop: 12 }}>
              <thead><tr><th>Unattributed, by label</th><th className="num">Share of supply</th></tr></thead>
              <tbody>
                {grouped.slice(0, 12).map(([lbl, raw]) => <tr key={lbl}><td>{lbl}</td><td className="num">{pct(raw, totalRaw)}%</td></tr>)}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
