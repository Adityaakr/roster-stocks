"use client";

import { useMemo, useState } from "react";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

/** A plain SVG line chart with a hover readout. No library, no CDN: the data is small and the styling must match the page. */
export function LineChart({ candles, height = 260, fmt = (v: number) => `$${v.toFixed(2)}` }: { candles: Candle[]; height?: number; fmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const padX = 8;
  const padY = 14;
  const model = useMemo(() => {
    if (candles.length < 2) return null;
    const xs = candles.map((c) => c.time);
    const ys = candles.map((c) => c.close);
    const minX = xs[0] as number;
    const maxX = xs[xs.length - 1] as number;
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    if (maxY === minY) { maxY += 1; minY -= 1; }
    const pad = (maxY - minY) * 0.08;
    minY -= pad; maxY += pad;
    const sx = (t: number) => padX + ((t - minX) / (maxX - minX)) * (W - padX * 2);
    const sy = (v: number) => padY + (1 - (v - minY) / (maxY - minY)) * (H - padY * 2);
    const pts = candles.map((c) => [sx(c.time), sy(c.close)] as const);
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${d} L${(pts[pts.length - 1] as readonly [number, number])[0].toFixed(1)},${H - padY} L${(pts[0] as readonly [number, number])[0].toFixed(1)},${H - padY} Z`;
    const up = (ys[ys.length - 1] as number) >= (ys[0] as number);
    const ticks = [minY + pad, (minY + maxY) / 2, maxY - pad];
    return { pts, d, area, up, sy, ticks, minY, maxY };
  }, [candles, H]);

  if (!model) return <div className="msg">Not enough price data for this range.</div>;
  const color = model.up ? "var(--green)" : "var(--red)";
  const hv = hover !== null ? candles[hover] : null;
  const hp = hover !== null ? model.pts[hover] : null;

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Price chart"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bd = Infinity;
          model.pts.forEach(([px], i) => { const dd = Math.abs(px - x); if (dd < bd) { bd = dd; best = i; } });
          setHover(best);
        }}>
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {model.ticks.map((t) => (
          <line key={t} x1={padX} x2={W - padX} y1={model.sy(t)} y2={model.sy(t)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        ))}
        <path d={model.area} fill="url(#fill)" />
        <path d={model.d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {hp ? (
          <>
            <line x1={hp[0]} x2={hp[0]} y1={padY} y2={H - padY} stroke="rgba(255,255,255,0.25)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={hp[0]} cy={hp[1]} r="3.5" fill={color} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
      <div className="absolute left-2 top-1 small num">{fmt(model.maxY)}</div>
      <div className="absolute left-2 bottom-1 small num">{fmt(model.minY)}</div>
      {hv && hp ? (
        <div className="tip" style={{ left: `${(hp[0] / W) * 100}%`, top: `${(hp[1] / H) * 100}%`, marginTop: -10 }}>
          <div className="num" style={{ color: "var(--text)" }}>{fmt(hv.close)}</div>
          <div className="muted">{new Date(hv.time * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Tiny inline sparkline for cards. */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(" ");
  const up = (values[values.length - 1] as number) >= (values[0] as number);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="1.4" />
    </svg>
  );
}
