"use client";

import { Reveal } from "@/components/motion";
import { short, slotLabel, usdc } from "@/lib/format";
import type { LandingData } from "@/lib/landing-data";
import { SOURCES } from "./evidence";

/** Four steps, each with the artifact it produces, in the same field names the code writes. */
export function HowItWorks({ data }: { data: LandingData }) {
  const l = data.latest;
  const ex = data.example;
  const sh = (v6: string | null) => (v6 ? `${(BigInt(v6) / 1_000_000n).toString()}` : "0");
  const steps: { n: string; t: string; d: string; artifact: string }[] = [
    { n: "01", t: "Holders opt in", d: "One signature registers a wallet for corporate actions on a mint. Public, no identity, no KYC. The token stays wherever it is.", artifact: `Registration PDA [reg, mint, wallet]  slot ${ex?.registeredAtSlot ? slotLabel(ex.registeredAtSlot) : "pending"}` },
    { n: "02", t: "The resolver snapshots", d: "At the record slot every token account is attributed exactly once: wallets directly, DeFi positions through issuer-defined rules, everything else labelled by program and left unattributed. Balances are read as share equivalents, raw amount times the Token-2022 multiplier in effect at that slot.", artifact: l ? `snapshot.json  attributed ${l.attributedPct}%  unattributed ${l.unattributedPct}%  double counted 0` : "snapshot.json  pending" },
    { n: "03", t: "Only the root goes on-chain", d: "Entitlements become a Merkle tree. The root, a content hash and the slot are committed to Solana. The entitlement file is published alongside so the root can be rebuilt by anyone from the file alone.", artifact: l ? `root ${l.root.slice(0, 8)}…${l.root.slice(-4)}  content ${l.contentHash.slice(0, 6)}…${l.contentHash.slice(-4)}  slot ${slotLabel(l.slotActual)}` : "root pending" },
    { n: "04", t: "Holders claim or vote", d: "A proof unlocks the USDC distribution or a weighted vote. The program checks registration, inclusion and single use. Positions never move.", artifact: [ex?.claim ? `claim ${usdc(ex.claim.amountPaid)} USDC  tx ${ex.claim.signature ? short(ex.claim.signature, 4) : `slot ${slotLabel(ex.claim.slot)}`}` : "claim pending", ex?.vote ? `vote ${ex.vote.choice}, weight ${sh(ex.vote.entitlement)}  tx ${ex.vote.signature ? short(ex.vote.signature, 4) : `slot ${slotLabel(ex.vote.slot)}`}` : "vote pending"].join("\n") }
  ];
  return (
    <div>
      <div style={{ borderTop: "1px solid var(--line)" }}>
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08} y={18}>
            <div className="hiw-row" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: 32, padding: "26px 0", borderBottom: "1px solid var(--line)", alignItems: "start" }}>
              <div>
                <div className="mono note" style={{ marginBottom: 8 }}>{s.n}</div>
                <div className="h-item">{s.t}</div>
                <p className="body" style={{ margin: "8px 0 0", maxWidth: 560 }}>{s.d}</p>
              </div>
              <pre className="artifact" style={{ margin: 0 }}>{s.artifact}</pre>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="h-sub" style={{ textAlign: "center", margin: "48px auto 0", maxWidth: 720 }}>Attributed plus unattributed equals supply. Or nothing is published.</p>
      <p className="body" style={{ margin: "28px auto 0", maxWidth: 720 }}>
        Token-2022 carries corporate actions inside the mint through the <a className="link" href={SOURCES.scaledUi} target="_blank" rel="noreferrer">scaled UI multiplier</a>, so a split is a state transition the resolver can read at any slot. Program-owned accounts are legible without anyone&apos;s permission. A claim costs a fraction of a cent, which is what makes paying thousands of holders individually a reasonable thing to do. And this is where the positions are.
      </p>
      <style>{`@media (max-width: 809px) { .hiw-row { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  );
}
