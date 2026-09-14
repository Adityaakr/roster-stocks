/**
 * Share-equivalent math. Entitlements are integers in fixed 6-decimal share units (1 share = 1_000_000).
 * raw (bigint) × multiplier (decimal string) / 10^decimals, floored. Never float arithmetic.
 */
import { Decimal } from "decimal.js";
import type { MultiplierInfo } from "./types";

export const SHARE_DECIMALS = 6;
export const SHARE_UNIT = 1_000_000n;

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_DOWN });

/**
 * Pick the effective multiplier from the scaled UI amount extension at a timestamp.
 * `newMultiplier` applies at or after `newMultiplierEffectiveTimestamp`, else `multiplier`.
 * Multipliers are passed as the JS number read from the extension; `String(n)` is the shortest
 * round-trip representation, so the decimal input reproduces the f64 exactly.
 */
export function effectiveMultiplier(
  config: { authority: string; multiplier: number; newMultiplier: number; newMultiplierEffectiveTimestamp: bigint } | null,
  snapshotTimestamp: number
): MultiplierInfo {
  if (!config) return { multiplier: "1", source: "none" };
  const useNew = BigInt(snapshotTimestamp) >= config.newMultiplierEffectiveTimestamp;
  const info: MultiplierInfo = {
    multiplier: String(useNew ? config.newMultiplier : config.multiplier),
    source: useNew ? "scaled_ui_amount.new_multiplier" : "scaled_ui_amount.multiplier",
    config: {
      authority: config.authority,
      multiplier: String(config.multiplier),
      newMultiplier: String(config.newMultiplier),
      newMultiplierEffectiveTimestamp: config.newMultiplierEffectiveTimestamp.toString()
    }
  };
  return info;
}

/** raw × multiplier × 10^6 / 10^decimals, floored to an integer number of micro-shares. */
export function rawToShares6(raw: bigint, multiplier: string, decimals: number): bigint {
  if (raw < 0n) throw new Error("raw must be non-negative");
  const value = new D(raw.toString()).mul(new D(multiplier)).mul(new D(10).pow(SHARE_DECIMALS)).div(new D(10).pow(decimals));
  return BigInt(value.floor().toFixed(0));
}

/** Format micro-shares as a human string with up to 6 decimals, trailing zeros trimmed to at least 2. */
export function formatShares6(shares6: bigint, minFraction = 2): string {
  const whole = shares6 / SHARE_UNIT;
  const frac = (shares6 % SHARE_UNIT).toString().padStart(6, "0").replace(/0+$/, "");
  const fracOut = frac.length < minFraction ? frac.padEnd(minFraction, "0") : frac;
  return fracOut.length ? `${whole}.${fracOut}` : whole.toString();
}

/** Percentage with 2 decimals, computed in bigint to avoid float drift: part / whole × 100. */
export function percent2(part: bigint, whole: bigint): string {
  if (whole === 0n) return "0.00";
  const scaled = (part * 10_000n) / whole; // basis points
  const int = scaled / 100n;
  const frac = (scaled % 100n).toString().padStart(2, "0");
  return `${int}.${frac}`;
}

/**
 * Split `total` across `weights` proportionally using integer math (largest remainder method).
 * Sum of the result equals `total` exactly, so a container never over-attributes.
 * Returns the per-weight amounts and the remainder assigned by the method (0 when weights sum to total).
 */
export function proRata(total: bigint, weights: bigint[]): bigint[] {
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return weights.map(() => 0n);
  const floors = weights.map((w) => (total * w) / sum);
  let remainder = total - floors.reduce((a, b) => a + b, 0n);
  // hand out the remainder one unit at a time to the largest fractional parts, deterministically
  const order = weights
    .map((w, i) => ({ i, frac: (total * w) % sum }))
    .sort((a, b) => (a.frac === b.frac ? a.i - b.i : a.frac > b.frac ? -1 : 1));
  for (const { i } of order) {
    if (remainder === 0n) break;
    floors[i] = (floors[i] ?? 0n) + 1n;
    remainder -= 1n;
  }
  return floors;
}

/** Map with a concurrency limit, preserving order. */
export async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return out;
}
