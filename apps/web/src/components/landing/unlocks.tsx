export function Unlocks() {
  const right: [string, "live" | "next"][] = [
    ["Cash distributions on shares and entitlements", "live"],
    ["Shareholder votes with pool and vault weight", "live"],
    ["Spin-offs, rights issues, tender offers, merger elections", "next"],
    ["Pre-IPO conversion and payout at the liquidity event", "next"],
    ["Payment in lieu for shares lent through a lending market", "next"],
    ["Rewards and airdrops to economic holders", "next"]
  ];
  return (
    <div className="columns2">
      <div>
        <div className="head">THE MULTIPLIER ALREADY HANDLES</div>
        <ul>
          <li>Rebasing dividends on xStocks</li>
          <li>Splits and reverse splits</li>
        </ul>
      </div>
      <div>
        <div className="head">NEEDS A HOLDER</div>
        <ul>
          {right.map(([t, s]) => (
            <li key={t}><span>{t}</span><span className={`st ${s === "live" ? "live" : ""}`}>{s === "live" ? "live" : "same root, next"}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
