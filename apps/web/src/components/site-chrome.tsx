"use client";

import Link from "next/link";

/** Marketing nav (Framer: sticky, logo left, links centre, CTA right) and footer. */
export function SiteNav() {
  return (
    <div className="nav">
      <div className="container inner">
        <Link href="/" className="wordmark"><i />Lookthrough</Link>
        <nav className="links" aria-label="Site">
          <a href="#check">Check a wallet</a>
          <a href="#how">How it works</a>
          <a href="#product">Product</a>
          <a href="#faq">Questions</a>
        </nav>
        <div className="btnrow">
          <Link href="/portfolio" className="btn primary sm">Open the app</Link>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="cols">
          <div>
            <Link href="/" className="wordmark"><i />Lookthrough</Link>
            <p style={{ maxWidth: 360, marginTop: 14 }}>Street name for DeFi. Record-date infrastructure for tokenized stocks on Solana. Entitlements are issuer-defined and never a determination of legal ownership. Nothing here is an offer of any security.</p>
          </div>
          <div>
            <h6 className="h6">Product</h6>
            <ul><li><Link href="/portfolio">Portfolio</Link></li><li><Link href="/assets">Assets</Link></li><li><Link href="/actions">Record dates</Link></li><li><Link href="/issuer">Issuer console</Link></li></ul>
          </div>
          <div>
            <h6 className="h6">Protocol</h6>
            <ul><li><Link href="/adapters">Adapters</Link></li><li><a href="https://github.com/adityakrx/lookthrough#readme" target="_blank" rel="noreferrer">README</a></li><li><a href="https://github.com/adityakrx/lookthrough" target="_blank" rel="noreferrer">Source</a></li></ul>
          </div>
          <div>
            <h6 className="h6">Reading</h6>
            <ul><li><a href="https://doi.org/10.1016/j.respol.2026.105497" target="_blank" rel="noreferrer">Malinova and Park (2026)</a></li><li><a href="https://docs.tokens.xyz" target="_blank" rel="noreferrer">tokens.xyz</a></li></ul>
          </div>
        </div>
        <div className="divider" style={{ margin: "40px 0 20px" }} />
        <div className="flex flex-wrap justify-between gap-3">
          <span>Built for the Solana Stocklana hackathon, September 2026.</span>
          <span>Records on the mainnet fork and on devnet are published by a registrar authority Lookthrough operates.</span>
        </div>
      </div>
    </footer>
  );
}
