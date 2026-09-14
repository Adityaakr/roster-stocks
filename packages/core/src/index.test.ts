import { describe, expect, it } from "vitest";
import { programLabel, RAYDIUM_CLMM_PROGRAM } from "./index";

describe("known programs", () => {
  it("labels known ids and never guesses unknown ones", () => {
    expect(programLabel(RAYDIUM_CLMM_PROGRAM)).toBe("Raydium CLMM");
    expect(programLabel("11111111111111111111111111111112")).toBe("other programs");
    expect(programLabel(null)).toBe("other programs");
  });
});
