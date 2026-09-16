"use client";

import { Reveal } from "@/components/motion";
import { shares, short, slotLabel, usdc } from "@/lib/format";
import type { LandingData } from "@/lib/landing-data";

/*
 * Before and after: one record date, run twice, with a spine of stages between the two columns. The left column is what
 * happens today once the shares sit inside a program; the right column is the same day with Lookthrough on the register.
 * Every figure is measured (the visibility scan, the latest snapshot, the example wallet's receipts) or it is not printed.
 * Motion: the header and each row fade up on view, staggered 0.1 s, the section's one entrance choreography.
 */
interface Stage {
  n: string;
  s: string;
  /** The verdict line for each column, which is what the reader compares; the prose underneath explains it. */
  beforeV: string;
  before: string;
  beforeFig: string | null;
  afterV: string;
  after: string;
  afterFig: string | null;
}

export function BeforeAfter({ data }: { data: LandingData }) {
  const l = data.latest;
  const ex = data.example;
  const spy = data.spy;
  const stages: Stage[] = [
    {
      n: "01",
      s: "The deposit",
      beforeV: "The holder leaves the book",
      before: "The shares leave the wallet for a pool and a lending market. The address on the register becomes a program, and the person behind it is off the book.",
      beforeFig: ex?.direct6 && ex.entitlement6 ? `wallet ${shares(ex.direct6, 2, 2)} of ${shares(ex.entitlement6, 2, 2)} share equivalents` : null,
      afterV: "The holder stays on the book",
      after: "Nothing moves. One signature, before or after the deposit, registers the wallet for that mint. No identity, no KYC, no withdrawal.",
      afterFig: ex?.registeredAtSlot ? `registration [reg, mint, wallet] · slot ${slotLabel(ex.registeredAtSlot)}` : "registration [reg, mint, wallet]"
    },
    {
      n: "02",
      s: "The record date",
      beforeV: "Counted, not attributed",
      before: "A wallet scan reads token accounts and stops where a program owns them. The balance is counted, the holder is not.",
      beforeFig: spy ? `${spy.programHeldPct}% of ${spy.symbol} held by programs at slot ${slotLabel(spy.slot)}` : null,
      afterV: "Attributed once, to a person",
      after: "The resolver reads the same accounts, then looks inside each position and attributes every share once, under the issuer's rules.",
      afterFig: l ? `attributed ${l.attributedPct}% · unattributed ${l.unattributedPct}% · double counted 0` : "snapshot pending"
    },
    {
      n: "03",
      s: "The proof",
      beforeV: "Nobody can check it",
      before: "The holder file stays inside the agent. Nobody outside can recompute who was entitled, or check it later.",
      beforeFig: null,
      afterV: "Anyone can recompute it",
      after: "One root, one content hash and one slot go on-chain. The entitlement file is public, so anyone can rebuild the tree and get the same root.",
      afterFig: l ? `root ${l.root.slice(0, 8)}…${l.root.slice(-4)} · content ${l.contentHash.slice(0, 6)}…${l.contentHash.slice(-4)} · slot ${slotLabel(l.slotActual)}` : "root pending"
    },
    {
      n: "04",
      s: "The dividend",
      beforeV: "Paid to the program",
      before: "Payment follows the register, so it reaches the program's balance. What the holder gets out of it depends on that program's rules, not the issuer's.",
      beforeFig: null,
      afterV: "Paid to the holder",
      after: "USDC per share equivalent, claimed against the root with a proof. The position stays where it is and keeps earning.",
      afterFig: ex?.claim ? `claimed ${usdc(ex.claim.amountPaid)} USDC · ${ex.claim.signature ? short(ex.claim.signature, 4) : `slot ${slotLabel(ex.claim.slot)}`}` : l?.amountPerShareMicro ? `${usdc(l.amountPerShareMicro)} USDC per share equivalent` : null
    },
    {
      n: "05",
      s: "The vote",
      beforeV: "The weight goes uncast",
      before: "Wallet-native voting counts wallets. A share inside a program has no wallet to count, so that weight goes uncast.",
      beforeFig: null,
      afterV: "The weight is counted",
      after: "The same tree is the weight. The program checks registration, inclusion and single use, and the tally is on-chain state.",
      afterFig: ex?.vote ? `voted ${ex.vote.choice} · weight ${shares(ex.vote.entitlement, 2, 2)} share equivalents` : null
    }
  ];

  return (
    <div className="ba">
      <Reveal y={20} className="ba-head">
        <div className="ba-title before">
          <span className="ba-when">Today</span>
          <div className="h-item">Without Lookthrough</div>
          <p className="note">The register sees the program.</p>
        </div>
        <div className="ba-spine" aria-hidden />
        <div className="ba-title after">
          <span className="ba-when">The same day</span>
          <div className="h-item">With Lookthrough</div>
          <p className="note">The register sees the person behind it.</p>
        </div>
      </Reveal>
      {stages.map((st, j) => (
        <Reveal key={st.n} y={32} delay={0.1 + j * 0.1} className="ba-row">
          <div className="ba-cell before">
            <span className="ba-when">Without Lookthrough</span>
            <span className="ba-mark"><i aria-hidden>–</i>{st.beforeV}</span>
            <p>{st.before}</p>
            {st.beforeFig ? <span className="ba-fig mono">{st.beforeFig}</span> : null}
          </div>
          <div className="ba-step">
            <span className="n">{st.n}</span>
            <span className="s">{st.s}</span>
          </div>
          <div className="ba-cell after">
            <span className="ba-when">With Lookthrough</span>
            <span className="ba-mark"><i aria-hidden>✓</i>{st.afterV}</span>
            <p>{st.after}</p>
            {st.afterFig ? <span className="ba-fig mono">{st.afterFig}</span> : null}
          </div>
        </Reveal>
      ))}
      {ex?.direct6 && ex.entitlement6 ? (
        <Reveal y={32} delay={0.6} className="ba-foot">
          <div className="ba-out before">
            <div className="v num">{shares(ex.direct6, 2, 2)}</div>
            <div className="note">share equivalents a wallet scan can pay and poll</div>
          </div>
          <div className="ba-arrow" aria-hidden>→</div>
          <div className="ba-out after">
            <div className="v num">{shares(ex.entitlement6, 2, 2)}</div>
            <div className="note">share equivalents resolved for the same wallet at the same slot{ex.raydium6 && ex.kamino6 ? `, including ${shares(ex.raydium6, 2, 2)} in a Raydium pool and ${shares(ex.kamino6, 2, 2)} in a Kamino reserve` : ""}</div>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
