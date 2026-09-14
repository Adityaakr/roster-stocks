/**
 * The four resolver invariants (spec 5.4), checked in raw units.
 */
import type { EntitlementPosition, UnattributedRow } from "@lookthrough/core";

export interface InvariantInput {
  positions: EntitlementPosition[];
  unattributed: UnattributedRow[];
  /** Raw balance of every token account for the mint at the snapshot, keyed by token account. */
  balances: Map<string, bigint>;
  /** Mint supply from the mint account, for the soft check. */
  supplyRaw: bigint;
}

export interface InvariantResult {
  ok: boolean;
  failures: string[];
  warnings: string[];
  totals: { attributedRaw: bigint; unattributedRaw: bigint; accountsRaw: bigint; supplyRaw: bigint };
}

export function checkInvariants(input: InvariantInput): InvariantResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const attributedRaw = input.positions.reduce((a, p) => a + p.rawAttributed, 0n);
  const unattributedRaw = input.unattributed.reduce((a, u) => a + u.raw, 0n);
  let accountsRaw = 0n;
  for (const v of input.balances.values()) accountsRaw += v;

  // 1. Conservation: attributed + unattributed == sum of all token-account balances.
  if (attributedRaw + unattributedRaw !== accountsRaw) {
    failures.push(`conservation: attributed ${attributedRaw} + unattributed ${unattributedRaw} != accounts ${accountsRaw} (delta ${attributedRaw + unattributedRaw - accountsRaw})`);
  }
  // 2. No (wallet, container) pair twice.
  const seen = new Set<string>();
  for (const p of input.positions) {
    const k = `${p.wallet}|${p.container}`;
    if (seen.has(k)) failures.push(`duplicate (wallet, container): ${k}`);
    seen.add(k);
  }
  // 3. Per container, attributed never exceeds the container's balance.
  const perContainer = new Map<string, bigint>();
  for (const p of input.positions) perContainer.set(p.container, (perContainer.get(p.container) ?? 0n) + p.rawAttributed);
  for (const [container, sum] of perContainer) {
    const bal = input.balances.get(container);
    if (bal === undefined) failures.push(`container ${container} has attributions but no balance in the scan`);
    else if (sum > bal) failures.push(`container ${container} over-attributed: ${sum} > balance ${bal}`);
  }
  // Soft: scanned accounts vs mint supply (catches an incomplete scan).
  if (accountsRaw !== input.supplyRaw) {
    warnings.push(`scanned token accounts sum to ${accountsRaw} but mint supply is ${input.supplyRaw} (delta ${accountsRaw - input.supplyRaw})`);
  }
  return { ok: failures.length === 0, failures, warnings, totals: { attributedRaw, unattributedRaw, accountsRaw, supplyRaw: input.supplyRaw } };
}
