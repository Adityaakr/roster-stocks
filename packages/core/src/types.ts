/**
 * Shared types for the resolver, adapters and CLI. Addresses are base58 strings everywhere;
 * conversion to PublicKey (web3.js) or Address (kit) happens at the edges.
 */

export type Base58 = string;

/** One attribution of raw token units from a container to a beneficiary wallet. */
export interface EntitlementPosition {
  /** Beneficiary wallet (on-curve). */
  wallet: Base58;
  mint: Base58;
  source: "direct" | "raydium_clmm" | "kamino_lend" | string;
  /** The program-owned (or wallet-owned, for direct) token account that physically holds the tokens. */
  container: Base58;
  /** Raw token units attributed to this wallet from this container. */
  rawAttributed: bigint;
  /** Optional economic exposure if it differs from what is physically held (lending exchange rate). */
  exposureRaw?: bigint;
  /** Id of the issuer-defined pass-through rule applied. */
  ruleApplied: string;
  /** Account keys and figures used, shown on the proof page. */
  evidence: Record<string, unknown>;
}

/** A program-held token account that an adapter knows how to look through. */
export interface ContainerInfo {
  address: Base58;
  adapterId: string;
  /** Program that owns the container's owner (or the venue program), for labels. */
  program: Base58;
  label: string;
  /** Adapter-specific evidence (pool id, reserve id, ...). The resolver sets `balanceRaw` (string) before calling resolve. */
  meta: Record<string, unknown>;
}

export interface AccountFilterMemcmp {
  memcmp: { offset: number; bytes: Base58 };
}
export interface AccountFilterDataSize {
  dataSize: number;
}
export type AccountFilter = AccountFilterMemcmp | AccountFilterDataSize;

export interface RawAccount {
  pubkey: Base58;
  owner: Base58;
  lamports: number;
  executable: boolean;
  /** Raw account data (possibly a data slice, when requested). */
  data: Uint8Array;
}

/**
 * Minimal chain read interface. Implemented by the RPC reader and by the fixture replay reader,
 * so adapters and the resolver run identically online and offline.
 */
export interface ChainReader {
  getSlot(): Promise<number>;
  getBlockTime(slot: number): Promise<number | null>;
  getAccount(pubkey: Base58): Promise<RawAccount | null>;
  getMultipleAccounts(pubkeys: Base58[], dataSlice?: { offset: number; length: number }): Promise<(RawAccount | null)[]>;
  getProgramAccounts(programId: Base58, filters: AccountFilter[], dataSlice?: { offset: number; length: number }): Promise<RawAccount[]>;
}

export interface MultiplierInfo {
  /** Effective multiplier at the snapshot timestamp, as a decimal string (shortest round trip of the on-chain f64). */
  multiplier: string;
  /** Where the multiplier came from. */
  source: "scaled_ui_amount.multiplier" | "scaled_ui_amount.new_multiplier" | "none";
  /** Raw extension fields when present. */
  config?: { authority: Base58; multiplier: string; newMultiplier: string; newMultiplierEffectiveTimestamp: string };
}

export interface MintInfo {
  mint: Base58;
  tokenProgram: Base58;
  decimals: number;
  supplyRaw: bigint;
  multiplier: MultiplierInfo;
}

/** Issuer-defined pass-through rules, loaded from rules.json. */
export interface PassThroughRules {
  version: number;
  rules: Record<string, { id: string; description: string }>;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
}

export interface SnapshotContext {
  reader: ChainReader;
  /** The record slot the registrar scheduled. */
  slotRequested: number;
  /** The slot at which the reads were actually served. */
  slotActual: number;
  timestamp: number;
  mintInfo: MintInfo;
  /** Registered wallets. Entitlements are computed for all wallets and filtered to this set for the tree. */
  registry: Set<Base58>;
  rules: PassThroughRules;
  log: Logger;
  /** Adapters report labelled sub-balances they cannot attribute (protocol fees, positions held by PDAs, rounding). */
  reportUnattributed: (row: UnattributedRow) => void;
}

export interface PositionAdapter {
  readonly id: string;
  readonly status: "implemented" | "stub";
  /** Program-held token accounts for the mint this adapter can look through (or at least label). */
  discoverContainers(mint: Base58, ctx: SnapshotContext): Promise<ContainerInfo[]>;
  /** Attribute a container's balance to wallets. Only called when status is "implemented". */
  resolve(container: ContainerInfo, mint: Base58, ctx: SnapshotContext): Promise<EntitlementPosition[]>;
}

export interface TokenAccountRow {
  pubkey: Base58;
  owner: Base58;
  amountRaw: bigint;
}

export interface UnattributedRow {
  container: Base58;
  program: Base58 | null;
  label: string;
  raw: bigint;
}
