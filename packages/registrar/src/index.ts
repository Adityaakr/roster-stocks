/**
 * Registrar operations shared by the CLI (scripts/run-snapshot.ts), the demo (scripts/demo.ts) and the web
 * issuer routes. Every operation is idempotent and returns what it did.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchorNs from "@anchor-lang/core";
// @anchor-lang/core ships CJS and ESM; Node's CJS interop exposes the module as `default`, bundlers as the namespace.
const anchor = ((anchorNs as { default?: unknown }).default ?? anchorNs) as typeof anchorNs;
const { Wallet } = anchor;
import { keccak_256 } from "@noble/hashes/sha3.js";
import { BackpackClient, RpcReader, rpcUrlsFromEnv } from "@lookthrough/datasources";
import { defaultAdapters } from "@lookthrough/adapters";
import type { ActionStore} from "@lookthrough/resolver";
import { buildActionTree, defaultRules, entitlementsJson, newAction, runSnapshot, slotsFromNow, suggestRecordDate, supplyPanel, type ActionRecord, type EntitlementSet } from "@lookthrough/resolver";
import { formatShares6, type Logger } from "@lookthrough/core";
import { LookthroughClient, type VoteChoice } from "@lookthrough/sdk";

export type Log = (message: string, data?: unknown) => void;
/** Keypair directory, overridable so the web app (cwd apps/web) finds the repo-level .keys. */
export function keysDir(): string {
  return process.env.LOOKTHROUGH_KEYS_DIR ?? ".keys";
}

export function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(path, "utf8"))));
}

export function forkConnection(): Connection {
  return new Connection(rpcUrlsFromEnv().fork, "confirmed");
}

export function forkReader(log?: Log): RpcReader {
  return new RpcReader({ url: rpcUrlsFromEnv().fork, logger: (m) => log?.(`[rpc] ${m}`) });
}

export function clientFor(keypair: Keypair, connection = forkConnection()): LookthroughClient {
  return new LookthroughClient(connection, new Wallet(keypair));
}

export function registrarKeypair(): Keypair {
  return loadKeypair(process.env.REGISTRAR_KEYPAIR_PATH ?? `${keysDir()}/registrar.json`);
}

export function demoWallets(): Record<"alice" | "bob" | "carol", Keypair> {
  return { alice: loadKeypair(`${keysDir()}/alice.json`), bob: loadKeypair(`${keysDir()}/bob.json`), carol: loadKeypair(`${keysDir()}/carol.json`) };
}

export function demoInfo(): { mint: string; usdcMint: string; registrar: string } {
  const p = `${keysDir()}/demo.json`;
  if (!existsSync(p)) throw new Error("Demo wallets are not seeded yet. Run pnpm seed with the fork up.");
  return JSON.parse(readFileSync(p, "utf8")) as { mint: string; usdcMint: string; registrar: string };
}

const rpcLogger = (log: Log): Logger => ({ info: (m) => log(`[info] ${m}`), warn: (m) => log(`[warn] ${m}`) });

/** Register a wallet on-chain for a mint. Returns the registration slot. */
export async function register(keypair: Keypair, mint: PublicKey, log: Log): Promise<{ signature: string | null; slot: bigint }> {
  const client = clientFor(keypair);
  const existing = await client.isRegistered(mint);
  if (existing.registered) {
    log(`${keypair.publicKey.toBase58()} already registered at slot ${existing.slot}`);
    return { signature: null, slot: existing.slot as bigint };
  }
  const signature = await client.register(mint);
  const after = await client.isRegistered(mint);
  log(`registered ${keypair.publicKey.toBase58()} for ${mint.toBase58()} at slot ${after.slot} (tx ${signature})`);
  return { signature, slot: after.slot as bigint };
}

/** Wallets with a Registration PDA among the candidates (the on-chain registry read). */
export async function onchainRegistry(mint: PublicKey, candidates: PublicKey[]): Promise<Set<string>> {
  const client = LookthroughClient.readOnly(forkConnection());
  const out = new Set<string>();
  for (const w of candidates) {
    const r = await client.isRegistered(mint, w);
    if (r.registered) out.add(w.toBase58());
  }
  return out;
}

