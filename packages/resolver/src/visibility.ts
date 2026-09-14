/**
 * The visibility stat: share of a mint's token-account supply that a plain wallet scan cannot see.
 * Runs the same classification as the snapshot, read-only, and writes a JSON the landing page reads.
 */
import { percent2, programLabel, type Base58, type ChainReader, type Logger, type PositionAdapter } from "@lookthrough/core";
import { readMintInfo } from "@lookthrough/datasources";
import type { SnapshotContext } from "@lookthrough/core";
import { classifyAccounts } from "./classify";
import { enumerateTokenAccounts } from "./scan";
import { defaultRules } from "./snapshot";

export interface VisibilityStat {
  mint: Base58;
  symbol: string;
  slot: number;
  timestamp: number;
  decimals: number;
  multiplier: string;
  supplyRaw: string;
  accountsRaw: string;
  accountsScanned: number;
  walletVisibleRaw: string;
  programHeldRaw: string;
  programHeldPct: string;
  breakdownByProgram: { label: string; program: Base58 | null; raw: string; pct: string; accounts: number }[];
}

export async function computeVisibility(opts: { reader: ChainReader; mint: Base58; symbol: string; adapters: PositionAdapter[]; log?: Logger }): Promise<VisibilityStat> {
  const log = opts.log ?? { info: () => undefined, warn: () => undefined };
  const slot = await opts.reader.getSlot();
  const timestamp = (await opts.reader.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000);
  const mintInfo = await readMintInfo(opts.reader, opts.mint, timestamp);
  const ctx: SnapshotContext = { reader: opts.reader, slotRequested: slot, slotActual: slot, timestamp, mintInfo, registry: new Set(), rules: defaultRules, log, reportUnattributed: () => undefined };
  const containers = (await Promise.all(opts.adapters.map((a) => a.discoverContainers(opts.mint, ctx)))).flat();
  const rows = await enumerateTokenAccounts(opts.reader, mintInfo);
  const c = await classifyAccounts(opts.reader, rows, containers);

  const walletVisibleRaw = c.wallet.reduce((a, r) => a + r.amountRaw, 0n);
  const groups = new Map<string, { program: Base58 | null; raw: bigint; accounts: number }>();
  const add = (label: string, program: Base58 | null, raw: bigint) => {
    const g = groups.get(label) ?? { program, raw: 0n, accounts: 0 };
    g.raw += raw;
    g.accounts += 1;
    groups.set(label, g);
  };
  for (const { row, container } of c.container) add(programLabel(container.program), container.program, row.amountRaw);
  for (const row of c.programHeld) add(row.label, row.ownerProgram, row.amountRaw);
  const programHeldRaw = [...groups.values()].reduce((a, g) => a + g.raw, 0n);
  const accountsRaw = walletVisibleRaw + programHeldRaw;

  return {
    mint: opts.mint,
    symbol: opts.symbol,
    slot,
    timestamp,
    decimals: mintInfo.decimals,
    multiplier: mintInfo.multiplier.multiplier,
    supplyRaw: mintInfo.supplyRaw.toString(),
    accountsRaw: accountsRaw.toString(),
    accountsScanned: rows.length,
    walletVisibleRaw: walletVisibleRaw.toString(),
    programHeldRaw: programHeldRaw.toString(),
    programHeldPct: percent2(programHeldRaw, accountsRaw),
    breakdownByProgram: [...groups.entries()]
      .sort((a, b) => (a[1].raw > b[1].raw ? -1 : 1))
      .map(([label, g]) => ({ label, program: g.program, raw: g.raw.toString(), pct: percent2(g.raw, accountsRaw), accounts: g.accounts }))
  };
}
