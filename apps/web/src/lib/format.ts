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

/** Share units rounded half up to `digits` decimals, for headline figures where a 34.999999 estimate should read 35.00. Tables keep `shares()`, which truncates. */
export function sharesRounded(shares6: bigint | string, digits = 2): string {
  const v = BigInt(shares6);
  const scale = 10n ** BigInt(6 - digits);
  const rounded = (v + scale / 2n) / scale;
  const whole = rounded / 10n ** BigInt(digits);
  const frac = (rounded % 10n ** BigInt(digits)).toString().padStart(digits, "0");
  return `${whole.toLocaleString("en-US")}${digits ? `.${frac}` : ""}`;
}

/**
 * Share equivalents at a precision that suits the size: two decimals from 0.01 up, otherwise every decimal the
 * six-decimal share unit carries. A holding of 0.001293 shares must never print as 0.00.
 */
export function sharesSmart(shares6: bigint | string): string {
  const v = BigInt(shares6);
  const abs = v < 0n ? -v : v;
  if (abs === 0n) return "0";
  if (abs >= 10_000n) return sharesRounded(v, 2);
  return shares(v, 6, 6);
}
