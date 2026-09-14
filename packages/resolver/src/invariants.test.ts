import { describe, expect, it } from "vitest";
import { checkInvariants } from "./invariants";
import type { EntitlementPosition } from "@lookthrough/core";

const pos = (wallet: string, container: string, raw: bigint): EntitlementPosition => ({ wallet, mint: "m", source: "direct", container, rawAttributed: raw, ruleApplied: "direct", evidence: {} });

describe("checkInvariants", () => {
  const balances = new Map([
    ["a1", 10n],
    ["v1", 20n]
  ]);
  it("passes when attributed + unattributed equals the account sum", () => {
    const r = checkInvariants({ positions: [pos("w1", "a1", 10n), pos("w2", "v1", 15n)], unattributed: [{ container: "v1", program: null, label: "x", raw: 5n }], balances, supplyRaw: 30n });
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it("fails on a conservation break", () => {
    const r = checkInvariants({ positions: [pos("w1", "a1", 10n)], unattributed: [], balances, supplyRaw: 30n });
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toContain("conservation");
  });
  it("fails on a duplicate (wallet, container) pair and on over-attribution", () => {
    const r = checkInvariants({ positions: [pos("w1", "a1", 6n), pos("w1", "a1", 6n)], unattributed: [{ container: "v1", program: null, label: "x", raw: 18n }], balances, supplyRaw: 30n });
    expect(r.failures.some((f) => f.includes("duplicate"))).toBe(true);
    expect(r.failures.some((f) => f.includes("over-attributed"))).toBe(true);
  });
  it("warns, not fails, when the scan sum differs from mint supply", () => {
    const r = checkInvariants({ positions: [pos("w1", "a1", 10n)], unattributed: [{ container: "v1", program: null, label: "x", raw: 20n }], balances, supplyRaw: 31n });
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toContain("mint supply");
  });
});
