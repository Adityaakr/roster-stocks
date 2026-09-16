"use client";

import { motion, useReducedMotion } from "motion/react";

const DOTS = [
  { id: "wrappers", x: 0.86, y: 0.16, name: "Third-party wrappers", sub: "xStocks, Ondo, Robinhood", side: "left" as const },
  { id: "issuer", x: 0.3, y: 0.66, name: "Issuer-sponsored shares", sub: "Superstate, Securitize, Figure", side: "right" as const },
  { id: "dtc", x: 0.1, y: 0.92, name: "DTC tokenized entitlements", sub: "DTC service, H2 2026", side: "right" as const },
  { id: "lookthrough", x: 0.86, y: 0.78, name: "Lookthrough", sub: "rights-bearing shares, anywhere a token can go", side: "left" as const }
];

/** The 2x2: composability across, rights up. Three incumbents each miss a quadrant; Lookthrough sits in the shaded one. */
export function Quadrant() {
  const reduce = useReducedMotion();
  const W = 720;
  const H = 470;
  const pad = { l: 150, r: 28, t: 44, b: 70 };
  const px = (x: number) => pad.l + x * (W - pad.l - pad.r);
  const py = (y: number) => H - pad.b - y * (H - pad.t - pad.b);
  const lt = DOTS[3]!;
  const midX = px(0.5);
  const midY = py(0.5);
  const enter = (i: number) => (reduce ? {} : { initial: { opacity: 0, scale: 0.6 }, whileInView: { opacity: 1, scale: 1 }, viewport: { once: true, amount: 0.5 }, transition: { duration: 0.22, ease: [0.2, 0, 0, 1] as const, delay: 0.1 + i * 0.16 } });
  const label = (d: (typeof DOTS)[number]) => {
    const dir = d.side === "left" ? -1 : 1;
    const x = px(d.x) + dir * 16;
    return { x, anchor: d.side === "left" ? ("end" as const) : ("start" as const) };
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="quad-title quad-desc" style={{ width: "100%", height: "auto", display: "block" }}>
      <title id="quad-title">Rights against composability</title>
      <desc id="quad-desc">Third-party wrappers are composable with few rights. Issuer-sponsored shares and DTC entitlements carry rights but restrict where the token can go. Lookthrough sits in the top right: full rights, anywhere a token can go.</desc>
      {/* the quadrant Lookthrough fills */}
      <rect x={midX} y={pad.t} width={W - pad.r - midX} height={midY - pad.t} fill="var(--surface)" />
      {/* plot frame and midlines */}
      <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="none" stroke="var(--line)" strokeWidth="1" />
      <line x1={midX} x2={midX} y1={pad.t} y2={H - pad.b} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
      <line x1={pad.l} x2={W - pad.r} y1={midY} y2={midY} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
      {/* quadrant captions */}
      <text className="quad-cap" x={midX + 14} y={pad.t + 20}>Rights and composability</text>
      <text className="quad-cap" x={pad.l + 14} y={midY - 12}>Rights, no DeFi</text>
      <text className="quad-cap" x={midX + 14} y={H - pad.b - 12}>DeFi, no rights</text>
      {/* axes */}
      <text className="axis" x={pad.l} y={H - pad.b + 24}>REGISTERED WALLETS ONLY</text>
      <text className="axis" x={W - pad.r} y={H - pad.b + 24} textAnchor="end">ANYWHERE A TOKEN CAN GO</text>
      <text className="axis" x={(pad.l + W - pad.r) / 2} y={H - 14} textAnchor="middle">COMPOSABILITY →</text>
      <text className="axis" x={pad.l - 14} y={pad.t + 14} textAnchor="end">FULL SHAREHOLDER</text>
      <text className="axis" x={pad.l - 14} y={pad.t + 28} textAnchor="end">RIGHTS</text>
      <text className="axis" x={pad.l - 14} y={H - pad.b - 4} textAnchor="end">PRICE EXPOSURE ONLY</text>
      <text className="axis" transform={`translate(${pad.l - 14} ${(pad.t + py(0)) / 2}) rotate(-90)`} textAnchor="middle">RIGHTS ↑</text>
      {/* the gap each incumbent leaves */}
      {DOTS.slice(0, 3).map((d, i) => (
        <motion.line key={`gap-${d.id}`} x1={px(d.x)} y1={py(d.y)} x2={px(lt.x)} y2={py(lt.y)} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 5" {...(reduce ? {} : { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true, amount: 0.5 }, transition: { duration: 0.4, delay: 0.7 + i * 0.1 } })} />
      ))}
      {DOTS.map((d, i) => {
        const l = label(d);
        const us = d.id === "lookthrough";
        return (
          <motion.g key={d.id} tabIndex={0} role="img" aria-label={`${d.name}: ${d.sub}`} style={{ outline: "none", transformOrigin: `${px(d.x)}px ${py(d.y)}px` }} {...enter(i)}>
            {us ? <circle cx={px(d.x)} cy={py(d.y)} r="12" fill="none" stroke="var(--ink)" strokeOpacity="0.18" strokeWidth="1" /> : null}
            <circle cx={px(d.x)} cy={py(d.y)} r={us ? 6 : 5} fill={us ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" strokeWidth="1.2" />
            <text className="dotlabel" x={l.x} y={py(d.y) - 4} textAnchor={l.anchor} fontWeight={us ? 600 : 500}>{d.name}</text>
            <text className="dotsub" x={l.x} y={py(d.y) + 14} textAnchor={l.anchor}>{d.sub}</text>
          </motion.g>
        );
      })}
    </svg>
  );
}

const ROWS: [string, string, string, string, string][] = [
  ["What it is", "Tracker certificates or custodial claims on a share", "The share itself, on a transfer agent's register", "Depository entitlements on approved chains, H2 2026", "A look-through register for any rights-bearing share, wherever it sits"],
  ["Examples", "xStocks, Ondo, Robinhood", "Superstate, Securitize, Figure", "DTC service", "Works on the second and third columns' shares"],
  ["Usable in DeFi", "Yes", "Where the issuer allows", "No, registered wallets only", "Yes: pools, vaults, baskets, anything with a program ID"],
  ["Voting", "None, or a preference the issuer may consider", "Yes, from a recognised wallet", "Yes, inside the depository", "Yes, with pool and vault weight counted"],
  ["Holder visible inside a pool", "No", "No", "Not applicable", "Yes, attributed once under the issuer's rule"],
  ["What a record date sees", "The pool", "The pool", "The nominee", "The person behind the program"],
  ["Proof", "None", "The register", "The depository", "A Merkle root anyone can recompute"]
];
const HEADS = ["Third-party wrappers", "Issuer-sponsored shares", "DTC tokenized entitlements", "Lookthrough"];

/** The four-column comparison; the Lookthrough column is white on the surface with an ink rule. Stacks at phone width with Lookthrough first. */
export function FourColumns() {
  return (
    <div>
      <div className="fc-table scroll-x">
        <table className="fctable">
          <thead>
            <tr>
              <th />
              {HEADS.map((h, i) => <th key={h} className={i === 3 ? "us" : ""}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]}>
                <th scope="row">{r[0]}</th>
                {r.slice(1).map((c, i) => <td key={i} className={i === 3 ? "us" : ""}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fc-stack">
        {[3, 0, 1, 2].map((ci) => (
          <div key={ci} className={`fcblock ${ci === 3 ? "us" : ""}`}>
            <div className="h-item">{HEADS[ci]}</div>
            {ROWS.map((r) => (
              <div key={r[0]} className="fcline"><span className="k">{r[0]}</span><span>{r[ci + 1]}</span></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
