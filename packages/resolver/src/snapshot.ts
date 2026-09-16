/**
 * Snapshot orchestration: read the mint, discover containers, enumerate and classify token accounts,
 * resolve through adapters, build the entitlement set, check invariants.
 */
import { formatShares6, isGpaRefused, percent2, rawToShares6, type Base58, type ContainerInfo, type EntitlementPosition, type Logger, type MintInfo, type PassThroughRules, type PositionAdapter, type SnapshotContext, type UnattributedRow } from "@lookthrough/core";
import { readMintInfo } from "@lookthrough/datasources";
import type { ChainReader } from "@lookthrough/core";
import { classifyAccounts } from "./classify";
import { checkInvariants, type InvariantResult } from "./invariants";
import { scanTokenAccounts } from "./scan";

export interface SnapshotOptions {
  reader: ChainReader;
  mint: Base58;
  adapters: PositionAdapter[];
  registry: Set<Base58>;
  rules: PassThroughRules;
  actionId?: string;
  slotRequested?: number;
  log?: Logger;
  /** Called after each step, for UI progress. */
  onProgress?: (step: string, data?: Record<string, unknown>) => void;
}

export interface EntitlementEntry {
  wallet: Base58;
  /** Share units (6 decimals) from the summed raw amount, floored once per wallet. */
  entitlement: bigint;
  rawTotal: bigint;
  registered: boolean;
  breakdown: EntitlementPosition[];
}

export interface EntitlementSet {
  actionId: string;
  mint: Base58;
  snapshotSlotRequested: number;
  snapshotSlotActual: number;
  snapshotTimestamp: number;
  multiplier: string;
  multiplierSource: string;
  decimals: number;
  supplyRaw: bigint;
  accountsScanned: number;
  attributedRaw: bigint;
  unattributedRaw: bigint;
  unattributed: UnattributedRow[];
  adaptersUsed: { id: string; status: string; containers: number }[];
  entries: EntitlementEntry[];
  invariants: InvariantResult;
}

export const defaultRules: PassThroughRules = {
  version: 1,
  rules: {
    direct: { id: "direct", description: "100% of a wallet-owned token account to that wallet." },
    raydium_clmm: { id: "raydium_clmm", description: "Position token amounts at the snapshot sqrt price plus owed fees, scaled pro rata to the vault balance net of protocol and fund fees, attributed to the position NFT holder." },
    kamino_lend: { id: "kamino_lend", description: "Depositor share of collateral tokens multiplied by the tokens physically in the reserve liquidity vault." }
  }
};

const silent: Logger = { info: () => undefined, warn: () => undefined };

