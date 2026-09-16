"use client";

import { Reveal } from "@/components/motion";

export const SOURCES = {
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

interface Row {
  name: string;
  names: boolean;
  fix: string | null;
  ships: boolean;
  para: string;
  links: { href: string; label: string }[];
}

const ROWS: Row[] = [
  { name: "Malinova and Park, Research Policy, 2026", names: true, fix: "opt-in registry", ships: false, para: "Attributing beneficial ownership when tokens sit inside smart contracts is the unresolved problem of tokenizing equities; whitelists break DeFi; the workable answer is an opt-in registry with a look-through into pool positions.", links: [{ href: SOURCES.malinova, label: "Research Policy 55, 105497" }] },
  { name: "Securities Transfer Association, July 2026", names: true, fix: "issuer-sponsored model", ships: false, para: "On behalf of 100+ transfer agents keeping the books for 15,000 issuers and 100 million registered shareholders: the register must remain authoritative, and third-party tokens threaten the loss of reliable holder information.", links: [{ href: SOURCES.sta, label: "Letter to the SEC, July 1, 2026" }] },
  { name: "Continental Stock Transfer & Trust, July 2026", names: true, fix: "", ships: false, para: "Tokens that bypass the shareholder-record and corporate-action infrastructure put issuer governance and investor protection at risk.", links: [{ href: SOURCES.cstt, label: "Letter to the SEC, July 21, 2026" }] },
  { name: "SEC staff, January and September 2026", names: true, fix: "taxonomy and rules", ships: false, para: "A taxonomy that ties shareholder rights to the official register, followed by the first overhaul of transfer agent rules since the 1970s, asking how ownership records should interact with distributed ledgers.", links: [{ href: SOURCES.secStaff, label: "Staff statement, January 28, 2026" }, { href: SOURCES.secTa, label: "Transfer agent proposal, September 1, 2026" }] },
  { name: "DTCC, December 2025 and June 2026", names: true, fix: "registered wallets", ships: false, para: "A no-action letter to tokenize Russell 1000 shares with full entitlements from the second half of 2026, transfers restricted to registered wallets; and a public case that tokenized corporate actions need continuous entitlement tracking and programmable elections.", links: [{ href: SOURCES.dtccNoAction, label: "No-action relief, December 11, 2025" }, { href: SOURCES.dtccIsitc, label: "ISITC webinar, June 9, 2026" }] },
  { name: "a16z crypto, May 2026", names: true, fix: null, ships: false, para: "Tokenized assets have proved the concept; the hard part is deeper integration into composable infrastructure. Most tokenization today is closer to notarisation, and the largest categories barely touch DeFi.", links: [{ href: SOURCES.a16zRwa, label: "Tokenized assets have proved the concept" }] },
  { name: "Sentora Research, August 2026", names: true, fix: null, ships: false, para: "Corporate-action handling follows the issuance model, and the gap on voting is consistent across live wrapper programmes.", links: [{ href: SOURCES.sentora, label: "How tokenized stocks work" }] },
  { name: "Ondo and Broadridge, April 2026", names: true, fix: "wallet voting", ships: false, para: "Wallet-native voting for tokenized stocks. It counts wallets, and it relays preferences rather than proxies. The share of supply inside programs is the part it cannot reach.", links: [{ href: SOURCES.metamask, label: "Tokenized stocks vs traditional stocks, MetaMask" }] }
];

const Check = () => <span className="yes" aria-label="yes">✓</span>;
const Dash = () => <span className="no" aria-label="no"><i style={{ display: "inline-block", width: 12, borderTop: "1px solid var(--line-strong)", verticalAlign: "middle" }} /></span>;

/** Rows are sources, columns are stages. The empty third column is the point. */
export function EvidenceMatrix() {
  return (
    <div className="scroll-x">
      <table className="matrix">
        <thead>
          <tr><th>Source</th><th>NAMES THE PROBLEM</th><th>PROPOSES A FIX</th><th>SHIPS THE LOOK-THROUGH</th></tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => (
            <Reveal key={r.name} as="tr" y={8} delay={i * 0.06} amount={0.6}>
              <td>
                <details>
                  <summary>{r.name}</summary>
                  <p>{r.para} {r.links.map((l, j) => <span key={l.href}>{j ? " · " : ""}<a className="link" href={l.href} target="_blank" rel="noreferrer">{l.label}</a></span>)}</p>
                </details>
              </td>
              <td>{r.names ? <Check /> : <Dash />}</td>
              <td>{r.fix === null ? <Dash /> : <><Check />{r.fix ? <span className="how">{r.fix}</span> : null}</>}</td>
              <td>{r.ships ? <Check /> : <Dash />}</td>
            </Reveal>
          ))}
          <Reveal as="tr" y={8} delay={ROWS.length * 0.06} amount={0.6} className="us">
            <td style={{ color: "var(--ink)" }}>Lookthrough</td>
            <td><Check /></td>
            <td><Check /></td>
            <td><Check /></td>
          </Reveal>
        </tbody>
      </table>
    </div>
  );
}

/** Seven dated ticks, scrolling inside its own container at phone width. */
export function Timeline({ programHeldPct }: { programHeldPct: string }) {
  const items: [string, string, string | null][] = [
    ["December 2025", "DTC receives no-action relief to tokenize Russell 1000 shares with full entitlements.", SOURCES.dtccNoAction],
    ["January 2026", "SEC staff tie shareholder rights to the official register.", SOURCES.secStaff],
    ["April 2026", "Ondo and Broadridge ship wallet-native voting for tokenized stocks.", SOURCES.metamask],
    ["June 2026", "DTCC makes the case for continuous entitlement tracking on tokenized assets.", SOURCES.dtccIsitc],
    ["July 2026", "100+ transfer agents ask the SEC to keep the register authoritative.", SOURCES.sta],
    ["September 1, 2026", "The SEC proposes the first transfer agent rule overhaul since the 1970s, with distributed ledgers in scope.", SOURCES.secTa],
    ["September 14, 2026", `${programHeldPct}% of SPYx sits inside programs.`, null]
  ];
  return (
    <div className="timeline" role="list" aria-label="Why now">
      {items.map(([d, t, href], i) => (
        <div key={d} role="listitem" className={i === items.length - 1 ? "last" : ""}>
          <div className="d">{d}</div>
          <div className="t">{t}{href ? <> <a className="link mono" style={{ fontSize: 11, color: "var(--slate)" }} href={href} target="_blank" rel="noreferrer">source</a></> : null}</div>
        </div>
      ))}
    </div>
  );
}
