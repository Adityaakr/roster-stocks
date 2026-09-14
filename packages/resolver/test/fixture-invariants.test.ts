/**
 * The invariant test on a recorded mainnet snapshot (fixtures/accounts/AAPLx.json.gz, captured by
 * `pnpm fixtures:capture`). Replays every RPC read the resolver made, so it runs without network, and
 * asserts the four invariants plus the facts the README quotes.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import { ReplayReader, type ReaderRecording } from "@lookthrough/datasources";
import { defaultAdapters } from "@lookthrough/adapters";
import { percent2 } from "@lookthrough/core";
import { defaultRules, runSnapshot, supplyPanel } from "../src/index";

const file = resolve(__dirname, "../../../fixtures/accounts/AAPLx.json.gz");

describe("AAPLx mainnet fixture", () => {
  it("fixture is present (run pnpm fixtures:capture to refresh)", () => {
    expect(existsSync(file)).toBe(true);
  });

  it("resolves every token account exactly once and conserves supply", async () => {
    const payload = JSON.parse(gunzipSync(readFileSync(file)).toString()) as { mint: string; slot: number; recording: ReaderRecording };
    const warnings: string[] = [];
    const set = await runSnapshot({
      reader: new ReplayReader(payload.recording),
      mint: payload.mint,
      adapters: defaultAdapters(),
      registry: new Set(),
      rules: defaultRules,
      actionId: "fixture",
      log: { info: () => undefined, warn: (m) => warnings.push(m) }
    });
    // Invariant 1: attributed + unattributed == sum of all token-account balances (raw units).
    expect(set.invariants.ok).toBe(true);
    expect(set.attributedRaw + set.unattributedRaw).toBe(set.invariants.totals.accountsRaw);
    // Soft check: the scan is complete, the account sum equals the mint supply.
    expect(set.invariants.warnings).toEqual([]);
    expect(set.invariants.totals.accountsRaw).toBe(set.supplyRaw);
    // Invariant 2: no (wallet, container) pair twice.
    const pairs = set.entries.flatMap((e) => e.breakdown.map((p) => `${p.wallet}|${p.container}`));
    expect(new Set(pairs).size).toBe(pairs.length);
    // Invariant 3: per-container attribution never exceeds the container balance (checked inside checkInvariants).
    // Invariant 4: entitlements are computed for all wallets; the registry only flags them.
    expect(set.entries.length).toBeGreaterThan(1000);
    expect(set.entries.every((e) => e.registered === false)).toBe(true);
    // Both protocol adapters resolved real containers.
    expect(set.adaptersUsed.find((a) => a.id === "raydium_clmm")?.containers).toBeGreaterThan(0);
    expect(set.adaptersUsed.find((a) => a.id === "kamino_lend")?.containers).toBeGreaterThan(0);
    expect(set.entries.some((e) => e.breakdown.some((p) => p.source === "raydium_clmm"))).toBe(true);
    expect(set.entries.some((e) => e.breakdown.some((p) => p.source === "kamino_lend"))).toBe(true);
    const panel = supplyPanel(set);
    expect(panel.doubleCounted).toBe(0);
    expect(panel.attributedPct).toBe(percent2(set.attributedRaw, set.attributedRaw + set.unattributedRaw));
    expect(set.snapshotSlotActual).toBe(payload.slot);
  }, 120_000);
});
