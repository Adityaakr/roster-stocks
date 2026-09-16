"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CountUp, MountReveal, PixelReveal, Reveal, Roll, ScrollColorText, SlideIn, Ticker, WordReveal } from "@/components/motion";
import { slotLabel, usdc, short } from "@/lib/format";
import type { LandingData } from "@/lib/landing-data";
import { Quadrant } from "./false-choice";
import { Statements } from "./statements";
import { SOURCES } from "./evidence";

/*
 * The Aoutive home page, section by section, carrying Lookthrough's content.
 *   Hero: word reveal headline (0.6 s, 0.05 s per word) and sub (1 s, 0.03 s), buttons at 2.0 s and 2.1 s,
 *         image wrap at 2.8 s with a 24-cell pixel mask reveal over 3 s.
 *   Brand: info text fades up on view; the logo row is a ticker at 50 px/s that slows to 40% on hover.
 *   Workflow: headline colours in on scroll; four cards fade up at 0, 0.1, 0.2, 0.3 s; clicking a card swaps the
 *         image on the right with a 0.3 s linear tween; the active card is white with a hairline.
 *   Automation: accordion on the left, image on the right; the open item cycles every 6 s; spring 0.6 s.
 *   Use cases: the two large cards slide in from the centre (x ±290, spring 300/100); the three below fade up in sequence.
 *   Counters: four cells counting up on view, staggered 0.1 s.
 *   Connect: centred headline, image with the pixel mask reveal, faint background image.
 *   Plans: three hairline columns fading up at 0, 0.1, 0.2 s.
 *   FAQ: headline left, boxed accordion right where one item is open at a time (0.3 s linear).
 *   CTA: headline with a line ornament, two buttons, image fading up.
 */

const SPRING = { type: "spring" as const, stiffness: 150, damping: 40, mass: 1 };

const IMG = {
  hero: "/frames/portfolio.png",
  workflow: ["/frames/portfolio.png", "/frames/issuer.png", "/frames/record.png", "/frames/portfolio.png"],
  automation: ["/aoutive/QbCOVGfCL21W0VXtNMMoSwdjOk.png", "/aoutive/JxyvacmwE8hZAAS5I8LvRTYsu8.png", "/aoutive/5Xi1KCo3xdL82dvk75yFosDI.png", "/aoutive/DydoHmFv2FmmV0kG7IZvyqvYQm0.png", "/aoutive/XWsRDRkwSEmluDnNCmDwEzrIkU.png"],
  useCases: ["/aoutive/IH77vpjK4bEC40D5KrSNGrKMM8A.png", "/aoutive/JhzjfMCb4pTovJAZSF95bpUJvw8.png", "/aoutive/jJ0AC4e7s3kkCRTuWq0xdrQ7rO8.png", "/aoutive/kcJjJbJtWmFGA4Ht2pbmc8wGLOE.png", "/aoutive/QBir57op4jgYTYLJkPiDOgvxxI.png"],
  connect: "/aoutive/1PnsIMz1CFlUkoJef3aMjEI8gI0.png",
  connectBg: "/aoutive/6vPEjmr5mSVqv6nCvhHqm3RCVo.png",
  cta: "/aoutive/6qUQoa6uH77wIPi00YA7UqCKdA.png"
};

/** Section wrapper: the 1224 container with left and right hairlines and corner ticks, as every reference section has. */
function Sec({ id, children, className, style, ticks = true }: { id?: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; ticks?: boolean }) {
  return (
    <section id={id} className={`asec ${className ?? ""}`} style={style}>
      <div className="acontainer">
        {ticks ? <><span className="tick tl" aria-hidden /><span className="tick tr" aria-hidden /><span className="tick bl" aria-hidden /><span className="tick br" aria-hidden /></> : null}
        {children}
      </div>
    </section>
  );
}

