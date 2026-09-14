/**
 * End-to-end on the fork: the five demo scenes must all pass.
 * Needs: pnpm fork (running), pnpm anchor:build, pnpm anchor:deploy, pnpm seed. Skipped when the fork is not reachable.
 */
import { describe, expect, it } from "vitest";
import { runDemo } from "../../scripts/demo";

const FORK = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8899";

async function forkUp(): Promise<boolean> {
  try {
    const res = await fetch(FORK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }) });
    return res.ok;
  } catch {
    return false;
  }
}

describe("demo on the fork", () => {
  it("runs all five scenes", async () => {
    if (!(await forkUp())) {
      console.warn(`Couldn't reach the fork at ${FORK}. Start it with pnpm fork. Skipping the e2e demo.`);
      return;
    }
    const checklist = await runDemo({ prefix: `e2e-${Date.now()}`, inMinutes: 0.1, log: (m) => console.log(m) });
    const failed = checklist.filter((c) => !c.ok);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(checklist.some((c) => c.scene === "scene 4" && c.item.startsWith("Alice claimed"))).toBe(true);
  }, 30 * 60_000);
});
