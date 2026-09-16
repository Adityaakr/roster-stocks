import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { Label } from "@/components/ui";
import { M } from "@/components/mono";
import { WalletCheck } from "@/components/wallet-check";
import { readVisibility, store } from "@/lib/server";
import { slotLabel } from "@/lib/format";

/*
 * Landing page, v3 copy. Measured values come from the latest visibility scan and the latest record on this
 * deployment at request time and are printed as stored, never rounded. Citations link to the sources in SOURCES.
 */

interface Visibility {
  symbol: string;
  slot: number;
  timestamp: number;
  accountsScanned: number;
  accountsRaw: string;
  walletVisibleRaw: string;
  programHeldPct: string;
  breakdownByProgram: { label: string; pct: string; raw: string }[];
}

export const dynamic = "force-dynamic";

const SOCIAL = "30.35% of SPYx on Solana is held by programs the issuer cannot see. Paste a wallet and see if you're in it.";
export const metadata: Metadata = {
  title: { absolute: "Lookthrough. Rights or composability was a false choice." },
  description: "Put a tokenized stock into a pool and the register loses you. Lookthrough resolves every holder behind every program at the record date, proves it with one root on Solana, and pays or polls them without a token moving.",
  openGraph: { title: "Lookthrough. Rights or composability was a false choice.", description: SOCIAL },
  twitter: { card: "summary_large_image", title: "Lookthrough. Rights or composability was a false choice.", description: SOCIAL }
};

const SOURCES = {
  malinova: "https://doi.org/10.1016/j.respol.2026.105497",
  sta: "https://www.sec.gov/files/ctf-written-input-sta-duggan-070126.pdf",
  cstt: "https://www.sec.gov/files/ctf-written-input-cstt-072126.pdf",
  coindesk: "https://www.coindesk.com/policy/2026/07/13/wall-street-transfer-agents-lobby-sec-warning-that-third-party-tokens-pose-risks-to-market-integrity",
  secStaff: "https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities",
  secTa: "https://www.sec.gov/newsroom/press-releases/2026-81-sec-proposes-modernize-rules-registered-transfer-agents",
  dtccNoAction: "https://www.dtcc.com/news/2025/december/11/paving-the-way-to-tokenized-dtc-custodied-assets",
  dtccIsitc: "https://isitc.org/?p=20391",
  dtccCost: "https://www.dtcc.com/dtcc-connection/articles/2024/may/01/the-hidden-rising-cost-of-corporate-actions",
  broadridge: "https://www.broadridge-ir.com/news/news-details/2025/Broadridge-Reports-Fourth-Quarter-and-Fiscal-2025-Results/default.aspx",
  a16zRwa: "https://a16zcrypto.com/posts/article/tokenized-asset-rwa-market-data-charts/",
  a16zStocks: "https://a16zcrypto.com/posts/article/charts-tokenized-stocks/",
  sentora: "https://sentora.com/research/articles/how-tokenized-stocks-work",
  metamask: "https://metamask.io/news/tokenized-stocks-vs-traditional-stocks",
  scaledUi: "https://solana.com/docs/tokens/extensions/scaled-ui-amount"
};

const BREAKDOWN_LABEL: Record<string, string> = {
  "other programs": "Other programs",
  "Kamino Lend": "Kamino Lend",
  "Raydium CLMM": "Raydium CLMM",
  "other programs (PDA holding lamports only)": "Program accounts holding lamports only"
};

function Src({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ borderBottom: "1px solid var(--line-strong)" }}>
      {children}
    </a>
  );
}

function Section({ id, label, tone, title, children, intro }: { id?: string; label: string; tone?: "blue" | "green" | "yellow" | "cyan" | "purple" | "pink" | "orange" | "teal"; title: React.ReactNode; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <Label tone={tone ?? "blue"}>{label}</Label>
        <h2 className="h2" style={{ marginTop: 18, maxWidth: 640 }}>{title}</h2>
        {intro ? <p className="body-lg" style={{ marginTop: 16, maxWidth: 640 }}>{intro}</p> : null}
        <div style={{ marginTop: 36 }}>{children}</div>
      </div>
    </section>
  );
}

