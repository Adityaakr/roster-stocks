"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { shares, short, slotLabel, usdc } from "@/lib/format";

interface Summary {
  live: boolean;
  reason?: string;
  wallet?: string;
  slot?: number;
  rows?: { source: string; label: string; shares6: string }[];
  walletVisibleShares6?: string;
  totalShares6?: string;
  claimed?: string | null;
  voted?: { choice: string; weight: string } | null;
  distribution?: { id: string; amountPerShareMicro: string; entitlement: string | null; snapshotSlot: number | null; attributedPct: string | null } | null;
}

/** The hero "product screenshot" is the product: the demo wallet's live ledger and its record-date standing. */
export function HeroTile() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/demo/summary")
      .then((r) => r.json())
      .then((j: Summary) => setS(j))
      .catch(() => setS({ live: false, reason: "summary unavailable" }));
  }, []);

  const rows = s?.rows ?? [];
  const total = BigInt(s?.totalShares6 ?? "0");
  const visible = BigInt(s?.walletVisibleShares6 ?? "0");
  const perShare = BigInt(s?.distribution?.amountPerShareMicro ?? "0");
  const ent = s?.distribution?.entitlement ? BigInt(s.distribution.entitlement) : null;
  const pay = ent !== null ? (ent * perShare) / 1_000_000n : null;

  return (
    <div className="card" style={{ borderBottom: 0, borderRadius: "4px 4px 0 0", display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", minHeight: 320 }}>
      <div style={{ padding: 22, borderRight: "1px solid var(--line)", minWidth: 0 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="h6">Portfolio</div>
            <div className="small" style={{ marginTop: 4 }}>{s?.wallet ? <>Demo wallet {short(s.wallet, 4)}</> : "Demo wallet"}{s?.slot ? <> · slot {slotLabel(s.slot)}</> : null}</div>
          </div>
          {s ? <Badge tone={s.live ? "green" : "yellow"} dot>{s.live ? "live from chain" : "chain not reachable"}</Badge> : null}
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr><th>Where the shares are</th><th className="num">Share equivalents</th></tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((r, i) => (
              <tr key={`${r.label}-${i}`}>
                <td>{r.label}{i === 0 ? <span className="small"> · what a wallet scan sees</span> : null}</td>
                <td className="num">{shares(r.shares6, 2, 2)}</td>
              </tr>
            )) : (
              <tr><td colSpan={2} className="muted">{s ? (s.live ? "No positions." : `Live ledger off: ${s.reason ?? "chain not reachable"}.`) : "Reading the demo wallet."}</td></tr>
            )}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr><td>Resolved</td><td className="num up">{shares(total, 2, 2)}</td></tr>
            </tfoot>
          ) : null}
        </table>
        {rows.length ? <p className="small" style={{ marginTop: 12 }}>A wallet scan sees {shares(visible, 2, 2)} of {shares(total, 2, 2)} share equivalents.</p> : null}
      </div>
      <div style={{ padding: 22, display: "grid", alignContent: "start", gap: 12 }}>
        <div className="h6">Record date</div>
        {s?.distribution ? (
          <>
            <div className="inset" style={{ padding: 14 }}>
              <div className="small">{s.distribution.id}</div>
              <div className="h4 num" style={{ marginTop: 6 }}>{ent !== null ? `${shares(ent, 2, 2)} shares` : "not in tree"}</div>
              <div className="small" style={{ marginTop: 4 }}>entitlement at slot {s.distribution.snapshotSlot ? slotLabel(s.distribution.snapshotSlot) : "?"}, {s.distribution.attributedPct ?? "?"}% of supply attributed</div>
            </div>
            <div className="inset" style={{ padding: 14 }}>
              <div className="small">{usdc(perShare)} USDC per share, demo-funded</div>
              <div className="h4 num" style={{ marginTop: 6 }}>{pay !== null ? `${usdc(s.claimed ?? pay)} USDC` : "n/a"}</div>
              <div className="small" style={{ marginTop: 4 }}>{s.claimed ? <span className="up">claimed with a Merkle proof</span> : "claimable with a Merkle proof"}</div>
            </div>
            {s.voted ? (
              <div className="inset" style={{ padding: 14 }}>
                <div className="small">Vote, simulated issuer</div>
                <div className="h6" style={{ marginTop: 6 }}>voted {s.voted.choice}, weight {shares(s.voted.weight, 2, 2)}</div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="inset" style={{ padding: 14 }}><div className="small">No record date on this deployment yet. The issuer console schedules one.</div></div>
        )}
      </div>
    </div>
  );
}
