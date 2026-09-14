/** Browser-safe formatting helpers. Numbers stay tabular and honest: nothing here rounds beyond what it says. */

export const SHARE_UNIT = 1_000_000n;

export function shares(shares6: bigint | string, minFraction = 2, maxFraction = 6): string {
  const v = BigInt(shares6);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / SHARE_UNIT;
  let frac = (abs % SHARE_UNIT).toString().padStart(6, "0").slice(0, maxFraction).replace(/0+$/, "");
  if (frac.length < minFraction) frac = frac.padEnd(minFraction, "0");
  const wholeStr = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}${wholeStr}${frac ? `.${frac}` : ""}`;
}

export function usdc(micro: bigint | string | number): string {
  const v = BigInt(micro);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

export function pct(part: bigint | string, whole: bigint | string): string {
  const p = BigInt(part);
  const w = BigInt(whole);
  if (w === 0n) return "0.00";
  const bp = (p * 10_000n) / w;
  return `${bp / 100n}.${(bp % 100n).toString().padStart(2, "0")}`;
}

export function short(pk: string, n = 4): string {
  return pk.length > n * 2 + 1 ? `${pk.slice(0, n)}…${pk.slice(-n)}` : pk;
}

export function slotLabel(slot: number | string | bigint): string {
  return Number(slot).toLocaleString("en-US");
}

export function timeLabel(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}