export async function runSnapshot(opts: SnapshotOptions): Promise<EntitlementSet> {
  const log = opts.log ?? silent;
  const progress = opts.onProgress ?? (() => undefined);
  const reader = opts.reader;

  const slotActual = await reader.getSlot();
  const blockTime = await reader.getBlockTime(slotActual);
  const timestamp = blockTime ?? Math.floor(Date.now() / 1000);
  if (blockTime === null) log.warn("getBlockTime returned null, using wall clock for the multiplier timestamp");
  progress("slot", { slotActual, timestamp });

  const mintInfo: MintInfo = await readMintInfo(reader, opts.mint, timestamp);
  progress("mint", { decimals: mintInfo.decimals, supplyRaw: mintInfo.supplyRaw.toString(), multiplier: mintInfo.multiplier.multiplier });

  const unattributed: UnattributedRow[] = [];
  const ctx: SnapshotContext = {
    reader,
    slotRequested: opts.slotRequested ?? slotActual,
    slotActual,
    timestamp,
    mintInfo,
    registry: opts.registry,
    rules: opts.rules,
    log,
    reportUnattributed: (row) => {
      if (row.raw > 0n) unattributed.push(row);
    }
  };

  // 1. Discover containers from program state.
  const containers: ContainerInfo[] = [];
  const adaptersUsed: EntitlementSet["adaptersUsed"] = [];
  const discoveryUnavailable: string[] = [];
  for (const adapter of opts.adapters) {
    let found: ContainerInfo[] = [];
    try {
      found = await adapter.discoverContainers(opts.mint, ctx);
    } catch (err) {
      // An RPC that refuses getProgramAccounts cannot discover anything; say so instead of failing, and anything the
      // adapter would have covered stays in the unattributed bucket with its program label.
      if (!isGpaRefused(err)) throw err;
      log.warn(`${adapter.id}: container discovery unavailable on this RPC (getProgramAccounts refused); its holdings, if any, stay unattributed`);
      discoveryUnavailable.push(adapter.id);
    }
    containers.push(...found);
    adaptersUsed.push({ id: adapter.id, status: adapter.status, containers: found.length });
  }
  progress("containers", { count: containers.length });

  // 2. Enumerate and classify every token account for the mint.
  const scan = await scanTokenAccounts(reader, mintInfo, (m) => log.warn(m));
  const rows = scan.rows;
  progress("accounts", { count: rows.length, method: scan.method, complete: scan.complete });
  const classified = await classifyAccounts(reader, rows, containers);
  progress("classified", { wallets: classified.wallet.length, containers: classified.container.length, programHeld: classified.programHeld.length });

  // 3. Resolve.
  const adapterById = new Map(opts.adapters.map((a) => [a.id, a]));
  const direct = adapterById.get("direct");
  if (!direct) throw new Error("direct adapter missing");
  const positions: EntitlementPosition[] = [];

  for (const row of classified.wallet) {
    if (row.amountRaw === 0n) continue;
    positions.push(
      ...(await direct.resolve({ address: row.pubkey, adapterId: "direct", program: mintInfo.tokenProgram, label: "wallet", meta: { owner: row.owner, amountRaw: row.amountRaw.toString() } }, opts.mint, ctx))
    );
  }

  for (const { row, container } of classified.container) {
    if (row.amountRaw === 0n) continue;
    const adapter = adapterById.get(container.adapterId);
    if (!adapter || adapter.status !== "implemented") {
      unattributed.push({ container: row.pubkey, program: container.program, label: `${container.label} (adapter ${container.adapterId} not implemented)`, raw: row.amountRaw });
      continue;
    }
    const reportedBefore = unattributed.filter((u) => u.container === row.pubkey).reduce((a, u) => a + u.raw, 0n);
    const resolved = await adapter.resolve({ ...container, meta: { ...container.meta, balanceRaw: row.amountRaw.toString() } }, opts.mint, ctx);
    const reported = unattributed.filter((u) => u.container === row.pubkey).reduce((a, u) => a + u.raw, 0n) - reportedBefore;
    const sum = resolved.reduce((a, p) => a + p.rawAttributed, 0n);
    if (sum + reported > row.amountRaw) throw new Error(`${adapter.id} over-attributed container ${row.pubkey}: ${sum} + ${reported} > ${row.amountRaw}`);
    positions.push(...resolved);
    if (sum + reported < row.amountRaw) unattributed.push({ container: row.pubkey, program: container.program, label: `${container.label}: residual after resolution`, raw: row.amountRaw - sum - reported });
  }

  for (const row of classified.programHeld) {
    if (row.amountRaw === 0n) continue;
    unattributed.push({ container: row.pubkey, program: row.ownerProgram, label: row.label, raw: row.amountRaw });
  }
  progress("resolved", { positions: positions.length, unattributed: unattributed.length });

  // 4. Entitlements per wallet (all wallets; filtering to the registry happens when the tree is built).
  const byWallet = new Map<Base58, EntitlementPosition[]>();
  for (const p of positions) {
    const list = byWallet.get(p.wallet) ?? [];
    list.push(p);
    byWallet.set(p.wallet, list);
  }
  const entries: EntitlementEntry[] = [...byWallet.entries()]
    .map(([wallet, breakdown]) => {
      const rawTotal = breakdown.reduce((a, p) => a + p.rawAttributed, 0n);
      return { wallet, rawTotal, entitlement: rawToShares6(rawTotal, mintInfo.multiplier.multiplier, mintInfo.decimals), registered: opts.registry.has(wallet), breakdown };
    })
    .sort((a, b) => (a.wallet < b.wallet ? -1 : 1));

  // 5. Invariants.
  const balances = new Map(rows.map((r) => [r.pubkey, r.amountRaw]));
  const invariants = checkInvariants({ positions, unattributed, balances, supplyRaw: mintInfo.supplyRaw });
  if (discoveryUnavailable.length) invariants.warnings.push(`container discovery unavailable on this RPC for ${discoveryUnavailable.join(", ")} (getProgramAccounts refused)`);
  if (scan.method === "largest_accounts") invariants.warnings.push(`token accounts enumerated with getTokenLargestAccounts (this RPC refuses getProgramAccounts); ${scan.complete ? "the 20-account limit was not reached, so the scan is complete" : "the mint has more than 20 accounts and the scan is incomplete"}`);
  for (const w of invariants.warnings) log.warn(w);
  if (!invariants.ok) {
    for (const f of invariants.failures) log.warn(`INVARIANT FAILED: ${f}`);
    throw new Error(`invariants failed: ${invariants.failures.join("; ")}`);
  }
  progress("invariants", { ok: true, attributedPct: percent2(invariants.totals.attributedRaw, invariants.totals.accountsRaw) });

  return {
    actionId: opts.actionId ?? "",
    mint: opts.mint,
    snapshotSlotRequested: ctx.slotRequested,
    snapshotSlotActual: slotActual,
    snapshotTimestamp: timestamp,
    multiplier: mintInfo.multiplier.multiplier,
    multiplierSource: mintInfo.multiplier.source,
    decimals: mintInfo.decimals,
    supplyRaw: mintInfo.supplyRaw,
    accountsScanned: rows.length,
    attributedRaw: invariants.totals.attributedRaw,
    unattributedRaw: invariants.totals.unattributedRaw,
    unattributed,
    adaptersUsed,
    entries,
    invariants
  };
}

