import Link from "next/link";
import { Icon } from "@/components/icons";
import { Label } from "@/components/ui";
import { HeroTile } from "@/components/hero-tile";
import { cluster, readVisibility, store } from "@/lib/server";
import { shares, slotLabel, timeLabel } from "@/lib/format";

interface Visibility {
  symbol: string;
  slot: number;
  timestamp: number;
  accountsRaw: string;
  accountsScanned: number;
  walletVisibleRaw: string;
  programHeldPct: string;
  breakdownByProgram: { label: string; raw: string }[];
}

export const dynamic = "force-dynamic";

export default function Landing() {
  const spy = readVisibility("XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W") as Visibility | null;
  const aapl = readVisibility("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp") as Visibility | null;
  const latest = store().list().find((a) => a.snapshot && a.status !== "scheduled") ?? null;
  const pctOf = (v: Visibility, raw: string) => Number((BigInt(raw) * 10_000n) / BigInt(v.accountsRaw)) / 100;
  const top = spy ? spy.breakdownByProgram.slice().sort((a, b) => (BigInt(a.raw) > BigInt(b.raw) ? -1 : 1)).slice(0, 4) : [];
  const c = cluster();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ padding: "88px 0 64px" }}>
        <div className="dots absolute inset-x-0 top-0 h-[560px] pointer-events-none" aria-hidden />
        <div className="container relative">
          <div style={{ maxWidth: 720 }}>
            <Label>Record-date infrastructure</Label>
            <h1 className="h1" style={{ marginTop: 22, fontSize: 56 }}>Corporate actions for tokenized stocks, wherever the shares sit.</h1>
            <p className="body-lg" style={{ marginTop: 22, maxWidth: 620 }}>
              When a tokenized stock goes into a liquidity pool or a lending market, the holder disappears from the register. Lookthrough resolves who is entitled at the record date, through wallets and DeFi positions, publishes one verifiable root on Solana, and lets holders claim distributions and vote with a proof.
            </p>
            <div className="btnrow" style={{ marginTop: 30 }}>
              <Link href="/portfolio" className="btn primary">Open the app</Link>
              <a href="#how" className="btn secondary">How it works</a>
            </div>
          </div>
          <div className="tile" style={{ marginTop: 64, padding: 0 }}>
            <div style={{ padding: "clamp(16px, 4vw, 44px) clamp(16px, 4vw, 44px) 0" }}>
              <HeroTile />
            </div>
          </div>
          <div className="grid-4" style={{ marginTop: 40 }}>
            {[
              { icon: Icon.Eye, t: "Look-through resolver", d: "Wallets, Raydium CLMM positions and Kamino deposits, attributed once with issuer-defined rules." },
              { icon: Icon.Tree, t: "One root on-chain", d: "Entitlements hashed into a Merkle tree. The root, a content hash and the slot are published." },
              { icon: Icon.Route, t: "Claim and vote router", d: "A proof unlocks the distribution or a weighted vote. Registration, inclusion and single use are checked on-chain." },
              { icon: Icon.Shield, t: "Supply conservation", d: "Attributed plus unattributed equals supply, or the snapshot fails instead of publishing." }
            ].map((f) => (
              <div key={f.t}>
                <div className="flex items-center gap-2 h6"><f.icon width={18} height={18} />{f.t}</div>
                <p className="body-sm" style={{ margin: "8px 0 0" }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="section">
        <div className="container">
          <Label tone="yellow">The problem</Label>
          <h2 className="h2" style={{ marginTop: 18, maxWidth: 560 }}>A wallet scan misses the shares that moved into DeFi.</h2>
          <p className="body-lg" style={{ marginTop: 16, maxWidth: 560 }}>
            Token-2022 stocks are composable. The moment a holder deposits into a pool or a reserve, the program becomes the token owner. A record date taken from wallet balances pays the pool, not the person.
          </p>
          <div className="grid-3" style={{ marginTop: 40 }}>
            <div className="card pad-lg">
              <div className="small">Held by programs, not wallets</div>
              <div className="h1 num" style={{ marginTop: 10 }}>{spy ? `${spy.programHeldPct}%` : "n/a"}</div>
              <p className="body-sm" style={{ margin: "12px 0 0" }}>
                {spy ? <>of {spy.symbol} supply on mainnet at slot {slotLabel(spy.slot)}, {timeLabel(spy.timestamp)}, read from {spy.accountsScanned.toLocaleString("en-US")} token accounts. Not estimated.</> : "Run pnpm visibility to produce this number from mainnet."}
              </p>
            </div>
            <div className="card pad-lg">
              <div className="small">Where {spy?.symbol ?? "the supply"} actually sits</div>
              <dl className="kv" style={{ marginTop: 14 }}>
                {spy ? (
                  <>
                    <div className="contents"><dt>Wallets</dt><dd>{pctOf(spy, spy.walletVisibleRaw).toFixed(2)}%</dd></div>
                    {top.map((b) => (
                      <div key={b.label} className="contents"><dt>{b.label}</dt><dd>{pctOf(spy, b.raw).toFixed(2)}%</dd></div>
                    ))}
                  </>
                ) : null}
              </dl>
              <p className="small" style={{ marginTop: 14 }}>Programs are named from their on-chain IDL, never guessed.</p>
            </div>
            <div className="card pad-lg">
              <div className="small">What issuers get today</div>
              <ul className="body-sm" style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 8 }}>
                <li>Balances that stop at the program boundary.</li>
                <li>No way to prove who was entitled at a slot.</li>
                <li>Holders who must exit positions to take part.</li>
              </ul>
              <p className="small" style={{ marginTop: 14 }}>{aapl ? <>AAPLx is at {aapl.programHeldPct}% program-held today; that share grows with every new venue.</> : null}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Label tone="green">How it works</Label>
          <h2 className="h2" style={{ marginTop: 18, maxWidth: 560 }}>Four steps, every one a transaction or a file anyone can recompute.</h2>
          <div className="grid-4" style={{ marginTop: 40 }}>
            {[
              { n: "01", icon: Icon.Wallet, t: "Holders opt in", d: "One signature registers a wallet for corporate actions on a mint. Public, no identity, no KYC." },
              { n: "02", icon: Icon.Eye, t: "The resolver snapshots", d: "At the record slot every token account is attributed once: wallets directly, DeFi positions through issuer-defined rules, the rest labelled and left unattributed." },
              { n: "03", icon: Icon.Tree, t: "Only the root goes on-chain", d: "Entitlements become a Merkle tree. The root, a content hash and the slot are published; the entitlement file stays public." },
              { n: "04", icon: Icon.Coins, t: "Holders claim or vote", d: "A proof unlocks the USDC distribution or a weighted vote. The program checks registration, inclusion and single use." }
            ].map((s) => (
              <div key={s.n} className="card pad" style={{ display: "grid", gap: 14 }}>
                <div className="flex items-center justify-between"><span className="logo sm" style={{ background: "var(--elev-2)" }}><s.icon width={14} height={14} /></span><span className="small mono">{s.n}</span></div>
                <div className="h5">{s.t}</div>
                <p className="body-sm" style={{ margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
          <p className="body-sm" style={{ marginTop: 20, maxWidth: 720 }}>
            The rule that never bends: attributed plus unattributed equals the supply held in token accounts. {latest?.snapshot ? <>Latest snapshot on this deployment: {latest.snapshot.attributedPct}% attributed, {latest.snapshot.leaves} leaves, {shares(latest.snapshot.totalEntitlement)} shares, double counted 0.</> : null}
          </p>
        </div>
      </section>

      {/* Product */}
      <section id="product" className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Label tone="cyan">Product</Label>
          <h2 className="h2" style={{ marginTop: 18, maxWidth: 560 }}>One register, three surfaces.</h2>
          <div style={{ display: "grid", gap: 24, marginTop: 40 }}>
            {[
              { t: "Portfolio, for holders", d: "Everything a wallet holds of a tokenized stock, including what sits in Raydium and Kamino, with the rule that counted each position. Register once, then claim or vote with a proof while the positions stay where they are.", href: "/portfolio", cta: "Open portfolio", facts: ["Wallet, pool and reserve positions in one ledger", "Rights profile per wrapper", "Proof verified in the browser"] },
              { t: "Issuer console", d: "Pick the stock and the wrappers in scope, set a session-aware record date, run the snapshot, publish the root, fund the distribution or open the vote. The issuer role is simulated in the demo; the pipeline is real.", href: "/issuer", cta: "Run a record date", facts: ["Snapshot with live supply invariants", "Certificate: root, content hash, slot", "Claims and tallies read from program state"] },
              { t: "Record and assets", d: "Every record date with its certificate and a leaf lookup anyone can verify, and a directory of every tokenized stock, ETF and pre-IPO token on Solana with all of its wrappers, prices and venues.", href: "/assets", cta: "Browse assets", facts: ["400 stocks, 24 ETFs, pre-IPO tokens", "Price charts per wrapper", "Where each mint trades"] }
            ].map((p, i) => (
              <div key={p.t} className="card" style={{ display: "grid", gridTemplateColumns: i % 2 ? "1fr 1fr" : "1fr 1fr", gap: 0, overflow: "hidden" }}>
                <div className="pad-lg" style={{ padding: 40, order: i % 2 ? 2 : 1 }}>
                  <div className="h3">{p.t}</div>
                  <p className="body-lg" style={{ margin: "14px 0 0" }}>{p.d}</p>
                  <div className="btnrow" style={{ marginTop: 22 }}><Link href={p.href} className="btn primary">{p.cta}</Link></div>
                </div>
                <div style={{ order: i % 2 ? 1 : 2, background: "linear-gradient(180deg, rgb(30,32,35), rgb(19,21,23))", borderLeft: i % 2 ? 0 : "1px solid var(--line)", borderRight: i % 2 ? "1px solid var(--line)" : 0, padding: 40, display: "grid", alignContent: "center", gap: 10 }}>
                  {p.facts.map((f) => (
                    <div key={f} className="inset" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                      <Icon.Check width={14} height={14} style={{ color: "var(--green)" }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it is for */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Label tone="purple">Who it is for</Label>
          <h2 className="h2" style={{ marginTop: 18, maxWidth: 560 }}>Built for issuers, transfer agents and the protocols holding their shares.</h2>
          <div className="grid-3" style={{ marginTop: 40 }}>
            {[
              { icon: Icon.Building, t: "Issuers and transfer agents", d: "A record-date process that survives composability: who is entitled, with proof, without asking anyone to leave a pool." },
              { icon: Icon.Wallet, t: "Holders", d: "Register once. Claim a distribution or vote with a Merkle proof while the Raydium position and the Kamino deposit stay put." },
              { icon: Icon.Plug, t: "Protocols and wallets", d: "An open adapter interface. A lending market keeps its depositors enfranchised; a wallet with its own voting rail reads the same tree." }
            ].map((w) => (
              <div key={w.t} className="card pad">
                <span className="logo" style={{ background: "var(--elev-2)" }}><w.icon width={18} height={18} /></span>
                <div className="h5" style={{ marginTop: 18 }}>{w.t}</div>
                <p className="body-sm" style={{ margin: "8px 0 0" }}>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section id="assets" className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card pad-lg" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40 }}>
            <div>
              <Label tone="teal">Coverage</Label>
              <h2 className="h2" style={{ marginTop: 18 }}>Every tokenized stock on Solana, with every wrapper.</h2>
              <p className="body-lg" style={{ marginTop: 14 }}>The assets directory lists the tokens.xyz curated stocks and ETFs, each with its xStock, Ondo, Backpack and other wrappers, plus pre-IPO tokens from Tessera and PreStocks. Prices, liquidity, venues and rights profiles in one place.</p>
              <div className="btnrow" style={{ marginTop: 22 }}><Link href="/assets" className="btn primary">Browse the directory</Link></div>
            </div>
            <div className="grid-2">
              {[["400", "curated stocks"], ["24", "ETFs"], ["2", "pre-IPO issuers"], ["3", "adapters implemented, 4 declared"]].map(([n, l]) => (
                <div key={l} className="inset" style={{ padding: 20 }}>
                  <div className="h2 num">{n}</div>
                  <div className="small" style={{ marginTop: 6 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What is real */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Label tone="orange">Honesty</Label>
          <h2 className="h2" style={{ marginTop: 18, maxWidth: 560 }}>What is real, and what is simulated.</h2>
          <div className="grid-2" style={{ marginTop: 40 }}>
            <div className="card pad">
              <div className="h5">Real</div>
              <p className="body-sm" style={{ margin: "10px 0 0" }}>The mints, the Raydium pool, the Kamino reserve and every other holder are mainnet state, read through a surfpool fork. Positions were opened with the protocols&apos; own instructions. The program is deployed{c === "devnet" ? " on devnet and on the fork" : " on the fork and on devnet"}, and every claim and vote is a transaction.</p>
            </div>
            <div className="card pad">
              <div className="h5">Simulated</div>
              <p className="body-sm" style={{ margin: "10px 0 0" }}>The issuer. A registrar keypair we operate publishes actions, and the USDC that funds a distribution comes from a demo wallet. xStocks are tracker certificates with no voting rights and dividends reinvested through the mint multiplier, so a vote here shows the rail, not a real proxy. Entitlements are issuer-defined, never a determination of legal ownership.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 48 }}>
          <div>
            <Label tone="pink">Questions</Label>
            <h2 className="h2" style={{ marginTop: 18 }}>Everything explained to help you decide.</h2>
          </div>
          <div className="faq">
            {[
              ["Does Lookthrough decide who legally owns a share?", "No. It computes entitlements under rules the issuer declares, and publishes the result so anyone can check it. Legal ownership of the underlying is a matter for the issuer's own documentation."],
              ["What happens to supply the resolver cannot attribute?", "It stays in a labelled unattributed bucket, named from the holding program's on-chain IDL when one exists. Attributed plus unattributed must equal the token-account supply, or the snapshot fails."],
              ["Which DeFi positions are looked through today?", "Raydium CLMM positions and Kamino Lend deposits. Meteora DLMM, Orca Whirlpool, index baskets and exchange omnibus accounts are declared adapters that currently report, not resolve."],
              ["Can I try it with my own wallet?", "Yes, on devnet. Connect a wallet, take demo shares from the faucet, register, and the issuer console can run a record date that includes you. On the mainnet fork, use the demo wallets."],
              ["Is the code open?", "Yes. The resolver, adapters, Anchor program, SDK and this app are in one repository with a verify gate that runs unit, program and browser tests."]
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="tile" style={{ padding: "64px 40px", textAlign: "center" }}>
            <h2 className="h2">See a record date resolve end to end.</h2>
            <p className="body-lg" style={{ margin: "14px auto 0", maxWidth: 520 }}>Open the portfolio with a demo wallet, or connect your own on devnet and run the whole flow yourself.</p>
            <div className="btnrow" style={{ marginTop: 26, justifyContent: "center" }}>
              <Link href="/portfolio" className="btn primary">Open the app</Link>
              <Link href="/issuer" className="btn secondary">Issuer console</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