export async function recordDateSuggestion(log: Log): Promise<void> {
  try {
    const bp = new BackpackClient();
    const [sessions, holidays] = await Promise.all([bp.marketSessions(), bp.marketHolidays()]);
    const s = suggestRecordDate(new Date(), sessions, holidays);
    log(`suggested record date: next ${s.sessionName} close at ${s.closeAt.toISOString()}${s.skipped.length ? ` (skipped ${s.skipped.join(", ")})` : ""}`);
  } catch (err) {
    log(`record-date suggestion unavailable: ${err instanceof Error ? err.message : err}`);
  }
}

export interface ScheduleInput {
  label: string;
  mint: string;
  symbol: string;
  kind: "distribution" | "vote";
  inMinutes: number;
  usdcPerShare?: number;
  question?: string;
  deadlineMinutes?: number;
  title?: string;
  registry: string[];
}

export async function schedule(store: ActionStore, input: ScheduleInput, log: Log): Promise<ActionRecord> {
  if (existsSync(store.path(input.label))) {
    const existing = store.get(input.label);
    log(`action ${input.label} already exists (${existing.status}), leaving it unchanged`);
    return existing;
  }
  const slot = await forkReader(log).getSlot();
  const recordSlot = slot + slotsFromNow(input.inMinutes);
  const record = newAction({
    label: input.label,
    kind: input.kind,
    mint: input.mint,
    symbol: input.symbol,
    title: input.title ?? (input.kind === "distribution" ? `${input.symbol} cash distribution` : `${input.symbol} shareholder vote`),
    recordSlot,
    ...(input.kind === "distribution" ? { amountPerShareMicro: BigInt(Math.round((input.usdcPerShare ?? 0.25) * 1_000_000)) } : {}),
    ...(input.kind === "vote" ? { question: input.question ?? "Approve acquisition of XYZ", deadlineSlot: recordSlot + slotsFromNow(input.deadlineMinutes ?? 30) } : {}),
    registryOverride: input.registry
  });
  store.save(record);
  log(`scheduled ${input.label}: record slot ${recordSlot} (current ${slot}, about ${input.inMinutes} min out)`, { kind: input.kind, registry: input.registry.length });
  return record;
}

export async function waitForSlot(target: number, log: Log): Promise<number> {
  const reader = forkReader(log);
  let slot = await reader.getSlot();
  while (slot < target) {
    log(`waiting for record slot ${target}, current ${slot}`);
    await new Promise((r) => setTimeout(r, Math.min(5000, (target - slot) * 400)));
    slot = await reader.getSlot();
  }
  return slot;
}

/**
 * Take the snapshot for an action: wait for the record slot, resolve, write entitlements.json and tree.json.
 * `reuseFrom` builds the tree from another action's entitlement set (same mint) instead of resolving again,
 * which is what the demo does for the vote that shares the distribution's record date.
 */