/** The supply panel, as printed by the CLI and shown by the issuer console. */
export function supplyPanel(set: EntitlementSet): { attributedPct: string; unattributedPct: string; doubleCounted: number; byLabel: { label: string; program: string | null; raw: string; pct: string; shares: string }[] } {
  const total = set.attributedRaw + set.unattributedRaw;
  const grouped = new Map<string, { program: string | null; raw: bigint }>();
  for (const u of set.unattributed) {
    const g = grouped.get(u.label) ?? { program: u.program, raw: 0n };
    g.raw += u.raw;
    grouped.set(u.label, g);
  }
  return {
    attributedPct: percent2(set.attributedRaw, total),
    unattributedPct: percent2(set.unattributedRaw, total),
    doubleCounted: 0,
    byLabel: [...grouped.entries()]
      .sort((a, b) => (a[1].raw > b[1].raw ? -1 : 1))
      .map(([label, g]) => ({ label, program: g.program, raw: g.raw.toString(), pct: percent2(g.raw, total), shares: formatShares6(rawToShares6(g.raw, set.multiplier, set.decimals)) }))
  };
}

/** JSON-safe form of the entitlement set (bigint as decimal strings), the shape served at /actions/[id]/entitlements.json. */
export function serialiseEntitlementSet(set: EntitlementSet): Record<string, unknown> {
  return {
    actionId: set.actionId,
    mint: set.mint,
    snapshotSlotRequested: set.snapshotSlotRequested,
    snapshotSlotActual: set.snapshotSlotActual,
    snapshotTimestamp: set.snapshotTimestamp,
    multiplier: set.multiplier,
    multiplierSource: set.multiplierSource,
    decimals: set.decimals,
    supplyRaw: set.supplyRaw.toString(),
    accountsScanned: set.accountsScanned,
    attributedRaw: set.attributedRaw.toString(),
    unattributedRaw: set.unattributedRaw.toString(),
    unattributed: set.unattributed.map((u) => ({ container: u.container, program: u.program, label: u.label, raw: u.raw.toString() })),
    adaptersUsed: set.adaptersUsed,
    invariants: { ok: set.invariants.ok, failures: set.invariants.failures, warnings: set.invariants.warnings },
    entries: set.entries.map((e) => ({
      wallet: e.wallet,
      entitlement: e.entitlement.toString(),
      rawTotal: e.rawTotal.toString(),
      registered: e.registered,
      breakdown: e.breakdown.map((p) => ({ ...p, rawAttributed: p.rawAttributed.toString(), ...(p.exposureRaw !== undefined ? { exposureRaw: p.exposureRaw.toString() } : {}) }))
    }))
  };
}
