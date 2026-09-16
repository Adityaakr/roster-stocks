"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CountUp } from "@/components/motion";
import type { VisibilityData } from "@/lib/landing-data";

interface Seg {
  key: string;
  label: string;
  raw: bigint;
  pct: string;
  fill: string;
  accounts: number | null;
}

const FILL: Record<string, { name: string; fill: string }> = {
  wallets: { name: "Wallets", fill: "fill-wallets" },
  "Kamino Lend": { name: "Kamino Lend", fill: "fill-kamino" },
  "Raydium CLMM": { name: "Raydium CLMM", fill: "fill-raydium" },
  "other programs": { name: "Other programs", fill: "fill-other" },
  "other programs (PDA holding lamports only)": { name: "Program accounts holding lamports only", fill: "fill-lamports" }
};

function pct2(part: bigint, whole: bigint): string {
  const bp = (part * 10_000n) / whole;
  return `${bp / 100n}.${(bp % 100n).toString().padStart(2, "0")}`;
}

/** The measured supply strip: proportions straight from the visibility file, filled left to right once on entry. */
export function SupplyStrip({ spy, aapl }: { spy: VisibilityData; aapl: VisibilityData | null }) {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState<string | null>(null);
  const total = BigInt(spy.accountsRaw);
  const segs: Seg[] = [{ key: "wallets", label: "Wallets", raw: BigInt(spy.walletVisibleRaw), pct: pct2(BigInt(spy.walletVisibleRaw), total), fill: "fill-wallets", accounts: null }];
  const rest: Seg[] = [];
  for (const b of spy.breakdownByProgram) {
    const f = FILL[b.label];
    const seg: Seg = { key: b.label, label: f?.name ?? b.label, raw: BigInt(b.raw), pct: b.pct, fill: f?.fill ?? "fill-rest", accounts: b.accounts };
    if (f) segs.push(seg);
    else rest.push(seg);
  }
  const all = [...segs, ...rest];
  const widths = all.map((s) => Number((s.raw * 1_000_000n) / total) / 10_000);
  const decimals = spy.decimals ?? 8;
  const shares = (raw: bigint) => `${(raw / 10n ** BigInt(decimals)).toLocaleString("en-US")} ${spy.symbol}`;
  const when = new Date(spy.timestamp * 1000);
  const dateLabel = `${when.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}, ${when.toISOString().slice(11, 16)} UTC`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
        <CountUp value={`${spy.programHeldPct}%`} className="mono" style={{ fontSize: 72, lineHeight: "72px", letterSpacing: "-0.03em", color: "var(--ink)" }} />
        <span className="body" style={{ maxWidth: 320 }}>of {spy.symbol} supply held by programs</span>
      </div>
      <div className="strip" style={{ marginTop: 28 }} role="img" aria-label={`${spy.symbol} supply by holder type: ${all.map((s) => `${s.label} ${s.pct}%`).join(", ")}`}>
        {all.map((s, i) => (
          <motion.div
            key={s.key}
            className={`seg ${s.fill}`}
            style={{ width: `${widths[i]}%`, transformOrigin: "left" }}
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1], delay: 0.05 * i }}
            tabIndex={0}
            role="note"
            aria-label={`${s.label}: ${s.pct}% of supply, ${shares(s.raw)}${s.accounts !== null ? `, ${s.accounts.toLocaleString("en-US")} accounts` : ""}`}
            onMouseEnter={() => setTip(s.key)}
            onMouseLeave={() => setTip(null)}
            onFocus={() => setTip(s.key)}
            onBlur={() => setTip(null)}
          >
            {tip === s.key ? (
              <span className="tip" style={{ transform: `translateX(-50%) scaleX(${1})` }}>
                {s.label} · {s.pct}% · {shares(s.raw)}{s.accounts !== null ? ` · ${s.accounts.toLocaleString("en-US")} accounts` : ""}
              </span>
            ) : null}
          </motion.div>
        ))}
      </div>
      <div className="strip-labels" aria-hidden>
        {all.map((s, i) => (
          <span key={s.key} style={{ width: `${widths[i]}%`, visibility: widths[i] > 9 ? "visible" : "hidden" }}>{s.label} {s.pct}%</span>
        ))}
      </div>
      <div className="legend">
        {all.filter((_, i) => widths[i] <= 9).map((s) => (
          <span key={s.key}><i className={s.fill} />{s.label} {s.pct}%</span>
        ))}
      </div>
      <p className="note" style={{ marginTop: 18 }}>
        Slot {spy.slot.toLocaleString("en-US")}, {dateLabel}. {spy.accountsScanned.toLocaleString("en-US")} token accounts read. Programs named from their IDL.
      </p>
      {aapl ? (
        <div style={{ marginTop: 22 }}>
          <div className="strip" style={{ height: 8 }} role="img" aria-label={`AAPLx supply held by programs: ${aapl.programHeldPct}%`}>
            <motion.div className="seg fill-other" style={{ width: `${Number((BigInt(aapl.programHeldRaw) * 1_000_000n) / BigInt(aapl.accountsRaw)) / 10_000}%`, transformOrigin: "left" }} initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.9, ease: [0.2, 0, 0, 1], delay: 0.3 }} />
            <div className="seg fill-wallets" style={{ flex: 1 }} />
          </div>
          <p className="note" style={{ marginTop: 8 }}><span className="mono" style={{ color: "var(--ink-2)" }}>{aapl.programHeldPct}%</span> AAPLx today. Every new venue moves it up.</p>
        </div>
      ) : null}
    </div>
  );
}
