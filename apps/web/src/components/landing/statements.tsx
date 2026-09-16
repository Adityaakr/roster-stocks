"use client";

import { Stagger } from "@/components/motion";
import { short, slotLabel, usdc } from "@/lib/format";
import type { LandingData } from "@/lib/landing-data";

/** Three account statements: the holder, the pool, and the holder with Lookthrough. Amounts come from the example wallet's record. */
export function Statements({ data }: { data: LandingData }) {
  const ex = data.example;
  const w = ex ? short(ex.wallet, 4) : "9Uz2…G5qh";
  const perShare = data.latest?.amountPerShareMicro ? BigInt(data.latest.amountPerShareMicro) : 250_000n;
  const pooled6 = ex?.raydium6 ? BigInt(ex.raydium6) : 40_000_000n;
  const pooled = (BigInt(Math.round(Number(pooled6) / 1000)) / 1n);
  const fmt3 = (v6: bigint) => `${(v6 / 1_000_000n).toString()}.${((v6 % 1_000_000n) / 1000n).toString().padStart(3, "0")}`;
  const dividend = (pooled6 * perShare) / 1_000_000n;
  const recordSlot = data.latest?.slotActual ?? null;
  const claim = ex?.claim;
  void pooled;

  const left = [
    ["Mar 3", `Deposit ${fmt3(pooled6)} AAPL to Raydium pool`, "balance 0.000"],
    ["Sep 15", "Record date", "holder of record: no"],
    ["Sep 30", `Dividend, ${usdc(perShare)} per share`, "credit 0.00"]
  ];
  const right = [
    ["Mar 3", `Receive ${fmt3(pooled6)} AAPL from ${w}`, `balance ${fmt3(pooled6)}`],
    ["Sep 15", "Record date", "holder of record: yes"],
    ["Sep 30", `Dividend, ${usdc(perShare)} per share`, `credit ${usdc(dividend)}, unspendable`]
  ];
  const total6 = ex?.entitlement6 ? BigInt(ex.entitlement6) : pooled6;
  const third = [
    ["Sep 15", recordSlot ? `Record slot ${slotLabel(recordSlot)}` : "Record slot pending", `attributed ${fmt3(pooled6)} from the pool vault, ${fmt3(total6)} in total`],
    ["Sep 30", "Distribution", claim ? `claim ${usdc(claim.amountPaid)} USDC on ${fmt3(total6)}${claim.signature ? `, tx ${short(claim.signature, 4)}` : `, slot ${slotLabel(claim.slot)}`}` : `claim ${usdc((total6 * perShare) / 1_000_000n)} USDC, pending`]
  ];
  const Row = ([d, t, v]: string[], i: number) => (
    <div key={`${d}-${i}`} className="row"><span className="d">{d}</span><span>{t}</span><span className="v">{v}</span></div>
  );
  return (
    <div>
      <div className="columns2" style={{ gap: 0 }}>
        <div style={{ paddingRight: 16 }}>
          <div className="statement">
            <div className="head"><span>Account: you, {w}</span></div>
            <Stagger step={0.12}>{left.map(Row)}</Stagger>
          </div>
        </div>
        <div style={{ paddingLeft: 16, borderLeft: 0 }}>
          <div className="statement">
            <div className="head"><span>Account: Raydium CLMM pool, program</span></div>
            <Stagger step={0.12} base={0.4}>{right.map(Row)}</Stagger>
          </div>
        </div>
      </div>
      <div className="statement ok" style={{ marginTop: 16 }}>
        <div className="head"><span>With Lookthrough: you, {w}</span>{ex?.registeredAtSlot ? <span className="muted">registered at slot {slotLabel(ex.registeredAtSlot)}</span> : null}</div>
        <Stagger step={0.12} base={0.8}>{third.map(Row)}</Stagger>
      </div>
      <ul style={{ listStyle: "none", margin: "28px 0 0", padding: 0 }}>
        {["The cap table is right. It says the shareholder is a pool.", "The dividend is real. It was paid to an address that can't spend it.", "The vote happened. Your weight was zero."].map((t) => (
          <li key={t} className="body" style={{ padding: "12px 0", borderTop: "1px solid var(--line)", color: "var(--ink)" }}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