/* 1. Hero */
export function HeroAoutive() {
  return (
    <Sec id="hero" className="hero">
      <div style={{ padding: "80px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40, overflow: "clip" }}>
          <div style={{ maxWidth: 673, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <WordReveal as="h1" text="The pool got your dividend." className="display" delay={0.6} stagger={0.05} style={{ textAlign: "center" }} />
            <WordReveal as="p" text="You put a tokenized stock into DeFi. On the record date, the company looked up the shareholder and found a smart contract. Lookthrough finds the person behind the program, proves it with one root on Solana, and pays and polls them where their shares sit. Nothing has to move." className="body" delay={1} stagger={0.03} style={{ textAlign: "center", maxWidth: 635 }} />
          </div>
          <div className="btnrow" style={{ justifyContent: "center", gap: 10 }}>
            <MountReveal delay={2} y={20}><a href="#check" className="btn primary"><Roll>Check a wallet</Roll></a></MountReveal>
            <MountReveal delay={2.1} y={20}><a href="#works" className="btn secondary"><span className="play" aria-hidden /><Roll>How it works</Roll></a></MountReveal>
          </div>
        </div>
        <MountReveal delay={2.8} y={60} style={{ width: "100%" }}>
          <div style={{ width: "100%", aspectRatio: "1.89", overflow: "clip" }}>
            <PixelReveal src={IMG.hero} alt="The Lookthrough portfolio: a wallet's positions in Raydium CLMM and Kamino Lend resolved to share equivalents" cols={24} rows={13} duration={3} className="fullimg" />
          </div>
        </MountReveal>
      </div>
    </Sec>
  );
}

/* 2. Brand strip */
export function BrandStrip() {
  const names: [string, string][] = [["Research Policy", SOURCES.malinova], ["Securities Transfer Association", SOURCES.sta], ["SEC", SOURCES.secTa], ["DTCC", SOURCES.dtccNoAction], ["a16z crypto", SOURCES.a16zRwa], ["Sentora", SOURCES.sentora], ["Broadridge", SOURCES.broadridge], ["Continental Stock Transfer", SOURCES.cstt]];
  return (
    <Sec id="brands" className="brands" ticks={false}>
      <div style={{ padding: "66px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 40, overflow: "hidden", position: "relative" }}>
        <Reveal y={15} style={{ width: "100%" }}><p className="body" style={{ margin: 0, textAlign: "left", color: "var(--ink-2)" }}>Named in the record this year by</p></Reveal>
        <div className="brandbg" aria-hidden />
        <div className="brandwrap">
          <Ticker velocity={50} hoverModifier={40} gap={48}>
            {names.map(([n, href]) => (
              <a key={n} href={href} target="_blank" rel="noreferrer" className="brand">{n}</a>
            ))}
          </Ticker>
        </div>
      </div>
    </Sec>
  );
}

/* 3. Workflow: tab cards and a swapping image */
export function WorkflowTabs({ data }: { data: LandingData }) {
  const l = data.latest;
  const ex = data.example;
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const steps = [
    { t: "Holders opt in", d: "One signature registers a wallet for corporate actions on a mint. Public, no identity, no KYC.", art: `Registration PDA [reg, mint, wallet] · slot ${ex?.registeredAtSlot ? slotLabel(ex.registeredAtSlot) : "pending"}` },
    { t: "The resolver snapshots", d: "Every token account attributed once at the record slot: wallets, then pool and vault positions by rule.", art: l ? `snapshot.json · attributed ${l.attributedPct}% · unattributed ${l.unattributedPct}% · double counted 0` : "snapshot.json pending" },
    { t: "Only the root goes on-chain", d: "A Merkle root, a content hash and the slot. The entitlement file stays public for anyone to recompute.", art: l ? `root ${l.root.slice(0, 8)}…${l.root.slice(-4)} · content ${l.contentHash.slice(0, 6)}…${l.contentHash.slice(-4)} · slot ${slotLabel(l.slotActual)}` : "root pending" },
    { t: "Holders claim or vote", d: "A proof unlocks the distribution or the weighted vote. Positions never move.", art: ex?.claim ? `claim ${usdc(ex.claim.amountPaid)} USDC · tx ${ex.claim.signature ? short(ex.claim.signature, 4) : slotLabel(ex.claim.slot)}` : "claim pending" }
  ];
  return (
    <Sec id="works" className="works">
      <div className="two" style={{ display: "grid", gridTemplateColumns: "minmax(0, 586px) minmax(0, 512px)", justifyContent: "space-between", gap: 90, padding: "80px 30px", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 70 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <ScrollColorText as="h2" text="Four steps from pool to payout." className="h-section" style={{ maxWidth: 526 }} />
            <Reveal y={20} delay={0.1}><p className="body" style={{ margin: 0, maxWidth: 586 }}>Lookthrough runs every record date through one resolver. It reads program-owned accounts, attributes them under the issuer&apos;s rules, and settles claims and votes on-chain, so holders take part without leaving a pool.</p></Reveal>
          </div>
          <div className="wcards" role="tablist" aria-label="How it works">
            {steps.map((st, j) => (
              <Reveal key={st.t} y={40} delay={j * 0.1}>
                <button role="tab" aria-selected={i === j} className={`wcard ${i === j ? "active" : ""}`} onClick={() => setI(j)}>
                  <div className="t">{st.t}</div>
                  <div className="d">{st.d}</div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
        <div className="wimages">
          <AnimatePresence initial={false} mode="wait">
            <motion.div key={i} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "linear" }} style={{ position: "relative" }}>
              <Image src={IMG.workflow[i] ?? IMG.hero} alt={steps[i]?.t ?? ""} width={1040} height={780} unoptimized style={{ width: "100%", height: 400, objectFit: "cover", objectPosition: "top left", display: "block" }} />
              <div className="artline mono">{steps[i]?.art}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <style>{`@media (max-width: 809px) { .works .two { grid-template-columns: minmax(0, 1fr) !important; gap: 40px !important; padding: 56px 18px !important; } }`}</style>
    </Sec>
  );
}

/* 4. Automation: accordion + image, auto-cycling every 6 s */
const CHOICES: { t: string; d: string }[] = [
  { t: "Third-party wrappers", d: "xStocks, Ondo, Robinhood. Tracker certificates or custodial claims, freely usable in DeFi, with no shareholder rights or a preference the issuer may consider. Inside a pool, the record date sees the pool." },
  { t: "Issuer-sponsored shares", d: "Superstate, Securitize, Figure. The share itself, on a transfer agent's register. Full rights from a recognised wallet, and invisible to the register the moment it enters a program." },
  { t: "DTC tokenized entitlements", d: "The DTC service, second half of 2026. Depository entitlements on approved chains, transfers restricted to registered wallets. Rights intact, DeFi excluded by design." },
  { t: "The 1973 look-through", d: "Immobilised shares tracked through intermediaries so a holder in street name still gets the dividend and the proxy. Tokenized stocks reproduced the immobilisation and skipped the look-through." },
  { t: "Lookthrough", d: "A look-through register for any rights-bearing share, wherever it sits. The record date sees the person behind the program, attributed once under the issuer's rule, with a Merkle root anyone can recompute." }
];

export function ChoiceAccordion() {
  const [open, setOpen] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (paused || reduce) return;
    const t = setInterval(() => setOpen((o) => (o + 1) % CHOICES.length), 6000);
    return () => clearInterval(t);
  }, [paused, reduce]);
  return (
    <Sec id="choice" className="automation" ticks={false}>
      <div style={{ padding: "80px 0", display: "flex", flexDirection: "column", gap: 50 }}>
        <div style={{ padding: "0 30px", display: "flex", flexDirection: "column", gap: 20 }}>
          <ScrollColorText as="h2" text="Rights, or composability. Nobody should have to pick." className="h-section" style={{ maxWidth: 896 }} />
          <Reveal y={0} delay={0.2}><p className="body" style={{ margin: 0, maxWidth: 796 }}>Three ways exist to put a stock on a blockchain today, and all three make the holder choose. Lookthrough is the fourth: rights-bearing shares, freely composable, with a register that can see through the program to the person.</p></Reveal>
        </div>
        <Reveal y={48}>
          <div className="atab" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="acards">
              {CHOICES.map((c, j) => (
                <div key={c.t} className={`acard ${open === j ? "active" : ""}`}>
                  <button aria-expanded={open === j} onClick={() => { setOpen(j); setPaused(true); }}>{c.t}</button>
                  <AnimatePresence initial={false}>
                    {open === j ? (
                      <motion.p key="body" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}>{c.d}</motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
              ))}
            </div>
            <div className="aimage">
              <AnimatePresence initial={false} mode="wait">
                <motion.div key={open} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ ...SPRING, duration: 0.6 }}>
                  {open === CHOICES.length - 1 ? (
                    <div style={{ padding: 8 }}><Quadrant /></div>
                  ) : (
                    <Image src={IMG.automation[open] ?? IMG.automation[0]!} alt="" width={738} height={433} unoptimized style={{ width: "100%", height: "auto", display: "block" }} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </Sec>
  );
}

/* 5. Use cases: 2 + 3 cards */
export function UseCases() {
  const cards = [
    { t: "Cash distributions", d: "USDC per share equivalent, paid to every registered holder in the tree with a proof, including the weight that sits in pools and vaults.", img: IMG.useCases[0]!, big: true },
    { t: "Shareholder votes", d: "Weighted by the same tree. The program checks registration, inclusion and single use, and the tally is on-chain state.", img: IMG.useCases[1]!, big: true },
    { t: "Corporate events", d: "Spin-offs, rights issues, tender offers and merger elections on the same root.", img: IMG.useCases[2]!, big: false },
    { t: "Pre-IPO conversion", d: "Pre-IPO tokens converting or paying out at the liquidity event, to holders behind the pools they trade in.", img: IMG.useCases[3]!, big: false },
    { t: "Payment in lieu and rewards", d: "Shares lent through a lending market paid in lieu; rewards that reach economic holders instead of wallet balances.", img: IMG.useCases[4]!, big: false }
  ];
  return (
    <Sec id="feature" className="usecases-sec">
      <div style={{ padding: "80px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 96 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
          <Reveal y={18} style={{ width: "100%" }}><p className="body" style={{ margin: 0, textAlign: "center", color: "var(--ink-2)" }}>What this unlocks</p></Reveal>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <ScrollColorText as="h2" text="Everything the multiplier can't do." className="h-section" style={{ maxWidth: 801, textAlign: "center" }} />
            <Reveal y={18} delay={0.2}><p className="body" style={{ margin: 0, maxWidth: 658, textAlign: "center" }}>Rebasing dividends and splits already reach pool-held tokens through the mint multiplier. Everything else needs to know who the holder is.</p></Reveal>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          <div className="ucrow">
            {cards.filter((c) => c.big).map((c, j) => (
              <SlideIn key={c.t} x={j === 0 ? 290 : -290}>
                <div className="ucard big">
                  <div className="img"><Image src={c.img} alt="" width={1000} height={529} unoptimized style={{ width: "100%", height: 263, objectFit: "contain", display: "block" }} /></div>
                  <div className="t">{c.t}</div>
                  <div className="d">{c.d}</div>
                </div>
              </SlideIn>
            ))}
          </div>
          <div className="ucrow three">
            {cards.filter((c) => !c.big).map((c, j) => (
              <Reveal key={c.t} y={40} delay={0.2 + j * 0.1} className="ucard">
                <div className="img"><Image src={c.img} alt="" width={640} height={529} unoptimized style={{ width: "100%", height: 263, objectFit: "contain", display: "block" }} /></div>
                <div className="t">{c.t}</div>
                <div className="d">{c.d}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Sec>
  );
}

/* 6. Counters */
export function Counters({ data }: { data: LandingData }) {
  const items: [string, string][] = [
    [data.spy ? `${data.spy.programHeldPct}%` : "n/a", data.spy ? `of SPYx held by programs at slot ${slotLabel(data.spy.slot)}` : "of SPYx held by programs"],
    [data.spy ? data.spy.accountsScanned.toLocaleString("en-US") : "n/a", "token accounts read, not estimated"],
    [data.latest ? `${data.latest.attributedPct}%` : "n/a", data.latest ? `attributed at record slot ${slotLabel(data.latest.slotActual)}` : "attributed at the latest record"],
    ["$58B", "a year processing US corporate actions"]
  ];
  return (
    <Sec id="number" className="integration" ticks={false}>
      <div className="ibox">
        <div style={{ padding: "80px 0", display: "flex", justifyContent: "center" }}>
          <ScrollColorText as="h2" text="Measured, not estimated." className="h-section" style={{ textAlign: "center" }} />
        </div>
        <div className="counters">
          {items.map(([v, t], j) => (
            <Reveal key={t} y={26} delay={j * 0.1} className="counter">
              <div className="v"><CountUp value={v} /></div>
              <div className="t">{t}</div>
              <span className="tick bl" aria-hidden /><span className="tick br" aria-hidden />
            </Reveal>
          ))}
        </div>
      </div>
    </Sec>
  );
}

/* 7. Connect: statements with a pixel-revealed image behind the headline */
export function Connect({ data }: { data: LandingData }) {
  return (
    <Sec id="problem" className="connect">
      <div style={{ padding: "80px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 85, position: "relative" }}>
        <Image src={IMG.connectBg} alt="" width={1224} height={891} unoptimized aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.9, pointerEvents: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", position: "relative" }}>
          <Reveal y={18} style={{ width: "100%" }}><p className="body" style={{ margin: 0, color: "var(--ink-2)", textAlign: "center" }}>The problem, told the way it happens</p></Reveal>
          <ScrollColorText as="h2" text="Two statements, one dividend." className="h-section" style={{ maxWidth: 697, textAlign: "center" }} />
        </div>
        <Reveal y={48} style={{ width: "100%", maxWidth: 1110, position: "relative" }}>
          <div style={{ background: "#fff", border: "1px solid var(--line)", padding: 24 }}><Statements data={data} /></div>
        </Reveal>
      </div>
    </Sec>
  );
}

/* 8. Plans */
export function Plans({ data }: { data: LandingData }) {
  const slot = data.latest ? slotLabel(data.latest.slotActual) : "pending";
  const plans = [
    { t: "Issuers and transfer agents", d: "A record-date process that survives composability: who is entitled, with proof, without asking anyone to leave a pool.", price: slot, unit: "latest record slot", sub: "session-aware record dates", cta: "Run a record date", href: "/issuer", items: ["Snapshot with live supply invariants", "Certificate: root, content hash, slot", "Claims and tallies from program state", "Entitlement file anyone can recompute", "Adapters for pools and vaults"] },
    { t: "Holders", tag: "Start here", d: "Register once. Be paid and polled on all of your shares, not the fraction that happens to sit in your wallet.", price: data.example?.entitlement6 ? (BigInt(data.example.entitlement6) / 1_000_000n).toString() : "100", unit: "shares counted", sub: `not the ${data.example?.direct6 ? (BigInt(data.example.direct6) / 1_000_000n).toString() : "25"} in the wallet`, cta: "Open portfolio", href: "/portfolio", items: ["Wallet, pool and reserve positions in one ledger", "One signature to register", "Claim and vote with a proof", "Proof verified in the browser", "Rights profile per wrapper"], primary: true },
    { t: "Protocols and wallets", d: "An open adapter interface. A lending market keeps its depositors enfranchised. A wallet with its own voting rail reads the same tree.", price: "1", unit: "function to implement", sub: "discoverContainers and resolve", cta: "Read the interface", href: "/adapters", items: ["Raydium CLMM and Kamino Lend today", "Declared adapters with status", "Unattributed supply named, never hidden", "Rights-preserving as a feature", "Open source"] }
  ];
  return (
    <Sec id="pricing" className="plans-sec">
      <div style={{ padding: "100px 0 0", display: "flex", flexDirection: "column", gap: 75 }}>
        <div className="two" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "0 30px" }}>
          <ScrollColorText as="h2" text="Built for issuers, holders and protocols." className="h-section" style={{ maxWidth: 500 }} />
          <Reveal y={18} delay={0.1}><p className="body" style={{ margin: 0, maxWidth: 392 }}>Priced the way the incumbents already price it: per corporate action, per position, plus a feed for the rails that read the same tree.</p></Reveal>
        </div>
        <div className="plans">
          {plans.map((p, j) => (
            <Reveal key={p.t} y={48} delay={j * 0.1} className="plan">
              <div className="head">
                <div className="flex items-center justify-between gap-3"><div className="t">{p.t}</div>{p.tag ? <span className="ptag">{p.tag}</span> : null}</div>
                <div className="d">{p.d}</div>
              </div>
              <div className="mid">
                <div className="price">{p.price}<small>/ {p.unit}</small></div>
                <div className="d" style={{ marginTop: 0 }}>{p.sub}</div>
                <Link href={p.href} className={`btn ${p.primary ? "primary" : "secondary"} wide`}><Roll>{p.cta}</Roll><span className="arrow" aria-hidden>→</span></Link>
              </div>
              <div className="list">
                <div className="t" style={{ fontSize: 18 }}>What&apos;s included:</div>
                <ul>{p.items.map((it) => <li key={it}><i>✓</i>{it}</li>)}</ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Sec>
  );
}

/* 9. FAQ */
const QA: [string, string][] = [
  ["Does Lookthrough decide who legally owns a share?", "No. It computes issuer-defined entitlements across onchain positions and proves the result. Who legally holds dividend or voting rights depends on the instrument's terms, the issuer, the transfer agent, the jurisdiction, and what happened to the security through lending or other contracts. The issuer sets the rules; Lookthrough applies them and publishes the proof."],
  ["Isn't this what Broadridge and Ondo already do?", "They count wallets. A share deposited into a pool or a vault leaves the wallet, and their rail loses it. Lookthrough is the layer that follows the share into the program and hands the entitlement back to the same rails. It is built to feed them, not to replace them."],
  ["Why not just ask holders to withdraw before the record date?", "Because it drains liquidity from every pool on every record date, costs every holder a transaction, and rewards the people who forgot with nothing. The research on tokenized equity calls the approach impractical. A register that can see into programs is the alternative."],
  ["What happens to supply the resolver cannot attribute?", "It is counted, named by the program that holds it, and excluded from entitlements. Every certificate shows attributed and unattributed percentages, and a record cannot be published unless attributed plus unattributed equals the supply held in token accounts."],
  ["Which DeFi positions are looked through today?", "Direct Token-2022 balances, Raydium CLMM positions and Kamino Lend deposits, each with its own rule. Further adapters are declared on the Adapters page with program IDs and status. Any protocol can add one; the interface is a single resolve function that returns attributed positions."],
  ["Can I use it with my own wallet?", "Yes. Paste a wallet into the check to see what a scan misses, or connect to register, claim and vote on any open record. Registration, claims and votes are transactions on the network shown in the masthead."]
];

export function FaqAoutive() {
  const [open, setOpen] = useState(0);
  const reduce = useReducedMotion();
  return (
    <Sec id="questions" className="faq-sec" ticks={false}>
      <div className="two" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "100px 30px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 388 }}>
          <ScrollColorText as="h2" text="Your questions answered" className="h-section" />
          <Reveal y={18} delay={0.1}><p className="body" style={{ margin: 0 }}>What Lookthrough determines, what the issuer determines, and what nobody here does.</p></Reveal>
        </div>
        <Reveal y={40} delay={0.3} style={{ width: "100%", maxWidth: 660 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {QA.map(([q, a], j) => (
              <div key={q} className={`fcard ${open === j ? "open" : ""}`}>
                <button aria-expanded={open === j} onClick={() => setOpen(open === j ? -1 : j)}>
                  <span>{q}</span>
                  <span className="pm" aria-hidden>{open === j ? "−" : "+"}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open === j ? (
                    <motion.p key="a" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "linear" }}>{a}</motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Sec>
  );
}

/* 10. CTA */
export function CtaAoutive() {
  return (
    <Sec id="cta" className="cta-sec">
      <div className="ctabox">
        <div className="ctatext">
          <svg className="ctaline" viewBox="0 0 768 95" aria-hidden><path d="M0 94.5H768" stroke="var(--line)" /><path d="M120 94.5 120 40 M 380 94.5 380 20 M 640 94.5 640 60" stroke="var(--line)" /></svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 40, padding: "0 0 0 30px", maxWidth: 492 }}>
            <ScrollColorText as="h2" text="Moves like a token. Pays like a stock." className="h-section" style={{ maxWidth: 500 }} />
            <div className="btnrow" style={{ gap: 16 }}>
              <Reveal y={20}><a href="#check" className="btn primary"><Roll>Check a wallet</Roll></a></Reveal>
              <Reveal y={20} delay={0.1}><Link href="/issuer" className="btn secondary"><Roll>Issuer console</Roll></Link></Reveal>
            </div>
          </div>
        </div>
        <div className="ctaimg">
          <Reveal y={40}><Image src={IMG.cta} alt="" width={548} height={330} unoptimized style={{ width: "100%", height: "auto", display: "block" }} /></Reveal>
        </div>
      </div>
    </Sec>
  );
}
