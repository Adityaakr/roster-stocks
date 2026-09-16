"use client";

import { use, useEffect, useState } from "react";
import { pct, shares, slotLabel, timeLabel, usdc } from "@/lib/format";
import { Hash } from "@/components/copy-button";
import { ErrorState, Loading } from "@/components/states";
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
  snapshotSlotRequested: number;
  snapshotSlotActual: number;
  snapshotTimestamp: number;
  multiplier: string;
  multiplierSource: string;
  supplyRaw: string;
  accountsScanned: number;
  attributedRaw: string;
  unattributedRaw: string;
  unattributed: { container: string; program: string | null; label: string; raw: string }[];
  adaptersUsed: { id: string; status: string; containers: number }[];
  invariants: { ok: boolean; warnings: string[] };
}

export default function ActionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ActionResponse | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState("");
  const [verify, setVerify] = useState<{ ok: boolean; entitlement: string; leaf: string; message?: string } | null>(null);

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

  async function verifyWallet() {
    if (!data?.action.snapshot) return;
    const p = (await fetch(`/api/actions/${id}/proof?wallet=${wallet.trim()}`).then((r) => r.json())) as { inTree: boolean; root?: string; leaf?: { entitlement: string; leaf: string; proof: string[] }; message?: string };
    if (!p.inTree || !p.leaf || !p.root) {
      setVerify({ ok: false, entitlement: "0", leaf: "", message: p.message ?? "Not in the tree." });
      return;
    }
    const onchainRoot = data.onchain && "root" in data.onchain ? data.onchain.root : p.root;
    const r = verifyLocally({ actionIdHex: data.action.actionIdHex, wallet: wallet.trim(), mint: data.action.mint, snapshotSlot: data.action.snapshot.slotActual, entitlement: p.leaf.entitlement, proof: p.leaf.proof, root: onchainRoot });
    setVerify({ ok: r.ok, entitlement: p.leaf.entitlement, leaf: r.leaf });
  }

  if (error) return <div className="pt-12"><ErrorState message={error} next="Check the action id in the URL, or open the actions list." /></div>;
  if (!data) return <div className="pt-12"><Loading what="the action" /></div>;
  const a = data.action;
  const oc = data.onchain && "root" in data.onchain ? data.onchain : null;
  const totalRaw = ent ? BigInt(ent.attributedRaw) + BigInt(ent.unattributedRaw) : 0n;
  const grouped = ent ? Object.entries(ent.unattributed.reduce<Record<string, bigint>>((acc, u) => ((acc[u.label] = (acc[u.label] ?? 0n) + BigInt(u.raw)), acc), {})).sort((x, y) => (x[1] > y[1] ? -1 : 1)) : [];

  return (
    <div className="pt-12">
      <div className="text-[13px] text-ink-3">Action</div>
      <h1 className="text-[28px]">{a.title}</h1>
      <p className="text-ink-2 mt-1">{a.kind === "distribution" ? `${usdc(a.amountPerShareMicro ?? "0")} USDC per share equivalent` : a.question} · {a.status}{a.kind === "vote" ? " · simulated issuer; xStocks carry no voting rights" : " · funded by a demo wallet"}</p>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel p-5 space-y-2 text-[14px]">
          <div className="font-medium">Snapshot</div>
          {a.snapshot ? (
            <>
              <Row k="Record slot requested">{slotLabel(a.recordSlot)}</Row>
              <Row k="Snapshot slot actual">{slotLabel(a.snapshot.slotActual)}</Row>
              {a.snapshot.reusedFrom ? <div className="text-[13px] text-ink-2">Entitlement set reused from <a className="text-accent" href={`/actions/${a.snapshot.reusedFrom}`}>{a.snapshot.reusedFrom}</a>, which shares this record date. Same set, new action id, new tree.</div> : null}
              <Row k="Timestamp">{timeLabel(a.snapshot.timestamp)}</Row>
              {ent ? <Row k="Multiplier">{ent.multiplier} <span className="text-ink-3">({ent.multiplierSource})</span></Row> : null}
              {ent ? <Row k="Token accounts scanned">{ent.accountsScanned.toLocaleString("en-US")}</Row> : null}
              <Row k="Root"><Hash value={a.snapshot.root} /></Row>
              <Row k="Content hash (sha256 of entitlements.json)"><Hash value={a.snapshot.contentHash} /></Row>
              <Row k="Leaves">{a.snapshot.leaves} registered wallets, {shares(a.snapshot.totalEntitlement)} shares in total</Row>
              <div className="pt-2"><a className="btn" href={`/actions/${id}/entitlements.json`} download>Download entitlements.json</a></div>
            </>
          ) : (
            <div className="text-ink-2">Not snapshotted yet. Record slot {slotLabel(a.recordSlot)}.</div>
          )}
        </div>
        <div className="panel p-5 space-y-2 text-[14px]">
          <div className="font-medium">On-chain</div>
          {a.onchain ? (
            <>
              <Row k="Action account"><Hash value={a.onchain.actionPda} /></Row>
              <Row k="Create transaction"><Hash value={a.onchain.createTx} /></Row>
              {a.onchain.fundTx ? <Row k="Fund transaction"><Hash value={a.onchain.fundTx} /></Row> : null}
              {oc ? (
                <>
                  <Row k="Root on-chain"><span className={oc.root === a.snapshot?.root ? "text-accent" : "text-danger"}>{oc.root === a.snapshot?.root ? "matches the published root" : "differs from the published root"}</span></Row>
                  <Row k="Content hash on-chain"><span className={oc.contentHash === a.snapshot?.contentHash ? "text-accent" : "text-danger"}>{oc.contentHash === a.snapshot?.contentHash ? "matches entitlements.json" : "differs"}</span></Row>
                  {a.kind === "distribution" ? <Row k="Claimed so far">{usdc(oc.claimedTotal)} USDC{oc.funded ? "" : " (not funded)"}</Row> : <Row k="Tally">for {shares(oc.forWeight)}, against {shares(oc.againstWeight)}, abstain {shares(oc.abstainWeight)}, voters {oc.voters}</Row>}
                </>
              ) : data.forkUp ? (
                <div className="text-ink-2">Program state unavailable.</div>
              ) : (
                <div className="text-ink-2">Couldn&apos;t reach the fork at 127.0.0.1:8899. Start it with pnpm fork.</div>
              )}
            </>
          ) : (
            <div className="text-ink-2">Not published on-chain yet.</div>
          )}
        </div>
      </section>

      {ent ? (
        <section className="mt-8 panel p-5 text-[14px]">
          <div className="font-medium">Supply at the snapshot</div>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
            <span>Attributed <span className="num text-accent">{pct(ent.attributedRaw, totalRaw)}%</span></span>
            <span>Unattributed <span className="num">{pct(ent.unattributedRaw, totalRaw)}%</span></span>
            <span>Double counted <span className="num">0</span></span>
            <span>Containers looked through: {ent.adaptersUsed.filter((x) => x.status === "implemented" && x.id !== "direct").map((x) => `${x.id.replace("_", " ")} ${x.containers}`).join(", ")}</span>
          </div>
          {ent.invariants.warnings.length ? <div className="mt-2 text-warn">{ent.invariants.warnings.join("; ")}</div> : <div className="mt-2 text-ink-3">Scanned token accounts sum exactly to mint supply.</div>}
          <table className="ledger w-full mt-3 text-[13px]">
            <thead><tr><th>Unattributed, by label</th><th className="num">Share of supply</th></tr></thead>
            <tbody>
              {grouped.slice(0, 12).map(([lbl, raw]) => (
                <tr key={lbl}><td>{lbl}</td><td className="num">{pct(raw, totalRaw)}%</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="mt-8 panel p-5 text-[14px]">
        <div className="font-medium">Verify a wallet</div>
        <p className="text-ink-2 mt-1">Recomputes the leaf from the action id, wallet, mint, snapshot slot and entitlement, then walks the proof to the {oc ? "on-chain" : "published"} root, in this browser.</p>
        <div className="mt-3 flex gap-2 max-w-[640px]">
          <input className="flex-1 h-10 px-3 rounded-[10px] border border-line bg-surface num text-[13px]" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Wallet public key" aria-label="Wallet public key" />
          <button className="btn btn-primary" onClick={verifyWallet} disabled={!wallet.trim() || !a.snapshot}>Verify</button>
        </div>
        {verify ? (
          verify.ok ? (
            <div className="mt-3 flex flex-wrap items-center gap-3"><span className="chip chip-accent">Verified</span> entitlement <span className="num">{shares(verify.entitlement)}</span> shares, leaf <Hash value={verify.leaf} /></div>
          ) : (
            <div className="mt-3 text-danger">{verify.message ?? "Proof does not verify against the root."}</div>
          )
        ) : null}
        {data.tree ? (
          <details className="mt-4">
            <summary className="text-accent">All {data.tree.leaves.length} leaves</summary>
            <table className="ledger w-full mt-2 text-[13px]">
              <tbody>
                {data.tree.leaves.map((l) => (
                  <tr key={l.wallet}><td><Hash value={l.wallet} /></td><td className="num">{shares(l.entitlement)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-ink-2">{k}</span>
      <span className="num text-right">{children}</span>
    </div>
  );
}
