/**
 * Action store and record-date scheduling shared by the CLI and the web issuer console.
 * Actions live as JSON files under a data directory (default apps/web/public/data/actions/<id>/action.json),
 * next to the entitlements.json and tree.json the app serves.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { actionIdFromLabel, buildEntitlementTree, hex, type Base58 } from "@lookthrough/core";
import type { EntitlementSet } from "./snapshot";
import { serialiseEntitlementSet } from "./snapshot";

export type ActionKind = "distribution" | "vote";

export interface ActionRecord {
  id: string;
  /** 32-byte action id, hex. */
  actionIdHex: string;
  kind: ActionKind;
  mint: Base58;
  symbol: string;
  title: string;
  createdAt: string;
  /** Record slot the registrar scheduled. */
  recordSlot: number;
  recordSlotScheduledAt: string;
  /** Distribution: USDC micro-units per 1e6 share units. Vote: the question. */
  amountPerShareMicro?: string;
  question?: string;
  deadlineSlot?: number;
  /** Registered wallets used for the tree when the on-chain registry is not read (Phase 2), else null. */
  registryOverride?: Base58[] | null;
  status: "scheduled" | "snapshotted" | "published" | "funded" | "open" | "closed";
  snapshot?: {
    slotActual: number;
    timestamp: number;
    root: string;
    contentHash: string;
    totalEntitlement: string;
    leaves: number;
    attributedPct: string;
  };
  onchain?: { actionPda: Base58; createTx: string; fundTx?: string; vault?: Base58 };
}

export const DEFAULT_ACTIONS_DIR = "apps/web/public/data/actions";

export class ActionStore {
  constructor(readonly dir: string = DEFAULT_ACTIONS_DIR) {}

  path(id: string, file = "action.json"): string {
    return join(this.dir, id, file);
  }

