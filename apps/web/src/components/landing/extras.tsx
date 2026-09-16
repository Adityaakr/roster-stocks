"use client";

import { Reveal, ScrollColorText } from "@/components/motion";
import type { LandingData } from "@/lib/landing-data";
import { WalletCheck } from "./wallet-check";
import { SupplyStrip } from "./supply-strip";
import { EvidenceMatrix, Timeline } from "./evidence";

/** The instrument, centred in a crosshair frame the way the reference frames its illustrations. */
export function CheckSection({ example }: { example: string | null }) {
  return (
    <section className="asec" style={{ textAlign: "center", borderBottom: "1px solid var(--line)" }}>
      <div className="acontainer" style={{ padding: "80px 30px" }}>
      <span className="tick tl" aria-hidden /><span className="tick tr" aria-hidden />
      <Reveal y={18} style={{ width: "100%" }}><p className="body" style={{ margin: "0 0 10px", color: "var(--ink-2)" }}>The invisible-shares check</p></Reveal>
      <ScrollColorText as="h2" text="See what a wallet scan misses." className="h-section" style={{ margin: "0 auto", maxWidth: 760 }} />
      <Reveal y={18} delay={0.1}><p className="body" style={{ margin: "18px auto 0", maxWidth: 600 }}>Paste any Solana wallet. Lookthrough reads its wallet balance, its Raydium CLMM positions and its Kamino Lend deposits, and shows the share equivalents a record date would miss.</p></Reveal>
      <Reveal y={48} delay={0.2}>
        <div className="crosshair" style={{ maxWidth: 640, margin: "48px auto 0", textAlign: "left" }} id="check">
          <i aria-hidden />
          <div className="inner" style={{ padding: 0 }}><WalletCheck example={example} /></div>
        </div>
      </Reveal>
      </div>
    </section>
  );
}

/** The measured strip and the evidence, under the counters. */
export function NumberStrip({ data }: { data: LandingData }) {
  if (!data.spy) return null;
  return (
    <section className="asec" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="acontainer" style={{ padding: "80px 30px" }}>
      <span className="tick tl" aria-hidden /><span className="tick tr" aria-hidden />
      <div className="two" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 64, alignItems: "start" }}>
        <div>
          <ScrollColorText as="h2" text="One in three SPYx shares belongs to a program." className="h-section" />
          <Reveal y={18} delay={0.1}><p className="body" style={{ marginTop: 18, maxWidth: 520 }}>Read from every token account on mainnet at one slot. Programs are named from their on-chain IDL, never guessed. Every new venue moves the number up; nothing moves it down.</p></Reveal>
          <Reveal y={18} delay={0.2}>
            <details style={{ marginTop: 28 }}>
              <summary className="link" style={{ cursor: "pointer", display: "inline", fontSize: 15, color: "var(--ink)" }}>Documented, not discovered: who named the problem this year</summary>
              <div style={{ marginTop: 18 }}><EvidenceMatrix /></div>
              <div style={{ marginTop: 28 }}><Timeline programHeldPct={data.spy.programHeldPct} /></div>
            </details>
          </Reveal>
        </div>
        <Reveal y={48} delay={0.1}><SupplyStrip spy={data.spy} aapl={data.aapl} /></Reveal>
      </div>
      </div>
      <style>{`@media (max-width: 809px) { .two { grid-template-columns: minmax(0, 1fr) !important; gap: 32px !important; } }`}</style>
    </section>
  );
}
