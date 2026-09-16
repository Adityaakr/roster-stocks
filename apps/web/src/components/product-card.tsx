"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { shares, usdc } from "@/lib/format";

interface Summary {
  live: boolean;
  reason?: string;
  wallet?: string;
  rows?: { source: string; label: string; shares6: string }[];
  walletVisibleShares6?: string;
  totalShares6?: string;
  distribution?: { id: string; amountPerShareMicro: string; entitlement: string | null; snapshotSlot: number | null; attributedPct: string | null } | null;
  vote?: { id: string; question: string | null; entitlement: string | null } | null;
  claimed?: string | null;
  voted?: { choice: string | null; weight: string } | null;
}

/**
 * The one screenshot: a wallet scanner next to Lookthrough, for a real wallet on the fork.
 * Numbers come from /api/demo/summary. When the fork is down the card says so and shows nothing invented.
 */
export function ProductCard() {
  const reduce = useReducedMotion();
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/demo/summary")
      .then((r) => r.json())
      .then((j: Summary) => setS(j))
      .catch(() => setS({ live: false, reason: "unreachable" }));
  }, []);

  const visible = s?.walletVisibleShares6 ? BigInt(s.walletVisibleShares6) : null;
  const total = s?.totalShares6 ? BigInt(s.totalShares6) : null;
  const recovered = visible !== null && total !== null ? total - visible : null;
  const ent = s?.distribution?.entitlement ? BigInt(s.distribution.entitlement) : total;
  const payout = s?.distribution && ent !== null ? (ent * BigInt(s.distribution.amountPerShareMicro)) / 1_000_000n : null;
  const fade = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + i * 0.12, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const } });

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between px-5 h-11 border-b border-line text-[13px] text-ink-2">
        <span>AAPLx record date{s?.distribution?.snapshotSlot ? <>, slot <span className="num text-ink">{s.distribution.snapshotSlot.toLocaleString("en-US")}</span></> : null}</span>
        <span className={`chip ${s?.live ? "chip-accent" : ""}`}>{s === null ? "Reading the fork" : s.live ? "Live on the fork" : "Fork offline, last run"}</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-line">
        <div className="p-5">
          <div className="text-[13px] text-ink-2">Wallet scanner</div>
          <div className="num display text-[44px] mt-2 leading-none">{visible !== null ? shares(visible, 2, 2) : "—"}</div>
          <div className="text-[13px] text-ink-3 mt-1">shares seen</div>
        </div>
        <div className="p-5">
          <div className="text-[13px] text-ink-2">Lookthrough</div>
          <div className="num display text-[44px] mt-2 leading-none text-accent">{total !== null ? shares(total, 2, 2) : "—"}</div>
          <div className="text-[13px] text-ink-3 mt-1">share equivalents</div>
        </div>
      </div>
      {s?.rows?.length ? (
        <ul className="border-t border-line text-[14px]">
          {s.rows.map((r, i) => (
            <motion.li key={`${r.source}-${i}`} {...fade(i)} className="flex justify-between px-5 h-10 items-center border-b border-line last:border-b-0">
              <span className="text-ink-2">{r.label}</span>
              <span className="num">{shares(r.shares6, 2, 2)}</span>
            </motion.li>
          ))}
        </ul>
      ) : null}
      <div className="px-5 py-4 border-t border-line flex flex-wrap items-center gap-3">
        {recovered !== null && recovered > 0n ? (
          <motion.span {...fade(4)} className="chip chip-accent">
            {shares(recovered, 2, 2)} shares recovered from DeFi positions
          </motion.span>
        ) : null}
        <span className="ml-auto flex gap-2">
          {payout !== null ? (
            <Link href="/holder?demo=1" className={`btn ${s?.claimed ? "" : "btn-accent"}`}>
              {s?.claimed ? `Claimed ${usdc(s.claimed)} USDC` : `Claim ${usdc(payout)} USDC`}
            </Link>
          ) : null}
          {s?.vote && ent !== null ? (
            <Link href="/holder?demo=1" className="btn">
              {s.voted ? `Voted ${s.voted.choice} with ${shares(s.voted.weight, 0, 0)} votes` : `Cast ${shares(ent, 0, 0)} votes`}
            </Link>
          ) : null}
        </span>
      </div>
      {s && !s.live ? (
        <div className="px-5 py-3 border-t border-line text-[13px] text-warn">
          {s.reason === "not seeded" ? "Demo wallets are not seeded. Run pnpm fork, pnpm anchor:deploy and pnpm seed." : "Couldn't reach the fork at 127.0.0.1:8899. Start it with pnpm fork. Figures above are from the last recorded run."}
        </div>
      ) : null}
    </div>
  );
}
