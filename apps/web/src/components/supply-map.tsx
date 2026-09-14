"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export interface Segment {
  label: string;
  pct: number; // 0..100
  kind: "wallet" | "adapter" | "other";
}

const fills: Record<Segment["kind"], string> = {
  wallet: "var(--color-ink-3)",
  adapter: "var(--color-accent)",
  other: "var(--color-warn)"
};

/**
 * The landing page's one bold element: a single supply map bar that draws once per session, segment by segment,
 * then the "out of a wallet scan's sight" percentage counts up. Reduced motion renders the final state at once.
 */
export function SupplyMap({ segments, hiddenPct, symbol }: { segments: Segment[]; hiddenPct: number; symbol: string }) {
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(false);
  const [count, setCount] = useState(reduce ? hiddenPct : 0);

  useEffect(() => {
    // Runs once per session. React's dev StrictMode mounts twice, so the "seen" flag is set when the run completes,
    // and the cleanup cancels a run that was interrupted.
    let seen = false;
    try {
      seen = sessionStorage.getItem(`lt.supplymap.${symbol}`) === "1";
    } catch {
      seen = false;
    }
    setAnimated(true);
    if (reduce || seen) {
      setCount(hiddenPct);
      return;
    }
    let raf = 0;
    const t = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / 500);
        const eased = 1 - Math.pow(1 - k, 3);
        setCount(hiddenPct * eased);
        if (k < 1) raf = requestAnimationFrame(step);
        else {
          setCount(hiddenPct);
          try {
            sessionStorage.setItem(`lt.supplymap.${symbol}`, "1");
          } catch {
            // ignore
          }
        }
      };
      raf = requestAnimationFrame(step);
    }, 700);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [hiddenPct, reduce, symbol]);

  const drawDuration = 0.7;
  let offset = 0;

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="num display text-[44px] leading-none">{count.toFixed(2)}%</span>
        <span className="text-ink-2 text-[16px]">of {symbol} supply sits where a wallet scan cannot see it</span>
      </div>
      <div className="h-8 w-full rounded-[6px] overflow-hidden flex bg-line" role="img" aria-label={`Supply map for ${symbol}: ${segments.map((s) => `${s.label} ${s.pct.toFixed(2)} percent`).join(", ")}`}>
        {segments.map((s) => {
          const start = offset;
          offset += s.pct;
          const delay = (start / 100) * drawDuration;
          return (
            <motion.div
              key={s.label}
              initial={reduce ? false : { scaleX: 0 }}
              animate={animated ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: reduce ? 0 : (s.pct / 100) * drawDuration, delay: reduce ? 0 : delay, ease: "linear" }}
              style={{ width: `${s.pct}%`, background: fills[s.kind], transformOrigin: "left", minWidth: s.pct > 0 ? 2 : 0 }}
              title={`${s.label}: ${s.pct.toFixed(2)}%`}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: fills[s.kind] }} aria-hidden />
            {s.label} <span className="num text-ink">{s.pct.toFixed(2)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
