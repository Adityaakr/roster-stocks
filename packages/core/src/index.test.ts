import { describe, expect, it } from "vitest";
import { packageName } from "./index.js";

describe("scaffold", () => {
  it("placeholder test runs", () => {
    expect(packageName).toBe("@lookthrough/core");
  });
});