export default function Landing() {
  const spy = readVisibility("XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W") as Visibility | null;
  const aapl = readVisibility("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp") as Visibility | null;
  const latest = store().list().find((a) => a.snapshot) ?? null;
  // Truncated to two decimals like every other percentage in the visibility file, never rounded.
  const pct2 = (part: string, whole: string) => { const bp = (BigInt(part) * 10_000n) / BigInt(whole); return `${bp / 100n}.${(bp % 100n).toString().padStart(2, "0")}`; };
  const spyWalletsPct = spy ? pct2(spy.walletVisibleRaw, spy.accountsRaw) : null;
  const spyDate = spy ? new Date(spy.timestamp * 1000) : null;
  const spyDateLabel = spyDate ? `${spyDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}, ${spyDate.toISOString().slice(11, 16)} UTC` : null;
  const breakdown = spy ? Object.keys(BREAKDOWN_LABEL).map((k) => ({ label: BREAKDOWN_LABEL[k] as string, pct: spy.breakdownByProgram.find((b) => b.label === k)?.pct ?? null })).filter((b) => b.pct !== null) : [];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ padding: "84px 0 56px" }}>
        <div className="dots absolute inset-x-0 top-0 h-[520px] pointer-events-none" aria-hidden />
        <div className="container relative" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 48, alignItems: "center" }}>
          <div>
            <Label>Record-date infrastructure for tokenized stocks</Label>
            <h1 className="h1" style={{ marginTop: 22, fontSize: 56 }}>Your shares went into DeFi. The register lost you.</h1>
            <p className="body-lg" style={{ marginTop: 22, maxWidth: 560 }}>
              Lookthrough finds every holder behind every pool and vault at the record date, proves the result with one root on Solana, and lets them claim distributions and vote with a proof. The stock never has to move.
            </p>
            <div className="btnrow" style={{ marginTop: 30 }}>
              <a href="#check" className="btn primary">Check a wallet</a>
              <a href="#how" className="btn secondary">How it works</a>
            </div>
          </div>
          <div id="check">
            <WalletCheck />
          </div>
        </div>
      </section>

      {/* The number */}
      <Section label="The number" tone="yellow" title="One in three SPYx shares belongs to a program.">
        <div className="grid-3">
          <div className="card pad-lg" style={{ gridColumn: "span 2" }}>
            <div className="h1 num" style={{ fontSize: 72 }}>{spy ? `${spy.programHeldPct}%` : "n/a"}</div>
            <p className="body-sm" style={{ margin: "14px 0 0", maxWidth: 560 }}>
              {spy ? <>of SPYx supply on mainnet at slot <M>{slotLabel(spy.slot)}</M>, {spyDateLabel}, read from <M>{spy.accountsScanned.toLocaleString("en-US")}</M> token accounts. Measured, not estimated.</> : "Run pnpm visibility to produce this number from mainnet."}
            </p>
          </div>
          <div className="card pad-lg">
            <div className="small">Where SPYx actually sits</div>
            <dl className="kv" style={{ marginTop: 14 }}>
              {spy ? <div className="contents"><dt>Wallets</dt><dd><M>{spyWalletsPct}%</M></dd></div> : null}
              {breakdown.map((b) => (
                <div key={b.label} className="contents"><dt>{b.label}</dt><dd><M>{b.pct}%</M></dd></div>
              ))}
            </dl>
          </div>
        </div>
        <p className="body-sm" style={{ marginTop: 20, maxWidth: 720 }}>
          Programs are named from their on-chain IDL, never guessed.{aapl ? <> AAPLx is at <M>{aapl.programHeldPct}%</M> today.</> : null} Every new venue moves that number up; nothing moves it down.
        </p>
      </Section>

      {/* The false choice */}
      <Section label="The false choice" tone="pink" title="Rights, or composability. Nobody should have to pick.">
        <div className="card scroll-x">
          <table className="table">
            <thead>
              <tr><th /><th>Third-party wrappers</th><th>Issuer-sponsored shares</th><th>DTC tokenized entitlements</th></tr>
            </thead>
            <tbody>
              {[
                ["Examples", "xStocks, Ondo, Robinhood", "Superstate, Securitize, Figure", "DTC service, H2 2026"],
                ["Usable in DeFi", "Yes", "Where the issuer allows", "No, registered wallets only"],
                ["Voting", "None, or a preference the issuer may consider", "Yes, from a recognised wallet", "Yes, inside the depository"],
                ["Holder visible once inside a pool", "No", "No", "Not applicable"],
                ["What a record date sees", "The pool", "The pool", "The nominee"]
              ].map((row) => (
                <tr key={row[0]}>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="body-lg" style={{ marginTop: 22, maxWidth: 720 }}>Lookthrough is the fourth column. Rights-bearing shares, freely composable, with a register that can see through the program to the person.</p>
      </Section>

      {/* The problem */}
      <Section label="The problem, told the way it happens" tone="orange" title="The pool got your dividend.">
        <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 40 }}>
          <div>
            <p className="body-lg" style={{ margin: 0 }}>
              You put <M>40</M> shares of a tokenized stock into a Raydium pool in March to earn fees. Sensible. The company declares a dividend. The record date passes. The transfer agent pulls the holder list, and the holder of your <M>40</M> shares is a program address that cannot receive a payment, cannot vote and cannot subscribe to a rights issue. The state transition executed perfectly and landed on the wrong entity.
            </p>
            <p className="body-lg" style={{ margin: "18px 0 0" }}>
              The only answer available today is to ask you to withdraw before every record date. That drains the pool, costs every holder gas, and rewards the people who forgot with nothing. It isn&apos;t a workaround. It is the absence of a register.
            </p>
          </div>
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            {["The cap table is right. It says the shareholder is a pool.", "The dividend is real. It was paid to an address that can't spend it.", "The vote happened. Your weight was zero."].map((t) => (
              <div key={t} className="card pad" style={{ padding: "18px 20px" }}>{t}</div>
            ))}
          </div>
        </div>
      </Section>

      {/* Documented, not discovered */}
      <Section label="Documented, not discovered" tone="purple" title="The problem is already in the record. The fix wasn't.">
        <ol style={{ margin: 0, padding: 0, listStyle: "none", borderTop: "1px solid var(--line)" }}>
          {[
            [<Src key="1" href={SOURCES.malinova}>Malinova and Park, Research Policy, 2026.</Src>, <>Attributing beneficial ownership when tokens sit inside smart contracts is the unresolved problem of tokenizing equities; whitelists break DeFi; the workable answer is an opt-in registry with a look-through into pool positions. Lookthrough implements it.</>],
            [<Src key="2" href={SOURCES.sta}>Securities Transfer Association, letter to the SEC, July 1, 2026.</Src>, <>On behalf of <M>100+</M> transfer agents keeping the books for <M>15,000</M> issuers and <M>100 million</M> registered shareholders: the register must remain authoritative, and third-party tokens threaten the loss of reliable holder information.</>],
            [<Src key="3" href={SOURCES.cstt}>Continental Stock Transfer &amp; Trust, July 21, 2026.</Src>, <>Tokens that bypass the shareholder-record and corporate-action infrastructure put issuer governance and investor protection at risk.</>],
            [<><Src href={SOURCES.secStaff}>SEC staff, January 2026</Src>, and the <Src href={SOURCES.secTa}>September 1, 2026 transfer agent proposal</Src>.</>, <>A taxonomy that ties shareholder rights to the official register, followed by the first overhaul of transfer agent rules since the 1970s, asking how ownership records should interact with distributed ledgers.</>],
            [<><Src href={SOURCES.dtccNoAction}>DTCC, December 2025</Src> and <Src href={SOURCES.dtccIsitc}>June 2026</Src>.</>, <>A no-action letter to tokenize Russell 1000 shares with full entitlements from the second half of 2026, transfers restricted to registered wallets; and a public case that tokenized corporate actions need continuous entitlement tracking and programmable elections.</>],
            [<Src key="6" href={SOURCES.a16zRwa}>a16z crypto, May 2026.</Src>, <>Tokenized assets have proved the concept; the hard part is deeper integration into composable infrastructure. Most tokenization today is closer to notarisation, and the largest categories barely touch DeFi.</>],
            [<Src key="7" href={SOURCES.sentora}>Sentora Research, August 2026.</Src>, <>Corporate-action handling follows the issuance model, and the gap on voting is consistent across live wrapper programmes.</>],
            [<Src key="8" href={SOURCES.metamask}>Ondo and Broadridge, April 2026.</Src>, <>Wallet-native voting for tokenized stocks. It counts wallets, and it relays preferences rather than proxies. The share of supply inside programs is the part it cannot reach.</>]
          ].map(([head, body], i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr)", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
              <span className="mono small" style={{ paddingTop: 3 }}>{String(i + 1).padStart(2, "0")}</span>
              <p className="body-sm" style={{ margin: 0 }}>
                <b style={{ color: "var(--text)", fontWeight: 500 }}>{head}</b> {body}
              </p>
            </li>
          ))}
        </ol>
        <p className="body-lg" style={{ marginTop: 22, maxWidth: 720 }}>Everyone named above agrees on the diagnosis. Lookthrough is the first thing built on the prescription.</p>
      </Section>

      {/* 1973 */}
      <Section label="1973" tone="teal" title="Wall Street built this once. DeFi hasn't yet.">
        <p className="body-lg" style={{ margin: 0, maxWidth: 760 }}>
          In 1968 paper certificates moved so slowly that the New York Stock Exchange had to shorten its trading week. The fix, in 1973, was to immobilise shares at a depository and track beneficial owners through intermediaries. That look-through is why you can hold stock in street name at a broker and still receive your dividend and your proxy. Tokenized stocks reproduced the immobilisation, inside programs this time, and skipped the look-through. Lookthrough rebuilds it for smart contracts, with one property the original never had: anyone can recompute the register from a public file and check it against the chain.
        </p>
      </Section>

      {/* How it works */}
      <Section id="how" label="How it works" tone="green" title="Four steps, every one a transaction or a file anyone can recompute.">
        <div className="grid-4">
          {[
            { n: "01", icon: Icon.Wallet, t: "Holders opt in", d: "One signature registers a wallet for corporate actions on a mint. Public, no identity, no KYC. The token stays wherever it is." },
            { n: "02", icon: Icon.Eye, t: "The resolver snapshots", d: "At the record slot every token account is attributed exactly once: wallets directly, DeFi positions through issuer-defined rules, everything else labelled by program and left unattributed. Balances are read as share equivalents, raw amount times the Token-2022 multiplier in effect at that slot." },
            { n: "03", icon: Icon.Tree, t: "Only the root goes on-chain", d: "Entitlements become a Merkle tree. The root, a content hash and the slot are committed to Solana. The entitlement file is published alongside so the root can be rebuilt by anyone from the file alone." },
            { n: "04", icon: Icon.Coins, t: "Holders claim or vote", d: "A proof unlocks the USDC distribution or a weighted vote. The program checks registration, inclusion and single use. Positions never move." }
          ].map((s) => (
            <div key={s.n} className="card pad" style={{ display: "grid", gap: 14, alignContent: "start" }}>
              <div className="flex items-center justify-between"><span className="logo sm" style={{ background: "var(--elev-2)" }}><s.icon width={14} height={14} /></span><span className="small mono">{s.n}</span></div>
              <div className="h5">{s.t}</div>
              <p className="body-sm" style={{ margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card pad">
            <div className="h6">The rule that never bends</div>
            <p className="body-sm" style={{ margin: "10px 0 0" }}>
              Attributed plus unattributed equals the supply held in token accounts. If the equation fails, the snapshot fails and nothing is published.{latest?.snapshot ? <> Latest record on this deployment: <M>{latest.snapshot.attributedPct}%</M> attributed, double counted <M>0</M>.</> : null}
            </p>
          </div>
          <div className="card pad">
            <div className="h6">Why Solana</div>
            <p className="body-sm" style={{ margin: "10px 0 0" }}>
              Token-2022 carries corporate actions inside the mint through the <Src href={SOURCES.scaledUi}>scaled UI multiplier</Src>, so a split is a state transition the resolver can read at any slot. Program-owned accounts are legible without anyone&apos;s permission. A claim costs a fraction of a cent, which is what makes paying thousands of holders individually a reasonable thing to do. And this is where the positions are.
            </p>
          </div>
        </div>
      </Section>

      {/* Not a dashboard */}
      <Section label="Not a dashboard" tone="cyan" title="A register with a settlement leg." intro="Analytics tells you who was missed. Lookthrough pays them. Every record ends in transactions: a root committed, a vault funded, a claim settled, a vote weighted and tallied, each one checked by the program rather than by us. The invisible-shares check is the front door. The rail behind it is the product.">
        <div className="grid-3">
          {["Issuers publish once and every entitled holder can act, wherever their shares sit.", "Holders never unwind a position to be counted.", "Protocols become rights-preserving by implementing one function."].map((t) => (
            <div key={t} className="card pad" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Icon.Check width={16} height={16} style={{ color: "var(--green)", flex: "none", marginTop: 3 }} />
              <span className="body-sm" style={{ color: "var(--text)" }}>{t}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* What this unlocks */}
      <Section label="What this unlocks" tone="blue" title="Everything the multiplier can't do." intro="Rebasing dividends and splits already reach pool-held tokens through the mint multiplier. Everything else needs to know who the holder is.">
        <div className="grid-3">
          {[
            "Cash distributions on shares and entitlements that pay in USDC.",
            "Shareholder votes with the weight that sits in pools and vaults.",
            "Spin-offs, rights issues, tender offers and merger elections.",
            "Pre-IPO tokens converting or paying out at the liquidity event.",
            "Payment in lieu for shares lent through a lending market, the way securities lending has always worked.",
            "Rewards and airdrops that reach economic holders instead of wallet balances."
          ].map((t) => (
            <div key={t} className="card pad" style={{ padding: "18px 20px" }}><span className="body-sm" style={{ color: "var(--text)" }}>{t}</span></div>
          ))}
        </div>
      </Section>

      {/* The size of the job */}
      <Section label="The size of the job" tone="yellow" title="The register is a very large business. It just hasn't met DeFi yet.">
        <div className="grid-3">
          {[
            ["$58B", <>a year: what corporate action processing costs the US market, per <Src href={SOURCES.dtccCost}>DTCC and the ValueExchange</Src>, with more than <M>$15B</M> of it avoidable.</>],
            ["$5.1B", <><Src href={SOURCES.broadridge}>Broadridge&apos;s fiscal 2025 revenue</Src> from investor communications, mostly proxy processing and distribution. That is the shareholder-facing half of the job, priced per position.</>],
            ["$2.6T", <><Src href={SOURCES.coindesk}>Citi&apos;s 2030 base case</Src> for tokenized stocks, inside <M>$5.5T</M> of tokenized securities.</>],
            ["$99T", <>assets in DTC custody, with <Src href={SOURCES.dtccNoAction}>Russell 1000 shares now cleared</Src> to be tokenized with full entitlements.</>],
            ["5x", <>growth of tokenized stocks in the past year, <Src href={SOURCES.a16zStocks}>per a16z</Src>; nearly all onchain equity spot volume settles on Solana.</>],
            [spy ? `${spy.programHeldPct}%` : "n/a", <>the share of SPYx a record date cannot see today. That fraction, applied to every future corporate action on every share that touches DeFi, is the addressable problem.</>]
          ].map(([n, t], i) => (
            <div key={i} className="card pad">
              <div className="h2 num">{n}</div>
              <p className="body-sm" style={{ margin: "10px 0 0" }}>{t}</p>
            </div>
          ))}
        </div>
        <p className="body-lg" style={{ marginTop: 22, maxWidth: 760 }}>Priced the way the incumbents already price it: per corporate action, per position, plus a feed for the rails that need to read the same tree.</p>
      </Section>

      {/* Product */}
      <Section id="product" label="Product" tone="cyan" title="One register, three surfaces.">
        <div style={{ display: "grid", gap: 24 }}>
          {[
            { t: "Portfolio, for holders", d: "Everything a wallet holds of a tokenized stock, including what sits in Raydium and Kamino, with the rule that counted each position. Register once, then claim or vote with a proof while the positions stay where they are.", href: "/portfolio", cta: "Open portfolio", facts: ["Wallet, pool and reserve positions in one ledger", "Rights profile per wrapper", "Proof verified in the browser"] },
            { t: "Issuer console", d: "Pick the stock and the wrappers in scope, set a session-aware record date, run the snapshot, publish the root, fund the distribution or open the vote. Records are published by a registrar authority; the issuer's rules decide what each position is entitled to.", href: "/issuer", cta: "Run a record date", facts: ["Snapshot with live supply invariants", "Certificate: root, content hash, slot", "Claims and tallies read from program state"] },
            { t: "Records and assets", d: "Every record date with its certificate and a leaf lookup anyone can verify, and a directory of every tokenized stock, ETF and pre-IPO token on Solana with its wrappers, prices and venues.", href: "/assets", cta: "Browse assets", facts: [<><M>400</M> stocks, <M>24</M> ETFs, pre-IPO tokens</>, "Price charts per wrapper", "Where each mint trades"] }
          ].map((p, i) => (
            <div key={p.t} className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
              <div style={{ padding: 40, order: i % 2 ? 2 : 1 }}>
                <div className="h3">{p.t}</div>
                <p className="body-lg" style={{ margin: "14px 0 0" }}>{p.d}</p>
                <div className="btnrow" style={{ marginTop: 22 }}><Link href={p.href} className="btn primary">{p.cta}</Link></div>
              </div>
              <div style={{ order: i % 2 ? 1 : 2, background: "linear-gradient(180deg, rgb(30,32,35), rgb(19,21,23))", borderLeft: i % 2 ? 0 : "1px solid var(--line)", borderRight: i % 2 ? "1px solid var(--line)" : 0, padding: 40, display: "grid", alignContent: "center", gap: 10 }}>
                {p.facts.map((f, j) => (
                  <div key={j} className="inset" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                    <Icon.Check width={14} height={14} style={{ color: "var(--green)" }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Who it is for */}
      <Section label="Who it is for" tone="purple" title="Built for issuers, transfer agents and the protocols holding their shares.">
        <div className="grid-3">
          {[
            { icon: Icon.Building, t: "Issuers and transfer agents", d: "A record-date process that survives composability: who is entitled, with proof, without asking anyone to leave a pool." },
            { icon: Icon.Wallet, t: "Holders", d: "Register once. Be paid and polled on all of your shares, not the fraction that happens to sit in your wallet." },
            { icon: Icon.Plug, t: "Protocols and wallets", d: "An open adapter interface. A lending market keeps its depositors enfranchised. A wallet with its own voting rail reads the same tree. Rights-preserving becomes a feature you can advertise." }
          ].map((w) => (
            <div key={w.t} className="card pad">
              <span className="logo" style={{ background: "var(--elev-2)" }}><w.icon width={18} height={18} /></span>
              <div className="h5" style={{ marginTop: 18 }}>{w.t}</div>
              <p className="body-sm" style={{ margin: "8px 0 0" }}>{w.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Why now */}
      <Section label="Why now" tone="orange" title="Cap tables are moving onchain and the rules are being written this year.">
        <ol style={{ margin: 0, padding: 0, listStyle: "none", borderLeft: "1px solid var(--line-strong)", marginLeft: 6 }}>
          {[
            ["December 2025", <>DTC receives <Src href={SOURCES.dtccNoAction}>no-action relief</Src> to tokenize Russell 1000 shares with full entitlements.</>],
            ["January 2026", <>SEC staff <Src href={SOURCES.secStaff}>tie shareholder rights</Src> to the official register.</>],
            ["April 2026", <>Ondo and Broadridge ship <Src href={SOURCES.metamask}>wallet-native voting</Src> for tokenized stocks.</>],
            ["June 2026", <>DTCC makes the case for <Src href={SOURCES.dtccIsitc}>continuous entitlement tracking</Src> on tokenized assets.</>],
            ["July 2026", <><M>100+</M> transfer agents <Src href={SOURCES.sta}>ask the SEC</Src> to keep the register authoritative.</>],
            ["September 1, 2026", <>the SEC proposes the <Src href={SOURCES.secTa}>first transfer agent rule overhaul</Src> since the 1970s, with distributed ledgers in scope.</>],
            ["September 14, 2026", <><M>{spy?.programHeldPct ?? "30.35"}%</M> of SPYx sits inside programs.</>]
          ].map(([d, t], i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 16, padding: "10px 0 10px 24px", position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", left: -5, top: 17, width: 9, height: 9, borderRadius: 9999, background: i === 6 ? "var(--yellow)" : "var(--elev-3)", border: "1px solid var(--line-strong)" }} />
              <span className="small mono" style={{ paddingTop: 2 }}>{d}</span>
              <span className="body-sm">{t}</span>
            </li>
          ))}
        </ol>
        <p className="body-lg" style={{ marginTop: 22, maxWidth: 760 }}>The first record date with a third of the register missing isn&apos;t a forecast. For SPYx it is today.</p>
      </Section>

      {/* Determined */}
      <Section label="What Lookthrough determines" tone="teal" title="What Lookthrough determines, and what it doesn't.">
        <div className="grid-3">
          <div className="card pad">
            <div className="h5">Determined from chain</div>
            <p className="body-sm" style={{ margin: "10px 0 0" }}>The mints, the pools, the reserves and every holder in a record are mainnet state, read at the record slot. Positions are attributed under rules the issuer publishes with the action. Every claim and every vote is a transaction whose checks run in the program.</p>
          </div>
          <div className="card pad">
            <div className="h5">Determined by the issuer</div>
            <p className="body-sm" style={{ margin: "10px 0 0" }}>Entitlement rules per program, the record slot, the per-share amount, the proposal text. Lookthrough computes and proves; it does not decide. Where an issuer has not yet operated its own registrar, records are published by a registrar authority Lookthrough operates and are labelled as such on the certificate.</p>
          </div>
          <div className="card pad">
            <div className="h5">Not determined by anyone here</div>
            <p className="body-sm" style={{ margin: "10px 0 0" }}>Legal ownership. Entitlements are issuer-defined and never a determination of who legally owns a share. xStocks are tracker certificates without voting rights, with dividends reinvested through the mint multiplier; a vote on those mints exercises the rail, not a proxy.</p>
          </div>
        </div>
      </Section>

      {/* Questions */}
      <section id="faq" className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 48 }}>
          <div>
            <Label tone="pink">Questions</Label>
            <h2 className="h2" style={{ marginTop: 18 }}>Questions</h2>
          </div>
          <div className="faq">
            {[
              ["Does Lookthrough decide who legally owns a share?", "No. It computes issuer-defined entitlements across onchain positions and proves the result. Who legally holds dividend or voting rights depends on the instrument's terms, the issuer, the transfer agent, the jurisdiction, and what happened to the security through lending or other contracts. The issuer sets the rules; Lookthrough applies them and publishes the proof."],
              ["Isn't this what Broadridge and Ondo already do?", "They count wallets. A share deposited into a pool or a vault leaves the wallet, and their rail loses it. Lookthrough is the layer that follows the share into the program and hands the entitlement back to the same rails. It is built to feed them, not to replace them."],
              ["Why not just ask holders to withdraw before the record date?", "Because it drains liquidity from every pool on every record date, costs every holder a transaction, and rewards the people who forgot with nothing. The research on tokenized equity calls the approach impractical. A register that can see into programs is the alternative."],
              ["What happens to supply the resolver cannot attribute?", "It is counted, named by the program that holds it, and excluded from entitlements. Every certificate shows attributed and unattributed percentages, and a record cannot be published unless attributed plus unattributed equals the supply held in token accounts. Unattributed supply is a to-do list for adapters, never a rounding error."],
              ["Which DeFi positions are looked through today?", "Direct Token-2022 balances, Raydium CLMM positions and Kamino Lend deposits, each with its own rule. Further adapters are declared on the Adapters page with program IDs and status. Any protocol can add one; the interface is a single resolve function that returns attributed positions."],
              ["Can I use it with my own wallet?", "Yes. Paste a wallet into the check above to see what a scan misses, or connect to register, claim and vote on any open record. Registration, claims and votes are transactions on the network shown in the masthead."],
              ["Is the code open?", "Yes. The programs, the resolver, the adapters and the app are public on GitHub, with the README describing the invariant, the leaf format and how to recompute any published root."]
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="tile" style={{ padding: "64px 40px", textAlign: "center" }}>
            <h2 className="h2">Find out how much of your stock the register can&apos;t see.</h2>
            <div className="btnrow" style={{ marginTop: 26, justifyContent: "center" }}>
              <a href="#check" className="btn primary">Check a wallet</a>
              <Link href="/issuer" className="btn secondary">Issuer console</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
