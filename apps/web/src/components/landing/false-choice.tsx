"use client";

import { motion, useReducedMotion } from "motion/react";

const DOTS = [
  { id: "wrappers", x: 0.9, y: 0.18, name: "Third-party wrappers", sub: "xStocks, Ondo, Robinhood", anchor: "end" as const, dy: -1 },
  { id: "issuer", x: 0.42, y: 0.66, name: "Issuer-sponsored shares", sub: "Superstate, Securitize, Figure", anchor: "start" as const, dy: 1 },
  { id: "dtc", x: 0.1, y: 0.9, name: "DTC tokenized entitlements", sub: "DTC service, H2 2026", anchor: "start" as const, dy: 1 },
  { id: "lookthrough", x: 0.9, y: 0.9, name: "Lookthrough", sub: "rights-bearing shares, anywhere a token can go", anchor: "end" as const, dy: -1 }
];

/** The 2x2: composability across, rights up; three incumbents and Lookthrough in the top-right, drawn last. */
export function Quadrant() {
  const reduce = useReducedMotion();
  const W = 720;
  const H = 420;
  const pad = { l: 40, r: 24, t: 24, b: 56 };
  const px = (x: number) => pad.l + x * (W - pad.l - pad.r);
  const py = (y: number) => H - pad.b - y * (H - pad.t - pad.b);
  const lt = DOTS[3]!;
  const enter = (i: number) => (reduce ? {} : { initial: { opacity: 0, scale: 0.6 }, whileInView: { opacity: 1, scale: 1 }, viewport: { once: true, amount: 0.5 }, transition: { duration: 0.22, ease: [0.2, 0, 0, 1] as const, delay: 0.1 + i * 0.16 } });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="quad-title quad-desc" style={{ width: "100%", height: "auto", display: "block", maxWidth: 760 }}>
      <title id="quad-title">Rights against composability</title>
      <desc id="quad-desc">Third-party wrappers are composable with few rights. Issuer-sponsored shares and DTC entitlements carry rights but restrict where the token can go. Lookthrough sits in the top right: full rights, anywhere a token can go.</desc>
      <line x1={pad.l} y1={py(0)} x2={W - pad.r} y2={py(0)} stroke="var(--line-strong)" strokeWidth="1" />
      <line x1={pad.l} y1={py(0)} x2={pad.l} y2={pad.t} stroke="var(--line-strong)" strokeWidth="1" />
      <text className="axis" x={pad.l} y={H - 34}>REGISTERED WALLETS ONLY</text>
      <text className="axis" x={W - pad.r} y={H - 34} textAnchor="end">ANYWHERE A TOKEN CAN GO</text>
      <text className="axis" x={(pad.l + W - pad.r) / 2} y={H - 12} textAnchor="middle">COMPOSABILITY</text>
      <text className="axis" x={pad.l + 8} y={pad.t + 10}>FULL SHAREHOLDER RIGHTS</text>
      <text className="axis" x={pad.l + 8} y={py(0) - 8}>PRICE EXPOSURE ONLY</text>
      <text className="axis" transform={`translate(${pad.l - 20} ${(pad.t + py(0)) / 2}) rotate(-90)`} textAnchor="middle">RIGHTS</text>
      {DOTS.slice(0, 3).map((d, i) => (
        <motion.line key={`gap-${d.id}`} x1={px(d.x)} y1={py(d.y)} x2={px(lt.x)} y2={py(lt.y)} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 5" {...(reduce ? {} : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true, amount: 0.5 }, transition: { duration: 0.5, delay: 0.7 + i * 0.1 } })} />
      ))}
      {DOTS.map((d, i) => (
        <motion.g key={d.id} tabIndex={0} role="img" aria-label={`${d.name}: ${d.sub}`} style={{ outline: "none", transformOrigin: `${px(d.x)}px ${py(d.y)}px` }} {...enter(i)}>
          <circle cx={px(d.x)} cy={py(d.y)} r={d.id === "lookthrough" ? 7 : 5} fill={d.id === "lookthrough" ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" strokeWidth="1.2" />
          <text className="dotlabel" x={px(d.x) + (d.anchor === "end" ? -14 : 14)} y={py(d.y) + (d.dy < 0 ? -10 : 18)} textAnchor={d.anchor} fill={d.id === "lookthrough" ? "var(--accent)" : "var(--ink)"}>{d.name}</text>
          <text className="dotsub" x={px(d.x) + (d.anchor === "end" ? -14 : 14)} y={py(d.y) + (d.dy < 0 ? 8 : 34)} textAnchor={d.anchor}>{d.sub}</text>
        </motion.g>
      ))}
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

/** The four-column table; the fourth column is the only element that uses both the surface and the accent. Stacks at phone width with Lookthrough first. */
export function FourColumns() {
  return (
    <div>
      <div className="fc-table scroll-x">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, lineHeight: "21px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontWeight: 400, color: "var(--slate)", padding: "0 12px 10px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }} />
              {HEADS.map((h, i) => (
                <th key={h} style={{ textAlign: "left", fontWeight: 500, color: i === 3 ? "var(--accent)" : "var(--ink)", padding: "10px 12px", borderBottom: "1px solid var(--line)", borderTop: i === 3 ? "2px solid var(--accent)" : "1px solid transparent", background: i === 3 ? "var(--surface)" : "transparent", fontSize: 14 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]}>
                <td style={{ padding: "10px 12px 10px 0", borderBottom: "1px solid var(--line)", color: "var(--slate)", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "top" }}>{r[0]}</td>
                {r.slice(1).map((c, i) => (
                  <td key={i} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", color: i === 3 ? "var(--ink)" : "var(--ink-2)", background: i === 3 ? "var(--surface)" : "transparent", verticalAlign: "top" }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fc-stack">
        {[3, 0, 1, 2].map((ci) => (
          <div key={ci} style={{ border: "1px solid var(--line)", borderTop: ci === 3 ? "2px solid var(--accent)" : "1px solid var(--line)", background: ci === 3 ? "var(--surface)" : "transparent", padding: 16, marginBottom: 12 }}>
            <div className="h-item" style={{ color: ci === 3 ? "var(--accent)" : "var(--ink)" }}>{HEADS[ci]}</div>
            <dl className="kv" style={{ marginTop: 10, gridTemplateColumns: "1fr", gap: "4px 0" }}>
              {ROWS.map((r) => (
                <div key={r[0]} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                  <dt style={{ fontSize: 12 }}>{r[0]}</dt>
                  <dd style={{ textAlign: "left", whiteSpace: "normal", color: "var(--ink-2)", fontSize: 14 }}>{r[ci + 1]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <style>{`.fc-stack{display:none}@media (max-width:809px){.fc-table{display:none}.fc-stack{display:block}}`}</style>
    </div>
  );
}