export async function snapshot(store: ActionStore, id: string, log: Log, opts?: { reuseFrom?: string; onProgress?: (step: string, data?: Record<string, unknown>) => void }): Promise<ActionRecord> {
  const action = store.get(id);
  if (action.status !== "scheduled") {
    log(`action ${id} is ${action.status}; snapshot already taken at slot ${action.snapshot?.slotActual}`);
    return action;
  }
  const registry = new Set(action.registryOverride ?? []);
  let set: EntitlementSet;
  let json: string;
  if (opts?.reuseFrom) {
    const source = store.get(opts.reuseFrom);
    if (!source.snapshot) throw new Error(`${opts.reuseFrom} has no snapshot to reuse`);
    if (source.mint !== action.mint) throw new Error("cannot reuse a snapshot of a different mint");
    json = readFileSync(store.path(opts.reuseFrom, "entitlements.json"), "utf8");
    set = reviveEntitlementSet(JSON.parse(json), registry);
    log(`reusing the entitlement set of ${opts.reuseFrom} (slot ${set.snapshotSlotActual}) for ${id}`);
  } else {
    await waitForSlot(action.recordSlot, log);
    set = await runSnapshot({
      reader: forkReader(log),
      mint: action.mint,
      adapters: defaultAdapters(),
      registry,
      rules: defaultRules,
      actionId: action.actionIdHex,
      slotRequested: action.recordSlot,
      log: rpcLogger(log),
      onProgress: (step, data) => {
        log(`[${step}] ${JSON.stringify(data ?? {})}`);
        opts?.onProgress?.(step, data);
      }
    });
    json = entitlementsJson(set);
  }
  const tree = buildActionTree(action, set);
  const contentHash = createHash("sha256").update(json).digest("hex");
  store.writeJson(id, "entitlements.json", JSON.parse(json));
  store.writeJson(id, "tree.json", { ...tree, totalEntitlement: tree.totalEntitlement.toString() });
  const panel = supplyPanel(set);
  action.status = "snapshotted";
  action.snapshot = { slotActual: set.snapshotSlotActual, timestamp: set.snapshotTimestamp, root: tree.root, contentHash, totalEntitlement: tree.totalEntitlement.toString(), leaves: tree.leaves.length, attributedPct: panel.attributedPct, ...(opts?.reuseFrom ? { reusedFrom: opts.reuseFrom } : {}) };
  store.save(action);
  log(`snapshot for ${id}: requested slot ${action.recordSlot}, actual ${set.snapshotSlotActual}, multiplier ${set.multiplier} (${set.multiplierSource}), accounts ${set.accountsScanned}`);
  log(`supply panel: attributed ${panel.attributedPct}%, unattributed ${panel.unattributedPct}%, double counted ${panel.doubleCounted}`);
  for (const row of panel.byLabel.slice(0, 8)) log(`  ${row.pct.padStart(6)}%  ${row.shares.padStart(16)} shares  ${row.label}`);
  for (const leaf of tree.leaves) log(`  leaf ${leaf.wallet} entitlement ${formatShares6(BigInt(leaf.entitlement))} shares`);
  log(`root ${tree.root}; content hash ${contentHash}`);
  for (const w of set.invariants.warnings) log(`warning: ${w}`);
  return action;
}

/** Rebuild an EntitlementSet (bigint fields) from entitlements.json, re-flagging registration against `registry`. */
export function reviveEntitlementSet(j: Record<string, unknown>, registry: Set<string>): EntitlementSet {
  const entries = (j.entries as { wallet: string; entitlement: string; rawTotal: string; breakdown: Record<string, unknown>[] }[]).map((e) => ({
    wallet: e.wallet,
    entitlement: BigInt(e.entitlement),
    rawTotal: BigInt(e.rawTotal),
    registered: registry.has(e.wallet),
    breakdown: e.breakdown.map((p) => ({ ...p, rawAttributed: BigInt(p.rawAttributed as string), ...(p.exposureRaw !== undefined ? { exposureRaw: BigInt(p.exposureRaw as string) } : {}) })) as EntitlementSet["entries"][number]["breakdown"]
  }));
  const unattributed = (j.unattributed as { container: string; program: string | null; label: string; raw: string }[]).map((u) => ({ ...u, raw: BigInt(u.raw) }));
  const attributedRaw = BigInt(j.attributedRaw as string);
  const unattributedRaw = BigInt(j.unattributedRaw as string);
  const supplyRaw = BigInt(j.supplyRaw as string);
  const inv = j.invariants as { ok: boolean; failures: string[]; warnings: string[] };
  return {
    actionId: j.actionId as string,
    mint: j.mint as string,
    snapshotSlotRequested: j.snapshotSlotRequested as number,
    snapshotSlotActual: j.snapshotSlotActual as number,
    snapshotTimestamp: j.snapshotTimestamp as number,
    multiplier: j.multiplier as string,
    multiplierSource: j.multiplierSource as string,
    decimals: j.decimals as number,
    supplyRaw,
    accountsScanned: j.accountsScanned as number,
    attributedRaw,
    unattributedRaw,
    unattributed,
    adaptersUsed: j.adaptersUsed as EntitlementSet["adaptersUsed"],
    entries,
    invariants: { ok: inv.ok, failures: inv.failures, warnings: inv.warnings, totals: { attributedRaw, unattributedRaw, accountsRaw: attributedRaw + unattributedRaw, supplyRaw } }
  };
}

