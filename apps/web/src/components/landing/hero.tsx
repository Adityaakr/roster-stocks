"use client";

import { MountReveal, Roll, WordReveal } from "@/components/motion";
import { WalletCheck } from "./wallet-check";

/** Hero: headline left with the word-by-word reveal, the instrument right on the surface panel. */
export function Hero({ example }: { example: string | null }) {
  return (
    <section className="sec dots" style={{ paddingTop: 96, paddingBottom: 96 }}>
      <span className="tick tl" aria-hidden />
      <span className="tick tr" aria-hidden />
      <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 48, alignItems: "center" }}>
        <div>
          <MountReveal delay={0.2} y={10}><div className="marker" style={{ marginBottom: 20 }}><b>00</b><span>Record-date infrastructure for tokenized stocks</span></div></MountReveal>
          <WordReveal as="h1" text="Your shares went into DeFi. The register lost you." className="display" delay={0.6} stagger={0.05} />
          <WordReveal as="p" text="Lookthrough finds every holder behind every pool and vault at the record date, proves the result with one root on Solana, and lets them claim distributions and vote with a proof. The stock never has to move." className="body" delay={1} stagger={0.03} style={{ marginTop: 22, maxWidth: 560 }} />
          <MountReveal delay={2} y={20}>
            <div className="btnrow" style={{ marginTop: 30 }}>
              <a href="#check" className="btn primary"><Roll>Check a wallet</Roll></a>
              <a href="#how" className="btn secondary"><Roll>How it works</Roll></a>
            </div>
          </MountReveal>
        </div>
        <MountReveal delay={2.8} y={60}>
          <div id="check"><WalletCheck example={example} /></div>
        </MountReveal>
      </div>
      <style>{`@media (max-width: 809px) { .hero-grid { grid-template-columns: minmax(0, 1fr) !important; gap: 32px !important; } }`}</style>
    </section>
  );
}
