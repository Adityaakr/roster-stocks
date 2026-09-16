"use client";

import Link from "next/link";
import { Roll } from "@/components/motion";

/** Marketing nav, as the reference: logo left, links centre with the growing underline, primary button right, hairline below. */
export function SiteNav() {
  return (
    <div className="nav">
      <div className="inner">
        <Link href="/" className="wordmark"><i />Lookthrough</Link>
        <nav className="links" aria-label="Site">
          <a className="navlink" href="#works">How it works</a>
          <a className="navlink" href="#feature">What it unlocks</a>
          <a className="navlink" href="#number">The number</a>
          <a className="navlink" href="#pricing">Who it is for</a>
          <a className="navlink" href="#questions">Questions</a>
        </nav>
        <Link href="/portfolio" className="btn primary"><Roll>Open the app</Roll></Link>
      </div>
    </div>
  );
}

export function SiteFooter({ network, slot }: { network?: string; slot?: number | null }) {
  return (
    <footer className="footer">
      <div className="inner">
        <div className="cols">
          <div>
            <Link href="/" className="wordmark"><i />Lookthrough</Link>
            <p style={{ maxWidth: 360, marginTop: 14 }}>Street name for DeFi. Record-date infrastructure for tokenized stocks on Solana. Entitlements are issuer-defined and never a determination of legal ownership. Nothing here is an offer of any security.</p>
            <p className="mono" style={{ marginTop: 14, fontSize: 12 }}>{network ? <>Network {network}</> : null}{slot ? <> · latest record slot {slot.toLocaleString("en-US")}</> : null}</p>
          </div>
          <div>
            <h6>Product</h6>
            <ul><li><Link className="navlink" href="/portfolio">Portfolio</Link></li><li><Link className="navlink" href="/assets">Assets</Link></li><li><Link className="navlink" href="/actions">Record dates</Link></li><li><Link className="navlink" href="/issuer">Issuer console</Link></li><li><Link className="navlink" href="/adapters">Adapters</Link></li></ul>
          </div>
          <div>
            <h6>Source</h6>
            <ul><li><a className="navlink" href="https://github.com/adityakrx/lookthrough#readme" target="_blank" rel="noreferrer">README</a></li><li><a className="navlink" href="https://github.com/adityakrx/lookthrough" target="_blank" rel="noreferrer">Source</a></li></ul>
          </div>
          <div>
            <h6>Reading</h6>
            <ul><li><a className="navlink" href="https://doi.org/10.1016/j.respol.2026.105497" target="_blank" rel="noreferrer">Malinova and Park (2026)</a></li><li><a className="navlink" href="https://docs.tokens.xyz" target="_blank" rel="noreferrer">tokens.xyz</a></li></ul>
          </div>
        </div>
        <div className="divider" style={{ margin: "40px 0 20px" }} />
        <div className="flex flex-wrap justify-between gap-3">
          <span>Built for the Solana Stocklana hackathon, September 2026.</span>
          <span>Records are published by a registrar authority Lookthrough operates.</span>
        </div>
      </div>
    </footer>
  );
}
