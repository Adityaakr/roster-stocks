"use client";

import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/motion";

/** The diptych: token left, stock right, three paired lines, converging on one sentence in the display face. */
export function Thesis() {
  const reduce = useReducedMotion();
  const pairs: [string, string][] = [
    ["Owned by whoever holds it.", "Owned by whoever the register names."],
    ["Settles to an address.", "Settles to a holder on a record date."],
    ["Counted by balance.", "Counted by entitlement."]
  ];
  return (
    <div>
      <div className="diptych">
        <div>
          <div className="head">TOKEN</div>
          {pairs.map(([a], i) => <Reveal key={a} delay={i * 0.1} y={10}><p>{a}</p></Reveal>)}
        </div>
        <div>
          <div className="head">STOCK</div>
          {pairs.map(([, b], i) => <Reveal key={b} delay={i * 0.1} y={10}><p>{b}</p></Reveal>)}
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <svg viewBox="0 0 720 96" style={{ width: "100%", maxWidth: 720, height: "auto", display: "block", margin: "0 auto" }} aria-hidden>
          <motion.path d="M 24 0 L 360 88" stroke="var(--line-strong)" strokeWidth="1" fill="none" initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.5, ease: [0.2, 0, 0, 1], delay: 0.3 }} />
          <motion.path d="M 696 0 L 360 88" stroke="var(--line-strong)" strokeWidth="1" fill="none" initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.5, ease: [0.2, 0, 0, 1], delay: 0.3 }} />
          <motion.circle cx="360" cy="88" r="4" fill="var(--accent)" initial={reduce ? false : { opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.22, delay: 0.8 }} style={{ transformOrigin: "360px 88px" }} />
        </svg>
        <Reveal delay={0.9} y={10}>
          <p className="display" style={{ textAlign: "center", margin: "12px auto 0", fontSize: 44, lineHeight: "48px", maxWidth: 720 }}>Moves like a token. Pays like a stock.</p>
        </Reveal>
      </div>
      <p className="body" style={{ margin: "32px auto 0", maxWidth: 640 }}>
        Three ways exist to put a stock on a blockchain today, and all three make the holder choose between rights and composability. Third-party wrappers are freely usable in DeFi and carry no shareholder rights. Issuer-sponsored shares carry full rights, and the transfer agent knows the holder only while the share sits in a wallet it recognises. DTC&apos;s tokenization service, arriving in the second half of 2026 with the entitlements of the underlying share, restricts transfers to registered wallets by design. Lookthrough is the look-through layer that lets a rights-bearing share sit in a pool or a vault and still be paid, polled and counted at the record date, with the result proven on-chain.
      </p>
    </div>
  );
}