  list(): ActionRecord[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((d) => existsSync(this.path(d)))
      .map((d) => this.get(d))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  get(id: string): ActionRecord {
    const p = this.path(id);
    if (!existsSync(p)) throw new Error(`action ${id} not found at ${p}`);
    return JSON.parse(readFileSync(p, "utf8")) as ActionRecord;
  }

  save(record: ActionRecord): void {
    mkdirSync(join(this.dir, record.id), { recursive: true });
    writeFileSync(this.path(record.id), JSON.stringify(record, null, 2));
  }

  writeJson(id: string, file: string, value: unknown): void {
    mkdirSync(join(this.dir, id), { recursive: true });
    writeFileSync(this.path(id, file), JSON.stringify(value, null, 2));
  }

  readJson<T>(id: string, file: string): T {
    return JSON.parse(readFileSync(this.path(id, file), "utf8")) as T;
  }
}

/** Solana targets 400 ms slots; surfpool defaults to the same. */
export const SLOT_MS = 400;

export function slotsFromNow(minutes: number, slotMs = SLOT_MS): number {
  return Math.ceil((minutes * 60_000) / slotMs);
}

export interface SessionInfo {
  name: string;
  startTime: string;
  endTime: string;
  timezone: string;
  startWeekday: number;
  endWeekday: number;
}
export interface HolidayInfo {
  market: string;
  name: string;
  date: string;
  startTime?: string | null | undefined;
  endTime?: string | null | undefined;
  timezone?: string | undefined;
}

/** Is the US regular session open right now? Uses Backpack sessions and full-day holidays. */
export function marketSessionState(now: Date, sessions: SessionInfo[], holidays: HolidayInfo[]): { open: boolean; session: string | null; label: string } {
  const regular = sessions.find((s) => s.name === "US_EQUITIES_REGULAR");
  if (!regular) return { open: false, session: null, label: "US market state unavailable" };
  const inTz = new Date(now.toLocaleString("en-US", { timeZone: regular.timezone }));
  const weekday = inTz.getDay() === 0 ? 7 : inTz.getDay();
  const dateStr = inTz.toISOString().slice(0, 10);
  const holiday = holidays.find((h) => h.date === dateStr && (!h.startTime || h.startTime === "00:00:00"));
  if (weekday < regular.startWeekday || weekday > regular.endWeekday) return { open: false, session: null, label: "US market closed (weekend)" };
  if (holiday) return { open: false, session: null, label: `US market closed (${holiday.name})` };
  const hhmm = inTz.getHours() * 60 + inTz.getMinutes();
  const [sh, sm] = regular.startTime.split(":").map(Number);
  const [eh, em] = regular.endTime.split(":").map(Number);
  const open = hhmm >= (sh ?? 9) * 60 + (sm ?? 30) && hhmm < (eh ?? 16) * 60 + (em ?? 0);
  return { open, session: open ? regular.name : null, label: open ? "US market open (regular session)" : "US market closed" };
}

/**
 * Suggest a record date: the next US regular-session close (from Backpack market sessions) that is not a full holiday.
 * Returns the ISO timestamp of that close and the reasoning, for the issuer console to display.
 */
export function suggestRecordDate(now: Date, sessions: SessionInfo[], holidays: HolidayInfo[]): { closeAt: Date; sessionName: string; skipped: string[] } {
  const regular = sessions.find((s) => s.name === "US_EQUITIES_REGULAR") ?? sessions[0];
  if (!regular) throw new Error("no market sessions");
  const [hh, mm] = regular.endTime.split(":").map(Number);
  const fullHolidays = new Set(holidays.filter((h) => !h.startTime || h.startTime === "00:00:00").map((h) => h.date));
  const skipped: string[] = [];
  for (let d = 0; d < 14; d++) {
    const candidate = new Date(now.getTime() + d * 86_400_000);
    const inTz = new Date(candidate.toLocaleString("en-US", { timeZone: regular.timezone }));
    const weekday = inTz.getDay() === 0 ? 7 : inTz.getDay(); // 1 = Monday .. 7 = Sunday, matching Backpack's startWeekday/endWeekday
    const dateStr = inTz.toISOString().slice(0, 10);
    if (weekday < regular.startWeekday || weekday > regular.endWeekday) {
      skipped.push(`${dateStr} weekend`);
      continue;
    }
    if (fullHolidays.has(dateStr)) {
      skipped.push(`${dateStr} holiday`);
      continue;
    }
    const close = new Date(inTz);
    close.setHours(hh ?? 16, mm ?? 0, 0, 0);
    // convert the wall-clock close back to an absolute instant
    const offsetMs = candidate.getTime() - inTz.getTime();
    const closeAbs = new Date(close.getTime() + offsetMs);
    if (closeAbs.getTime() <= now.getTime()) {
      skipped.push(`${dateStr} already closed`);
      continue;
    }
    return { closeAt: closeAbs, sessionName: regular.name, skipped };
  }
  throw new Error("no session close found in the next 14 days");
}

export function newAction(params: { label: string; kind: ActionKind; mint: Base58; symbol: string; title: string; recordSlot: number; amountPerShareMicro?: bigint; question?: string; deadlineSlot?: number; registryOverride?: Base58[] | null }): ActionRecord {
  return {
    id: params.label,
    actionIdHex: hex(actionIdFromLabel(params.label)),
    kind: params.kind,
    mint: params.mint,
    symbol: params.symbol,
    title: params.title,
    createdAt: new Date().toISOString(),
    recordSlot: params.recordSlot,
    recordSlotScheduledAt: new Date().toISOString(),
    ...(params.amountPerShareMicro !== undefined ? { amountPerShareMicro: params.amountPerShareMicro.toString() } : {}),
    ...(params.question !== undefined ? { question: params.question } : {}),
    ...(params.deadlineSlot !== undefined ? { deadlineSlot: params.deadlineSlot } : {}),
    registryOverride: params.registryOverride ?? null,
    status: "scheduled"
  };
}

/** Build tree.json for an action from an entitlement set (registered wallets only, zero entitlements excluded). */
export function buildActionTree(action: ActionRecord, set: EntitlementSet) {
  const actionId = Buffer.from(action.actionIdHex, "hex");
  const entries = set.entries.filter((e) => e.registered).map((e) => ({ wallet: e.wallet, entitlement: e.entitlement }));
  if (entries.length === 0) throw new Error("no registered wallets with a positive entitlement; the tree needs at least one leaf");
  const tree = buildEntitlementTree({ actionId: new Uint8Array(actionId), mint: action.mint, snapshotSlot: BigInt(set.snapshotSlotActual), entries });
  return {
    root: hex(tree.root),
    totalEntitlement: tree.totalEntitlement,
    leaves: tree.records.map((r) => ({ wallet: r.wallet, entitlement: r.entitlement.toString(), leaf: hex(r.leaf), proof: r.proof.map(hex) }))
  };
}

export function contentHashOf(json: string): string {
  return createHash("sha256").update(json).digest("hex");
}

export function entitlementsJson(set: EntitlementSet): string {
  return JSON.stringify(serialiseEntitlementSet(set), null, 2);
}
