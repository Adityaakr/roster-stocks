"use client";

import { Reveal, Stagger } from "@/components/motion";
import { short, slotLabel, usdc } from "@/lib/format";
import type { LandingData } from "@/lib/landing-data";

interface Row {
  d: string;
  entry: string;
  note?: string;
  amount: string;
  balance: string;
  tone?: "in" | "out" | "flat" | "ok";
}

function Statement({ title, id, rows, ok, base }: { title: string; id: string; rows: Row[]; ok?: boolean; base?: number }) {
  return (
    <div className={`stmt ${ok ? "ok" : ""}`}>
      <div className="stmt-head">
        <div>
          <div className="stmt-title">{title}</div>
          <div className="stmt-id mono">{id}</div>
        </div>
        {ok ? <span className="stmt-badge">with Lookthrough</span> : null}
      </div>
      <div className="stmt-cols mono"><span>Date</span><span>Entry</span><span className="r">Amount</span><span className="r">Balance</span></div>
      <Stagger step={0.12} base={base ?? 0}>
        {rows.map((r, i) => (
          <div key={`${r.d}-${i}`} className="stmt-row">
            <span className="mono d">{r.d}</span>
            <span className="e">{r.entry}{r.note ? <span className="n">{r.note}</span> : null}</span>
            <span className={`mono r a ${r.tone ?? ""}`}>{r.amount}</span>
            <span className="mono r b">{r.balance}</span>
          </div>
        ))}
      </Stagger>
    </div>
  );
}

/** Three account statements: the holder, the pool, and the holder with Lookthrough. Figures come from the example wallet's record. */
export function Statements({ data }: { data: LandingData }) {
  const ex = data.example;
  const w = ex ? short(ex.wallet, 4) : "9Uz2…G5qh";
  const perShare = data.latest?.amountPerShareMicro ? BigInt(data.latest.amountPerShareMicro) : 250_000n;
  const pooled6 = ex?.raydium6 ? BigInt(ex.raydium6) : 40_000_000n;
  const total6 = ex?.entitlement6 ? BigInt(ex.entitlement6) : pooled6;
  const fmt3 = (v6: bigint) => `${(v6 / 1_000_000n).toString()}.${((v6 % 1_000_000n) / 1000n).toString().padStart(3, "0")}`;
  const dividend = (pooled6 * perShare) / 1_000_000n;
  const recordSlot = data.latest?.slotActual ?? null;
  const claim = ex?.claim;
  const claimAmount = claim ? usdc(claim.amountPaid) : usdc((total6 * perShare) / 1_000_000n);

  const you: Row[] = [
    { d: "Mar 3", entry: "Deposit to Raydium pool", note: "liquidity position opened", amount: `−${fmt3(pooled6)} AAPL`, balance: "0.000 AAPL", tone: "out" },
    { d: "Sep 15", entry: "Record date", note: "holder of record: no", amount: "", balance: "0.000 AAPL", tone: "flat" },
    { d: "Sep 30", entry: `Dividend, ${usdc(perShare)} per share`, note: "nothing to credit", amount: "+0.00 USDC", balance: "0.00 USDC", tone: "flat" }
  ];
  const pool: Row[] = [
    { d: "Mar 3", entry: `Receive from ${w}`, note: "pool vault", amount: `+${fmt3(pooled6)} AAPL`, balance: `${fmt3(pooled6)} AAPL`, tone: "in" },
    { d: "Sep 15", entry: "Record date", note: "holder of record: yes", amount: "", balance: `${fmt3(pooled6)} AAPL`, tone: "flat" },
    { d: "Sep 30", entry: `Dividend, ${usdc(perShare)} per share`, note: "credited to a program that cannot spend it", amount: `+${usdc(dividend)} USDC`, balance: `${usdc(dividend)} USDC`, tone: "in" }
  ];
  const lt: Row[] = [
    { d: "Sep 15", entry: recordSlot ? `Record slot ${slotLabel(recordSlot)}` : "Record slot pending", note: `${fmt3(pooled6)} attributed from the pool vault, pro rata`, amount: `${fmt3(total6)} AAPL entitled`, balance: ex?.registeredAtSlot ? `registered at slot ${slotLabel(ex.registeredAtSlot)}` : "registered", tone: "ok" },
    { d: "Sep 30", entry: "Distribution", note: claim?.signature ? `tx ${short(claim.signature, 4)}, a Merkle proof, one transaction` : "a Merkle proof, one transaction", amount: `+${claimAmount} USDC`, balance: `${claimAmount} USDC`, tone: "ok" }
  ];

  return (
    <div>
      <div className="stmt-grid">
        <Statement title="Your account" id={w} rows={you} />
        <Statement title="Raydium CLMM pool" id="program-owned vault" rows={pool} base={0.4} />
      </div>
      <div style={{ marginTop: 16 }}>
        <Statement title="Your account" id={w} rows={lt} ok base={0.8} />
      </div>
      <Reveal y={18} delay={0.2}>
        <div className="stmt-lines">
          {[
            ["The cap table is right.", "It says the shareholder is a pool."],
            ["The dividend is real.", "It was paid to an address that can't spend it."],
            ["The vote happened.", "Your weight was zero."]
          ].map(([a, b]) => (
            <div key={a} className="stmt-line"><span className="lead">{a}</span><span>{b}</span></div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