export function actionIdBytes(action: ActionRecord): Uint8Array {
  return new Uint8Array(Buffer.from(action.actionIdHex, "hex"));
}

/** Create the action on-chain from the snapshotted record. Skips when the PDA already exists. */
export async function publish(store: ActionStore, id: string, log: Log, opts?: { metadataUri?: string; claimsWindowMinutes?: number }): Promise<ActionRecord> {
  const action = store.get(id);
  if (!action.snapshot) throw new Error(`${id} has no snapshot yet`);
  const client = clientFor(registrarKeypair());
  const actionId = actionIdBytes(action);
  const existing = await client.fetchAction(actionId);
  if (existing) {
    log(`action ${id} already published at ${existing.address.toBase58()}`);
    if (!action.onchain) {
      // The create transaction landed but its confirmation timed out before the record was saved: recover the signature.
      const sigs = await client.provider.connection.getSignaturesForAddress(existing.address, { limit: 20 });
      const createTx = sigs[sigs.length - 1]?.signature ?? "unknown";
      action.status = action.kind === "vote" ? "open" : existing.funded ? "funded" : "published";
      action.onchain = { actionPda: existing.address.toBase58(), createTx, vault: existing.vault.toBase58() };
      store.save(action);
      log(`recorded on-chain state for ${id} (create tx ${createTx})`);
    }
    return action;
  }
  const usdcMint = new PublicKey(demoInfo().usdcMint);
  const slot = await client.provider.connection.getSlot();
  const { signature, action: pda, vault } = await client.createAction({
    actionId,
    kind: action.kind,
    mint: new PublicKey(action.mint),
    usdcMint,
    snapshotSlot: BigInt(action.snapshot.slotActual),
    root: new Uint8Array(Buffer.from(action.snapshot.root, "hex")),
    contentHash: new Uint8Array(Buffer.from(action.snapshot.contentHash, "hex")),
    metadataUri: opts?.metadataUri ?? `/actions/${id}/entitlements.json`,
    totalEntitlement: BigInt(action.snapshot.totalEntitlement),
    ...(action.kind === "distribution" ? { amountPerShareMicro: BigInt(action.amountPerShareMicro ?? "0"), claimsCloseSlot: BigInt(slot + slotsFromNow(opts?.claimsWindowMinutes ?? 24 * 60)) } : {}),
    ...(action.kind === "vote" ? { questionHash: keccak_256(new TextEncoder().encode(action.question ?? "")), deadlineSlot: BigInt(action.deadlineSlot ?? slot + slotsFromNow(30)) } : {})
  });
  const publishedSlot = await client.provider.connection.getSlot();
  action.status = action.kind === "vote" ? "open" : "published";
  action.onchain = { actionPda: pda.toBase58(), createTx: signature, vault: vault.toBase58(), publishedSlot };
  store.save(action);
  log(`published ${id}: action ${pda.toBase58()}, vault ${vault.toBase58()}, tx ${signature}, slot ${publishedSlot}`);
  return action;
}

export async function fund(store: ActionStore, id: string, usdc: number, log: Log): Promise<ActionRecord> {
  const action = store.get(id);
  if (action.kind !== "distribution") throw new Error("only distributions are funded");
  const client = clientFor(registrarKeypair());
  const actionId = actionIdBytes(action);
  const before = await client.fetchAction(actionId);
  if (!before) throw new Error(`${id} is not published`);
  if (before.funded) {
    log(`action ${id} is already funded; claims are open`);
    if (action.status !== "funded") {
      action.status = "funded";
      store.save(action);
    }
    return action;
  }
  const micro = BigInt(Math.round(usdc * 1_000_000));
  const sig = await client.fundDistribution(actionId, micro);
  const after = await client.fetchAction(actionId);
  action.status = after?.funded ? "funded" : "published";
  action.onchain = { ...(action.onchain as NonNullable<ActionRecord["onchain"]>), fundTx: sig };
  store.save(action);
  const required = (before.totalEntitlement * before.amountPerShareMicro) / 1_000_000n;
  log(`funded ${id} with ${usdc} USDC from the demo wallet (tx ${sig}); required ${Number(required) / 1e6} USDC; claims ${after?.funded ? "open" : "still underfunded"}`);
  return action;
}

