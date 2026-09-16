"use client";

import Link from "next/link";
import { Reveal, Roll } from "@/components/motion";
import { slotLabel } from "@/lib/format";

export function Voices({ slot, total, visible }: { slot: number | null; total: string; visible: string }) {
  const lines: [React.ReactNode, string][] = [
    [<>&ldquo;Give me the entitled set at slot <span className="mono">{slot ? slotLabel(slot) : "N"}</span>, with proof.&rdquo;</>, "A transfer agent."],
    [<>&ldquo;Pay me on all <span className="mono">{total}</span> shares, not the <span className="mono">{visible}</span> in my wallet.&rdquo;</>, "A holder."],
    [<>&ldquo;Our depositors shouldn&apos;t lose their vote for using us.&rdquo;</>, "A lending protocol."],
    [<>&ldquo;We count wallets. Give us the rest.&rdquo;</>, "A voting rail."]
  ];
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      {lines.map(([q, who], i) => (
        <Reveal key={who} delay={i * 0.08} y={18}>
          <p className="quote">{q}<small>{who}</small></p>
        </Reveal>
      ))}
    </div>
  );
}

export function Responsibility() {
  const cols: [string, React.ReactNode][] = [
    ["FROM CHAIN", <>The mints, the pools, the reserves and every holder in a record are mainnet state, read at the record slot. Positions are attributed under rules the issuer publishes with the action. Every claim and every vote is a transaction whose checks run in the program.</>],
    ["FROM THE ISSUER", <>Entitlement rules per program, the record slot, the per-share amount, the proposal text. Lookthrough computes and proves; it does not decide. Where an issuer has not yet operated its own registrar, records are published by a registrar authority Lookthrough operates and are labelled as such on the certificate.</>],
    ["FROM NOBODY HERE", <><span style={{ color: "var(--ink)" }}>Legal ownership.</span> Entitlements are issuer-defined and never a determination of who legally owns a share. xStocks are tracker certificates without voting rights, with dividends reinvested through the mint multiplier; a vote on those mints exercises the rail, not a proxy.</>]
  ];
  return (
    <div className="resp" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid var(--line)" }}>
      {cols.map(([h, body], i) => (
        <div key={h} style={{ padding: "22px 24px 0 0", borderLeft: i ? "1px solid var(--line)" : 0, paddingLeft: i ? 24 : 0 }}>
          <div className="mono note" style={{ letterSpacing: "0.04em", marginBottom: 10 }}>{h}</div>
          <p className="body" style={{ margin: 0 }}>{body}</p>
        </div>
      ))}
      <style>{`@media (max-width: 809px) { .resp { grid-template-columns: minmax(0, 1fr) !important; } .resp > div { border-left: 0 !important; padding-left: 0 !important; padding-bottom: 20px; } }`}</style>
    </div>
  );
}

const QA: [string, string][] = [
  ["Does Lookthrough decide who legally owns a share?", "No. It computes issuer-defined entitlements across onchain positions and proves the result. Who legally holds dividend or voting rights depends on the instrument's terms, the issuer, the transfer agent, the jurisdiction, and what happened to the security through lending or other contracts. The issuer sets the rules; Lookthrough applies them and publishes the proof."],
  ["Isn't this what Broadridge and Ondo already do?", "They count wallets. A share deposited into a pool or a vault leaves the wallet, and their rail loses it. Lookthrough is the layer that follows the share into the program and hands the entitlement back to the same rails. It is built to feed them, not to replace them."],
  ["Why not just ask holders to withdraw before the record date?", "Because it drains liquidity from every pool on every record date, costs every holder a transaction, and rewards the people who forgot with nothing. The research on tokenized equity calls the approach impractical. A register that can see into programs is the alternative."],
  ["What happens to supply the resolver cannot attribute?", "It is counted, named by the program that holds it, and excluded from entitlements. Every certificate shows attributed and unattributed percentages, and a record cannot be published unless attributed plus unattributed equals the supply held in token accounts. Unattributed supply is a to-do list for adapters, never a rounding error."],
  ["Which DeFi positions are looked through today?", "Direct Token-2022 balances, Raydium CLMM positions and Kamino Lend deposits, each with its own rule. Further adapters are declared on the Adapters page with program IDs and status. Any protocol can add one; the interface is a single resolve function that returns attributed positions."],
  ["Can I use it with my own wallet?", "Yes. Paste a wallet into the check above to see what a scan misses, or connect to register, claim and vote on any open record. Registration, claims and votes are transactions on the network shown in the masthead."],
  ["Is the code open?", "Yes. The programs, the resolver, the adapters and the app are public on GitHub, with the README describing the invariant, the leaf format and how to recompute any published root."]
];

export function Questions() {
  return (
    <div className="faq">
      {QA.map(([q, a]) => {
        const first = a.split(". ")[0] + ".";
        return (
          <details key={q}>
            <summary>
              <span><span className="q">{q}</span><span className="first">{first}</span></span>
              <span className="pm" aria-hidden />
            </summary>
            <p>{a}</p>
          </details>
        );
      })}
    </div>
  );
}

export function ClosingButtons() {
  return (
    <div className="btnrow">
      <a href="#check" className="btn primary"><Roll>Check a wallet</Roll></a>
      <Link href="/issuer" className="btn secondary"><Roll>Issuer console</Roll></Link>
    </div>
  );
}
