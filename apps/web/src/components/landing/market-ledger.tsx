import { SOURCES } from "./evidence";

/** Figures as a ledger with dotted leaders; the last row is measured and the only one in accent. */
export function MarketLedger({ programHeldPct, slot }: { programHeldPct: string | null; slot: number | null }) {
  const rows: { l: string; src: string; href: string | null; v: string; us?: boolean }[] = [
    { l: "Corporate action processing, US, per year", src: "DTCC, ValueExchange", href: SOURCES.dtccCost, v: "$58B" },
    { l: "Of which avoidable", src: "DTCC, ValueExchange", href: SOURCES.dtccCost, v: "$15B+" },
    { l: "Investor communications revenue, FY2025", src: "Broadridge", href: SOURCES.broadridge, v: "$5.1B" },
    { l: "Tokenized stocks, 2030 base case", src: "Citi", href: SOURCES.coindesk, v: "$2.6T" },
    { l: "Assets in DTC custody", src: "DTCC", href: SOURCES.dtccNoAction, v: "$99T" },
    { l: "Tokenized stocks, growth in one year", src: "a16z crypto", href: SOURCES.a16zStocks, v: "5x" },
    { l: "SPYx a record date cannot see today", src: slot ? `Lookthrough, slot ${slot.toLocaleString("en-US")}` : "Lookthrough", href: null, v: programHeldPct ? `${programHeldPct}%` : "n/a", us: true }
  ];
  return (
    <div>
      <ul className="market">
        {rows.map((r) => (
          <li key={r.l} className={r.us ? "us" : ""}>
            <span className="l">{r.l}</span>
            <span className="leader" />
            <span className="src">{r.href ? <a className="link" href={r.href} target="_blank" rel="noreferrer">{r.src}</a> : r.src}</span>
            <span className="v">{r.v}</span>
          </li>
        ))}
      </ul>
      <p className="body" style={{ marginTop: 22, maxWidth: 720 }}>Priced the way the incumbents already price it: per corporate action, per position, plus a feed for the rails that need to read the same tree.</p>
    </div>
  );
}
