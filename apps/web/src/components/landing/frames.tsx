"use client";

import Link from "next/link";
import { PixelReveal, Roll } from "@/components/motion";

/** Three real screenshots of the built UI in hairline frames, revealed through the pixel mask. */
export function Frames() {
  const items = [
    { src: "/frames/portfolio.png", alt: "The portfolio ledger: wallet, Raydium CLMM position and Kamino Lend deposit resolved to share equivalents", t: "Portfolio, for holders", d: "Everything a wallet holds of a tokenized stock, including what sits in Raydium and Kamino, with the rule that counted each position. Register once, then claim or vote with a proof while the positions stay where they are.", href: "/portfolio", cta: "Open portfolio" },
    { src: "/frames/issuer.png", alt: "The issuer console's snapshot step with the supply invariant", t: "Issuer console", d: "Pick the stock and the wrappers in scope, set a session-aware record date, run the snapshot, publish the root, fund the distribution or open the vote. Records are published by a registrar authority; the issuer's rules decide what each position is entitled to.", href: "/issuer", cta: "Run a record date" },
    { src: "/frames/record.png", alt: "A record certificate: root, content hash and slot", t: "Records and assets", d: "Every record date with its certificate and a leaf lookup anyone can verify, and a directory of every tokenized stock, ETF and pre-IPO token on Solana with its wrappers, prices and venues.", href: "/assets", cta: "Browse assets" }
  ];
  return (
    <div className="frames">
      {items.map((it) => (
        <div key={it.t}>
          <PixelReveal src={it.src} alt={it.alt} className="shot" />
          <div className="h-item" style={{ marginTop: 18 }}>{it.t}</div>
          <p className="body" style={{ margin: "8px 0 0" }}>{it.d}</p>
          <div className="btnrow" style={{ marginTop: 14 }}><Link href={it.href} className="btn secondary"><Roll>{it.cta}</Roll></Link></div>
        </div>
      ))}
    </div>
  );
}