export interface ProofRecord {
  wallet: string;
  entitlement: string;
  leaf: string;
  proof: string[];
}

export function proofFor(store: ActionStore, id: string, wallet: string): { root: string; leaf: ProofRecord } | null {
  const tree = store.readJson<{ root: string; leaves: ProofRecord[] }>(id, "tree.json");
  const leaf = tree.leaves.find((l) => l.wallet === wallet);
  return leaf ? { root: tree.root, leaf } : null;
}

export async function usdcBalance(owner: PublicKey, usdcMint: PublicKey, connection = forkConnection()): Promise<bigint> {
  const program = (await connection.getAccountInfo(usdcMint))?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const ata = getAssociatedTokenAddressSync(usdcMint, owner, false, program);
  const bal = await connection.getTokenAccountBalance(ata).catch(() => null);
  return bal ? BigInt(bal.value.amount) : 0n;
}

export async function claim(store: ActionStore, id: string, keypair: Keypair, log: Log): Promise<{ signature: string | null; amountPaid: bigint; entitlement: bigint }> {
  const action = store.get(id);
  const client = clientFor(keypair);
  const actionId = actionIdBytes(action);
  const receipt = await client.fetchReceipt(actionId);
  if (receipt) {
    log(`${keypair.publicKey.toBase58()} already claimed ${Number(receipt.amountPaid) / 1e6} USDC on ${id}`);
    return { signature: null, amountPaid: receipt.amountPaid, entitlement: receipt.entitlement };
  }
  const p = proofFor(store, id, keypair.publicKey.toBase58());
  if (!p) throw new Error(`${keypair.publicKey.toBase58()} is not in the tree for ${id}`);
  const signature = await client.claim(actionId, BigInt(p.leaf.entitlement), p.leaf.proof.map((h) => new Uint8Array(Buffer.from(h, "hex"))));
  const after = await client.fetchReceipt(actionId);
  log(`claimed ${Number(after?.amountPaid ?? 0n) / 1e6} USDC for ${formatShares6(BigInt(p.leaf.entitlement))} shares (tx ${signature})`);
  return { signature, amountPaid: after?.amountPaid ?? 0n, entitlement: BigInt(p.leaf.entitlement) };
}

export async function vote(store: ActionStore, id: string, keypair: Keypair, choice: VoteChoice, log: Log): Promise<{ signature: string | null; entitlement: bigint }> {
  const action = store.get(id);
  const client = clientFor(keypair);
  const actionId = actionIdBytes(action);
  const receipt = await client.fetchReceipt(actionId);
  if (receipt) {
    log(`${keypair.publicKey.toBase58()} already voted ${receipt.choice} on ${id}`);
    return { signature: null, entitlement: receipt.entitlement };
  }
  const p = proofFor(store, id, keypair.publicKey.toBase58());
  if (!p) throw new Error(`${keypair.publicKey.toBase58()} is not in the tree for ${id}`);
  const signature = await client.castVote(actionId, BigInt(p.leaf.entitlement), p.leaf.proof.map((h) => new Uint8Array(Buffer.from(h, "hex"))), choice);
  log(`voted ${choice} with ${formatShares6(BigInt(p.leaf.entitlement))} votes (tx ${signature})`);
  return { signature, entitlement: BigInt(p.leaf.entitlement) };
}

export async function tally(store: ActionStore, id: string) {
  const action = store.get(id);
  const client = LookthroughClient.readOnly(forkConnection());
  const state = await client.fetchAction(actionIdBytes(action));
  if (!state) throw new Error(`${id} is not published`);
  return state;
}
