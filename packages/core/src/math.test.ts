import { describe, expect, it } from "vitest";
import { effectiveMultiplier, formatShares6, percent2, proRata, rawToShares6 } from "./math";

// Values read from the AAPLx mint on mainnet at slot 446997288 (2026-09-14).
const aaplx = {
  authority: "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS",
  multiplier: 1.0026642075893797,
  newMultiplier: 1.0032690125398187,
  newMultiplierEffectiveTimestamp: 1786149000n
};

describe("effectiveMultiplier", () => {
  it("uses multiplier before the effective timestamp and newMultiplier at or after", () => {
    expect(effectiveMultiplier(aaplx, 1786148999)).toMatchObject({ multiplier: "1.0026642075893797", source: "scaled_ui_amount.multiplier" });
    expect(effectiveMultiplier(aaplx, 1786149000)).toMatchObject({ multiplier: "1.0032690125398187", source: "scaled_ui_amount.new_multiplier" });
  });
  it("is 1 without the extension", () => {
    expect(effectiveMultiplier(null, 0)).toEqual({ multiplier: "1", source: "none" });
  });
});

describe("rawToShares6", () => {
  it("converts 8-decimal raw units with a multiplier, floored", () => {
    // 100 AAPLx raw units at multiplier 1.0032690125398187 = 100.32690125398187 shares
    expect(rawToShares6(10_000_000_000n, "1.0032690125398187", 8)).toBe(100_326_901n);
    expect(rawToShares6(10_000_000_000n, "1", 8)).toBe(100_000_000n);
    expect(rawToShares6(1n, "1", 8)).toBe(0n);
    expect(rawToShares6(0n, "1.5", 8)).toBe(0n);
  });
  it("is exact for large raw amounts (no float)", () => {
    // full AAPLx supply at snapshot: 15,376,356,078,962 raw
    expect(rawToShares6(15_376_356_078_962n, "1.0026642075893797", 8)).toBe(154_173_218_835n);
  });
});

describe("proRata", () => {
  it("conserves the total exactly", () => {
    const out = proRata(1000n, [1n, 1n, 1n]);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(1000n);
    expect(out).toEqual([334n, 333n, 333n]);
  });
  it("handles zero weights", () => {
    expect(proRata(10n, [0n, 0n])).toEqual([0n, 0n]);
  });
});

describe("formatting", () => {
  it("formats shares and percentages", () => {
    expect(formatShares6(100_326_901n)).toBe("100.326901");
    expect(formatShares6(25_000_000n)).toBe("25.00");
    expect(percent2(1n, 3n)).toBe("33.33");
    expect(percent2(3n, 3n)).toBe("100.00");
  });
});
