/**
 * ChainReader implementations.
 * - RpcReader: web3.js Connection with retries, batching, and an optional fallback URL for heavy calls.
 * - RecordingReader: wraps another reader and records every call so fixtures can be captured.
 * - ReplayReader: serves recorded calls from a fixture without network.
 */
import { Connection, PublicKey, type GetProgramAccountsFilter } from "@solana/web3.js";
import type { AccountFilter, Base58, ChainReader, RawAccount } from "@lookthrough/core";

export interface RpcReaderOptions {
  url: string;
  /** Used when the primary returns 429 or fails on getProgramAccounts. */
  fallbackUrl?: string;
  commitment?: "confirmed" | "finalized";
  logger?: (message: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, label: string, log: (m: string) => void, retries = 6): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /429|Too many requests|timed out|ECONNRESET|fetch failed|502|503|Unable to complete|Internal error|INTERNAL_ERROR/i.test(msg);
      if (!retryable || attempt >= retries) throw err;
      // public mainnet enforces a per-method budget over a ~10 s window, so back off in seconds, not milliseconds
      const backoff = Math.min(20_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
      log(`${label}: ${msg.slice(0, 120)}; retry in ${backoff}ms`);
      attempt += 1;
      await sleep(backoff);
    }
  }
}

function toRaw(pubkey: Base58, info: { owner: PublicKey; lamports: number; executable: boolean; data: Buffer } | null): RawAccount | null {
  if (!info) return null;
  return { pubkey, owner: info.owner.toBase58(), lamports: info.lamports, executable: info.executable, data: new Uint8Array(info.data) };
}

export class RpcReader implements ChainReader {
  readonly connection: Connection;
  private readonly fallback: Connection | undefined;
  private readonly log: (m: string) => void;
  private readonly commitment: "confirmed" | "finalized";
  private gpaUseFallback = false;

  constructor(opts: RpcReaderOptions) {
    this.commitment = opts.commitment ?? "confirmed";
    this.connection = new Connection(opts.url, { commitment: this.commitment });
    this.fallback = opts.fallbackUrl ? new Connection(opts.fallbackUrl, { commitment: this.commitment }) : undefined;
    this.log = opts.logger ?? (() => undefined);
  }

  getSlot(): Promise<number> {
    return withRetry(() => this.connection.getSlot(this.commitment), "getSlot", this.log);
  }

  getBlockTime(slot: number): Promise<number | null> {
    return withRetry(() => this.connection.getBlockTime(slot), "getBlockTime", this.log);
  }

  async getAccount(pubkey: Base58): Promise<RawAccount | null> {
    const info = await withRetry(() => this.connection.getAccountInfo(new PublicKey(pubkey), this.commitment), "getAccountInfo", this.log);
    return toRaw(pubkey, info);
  }

  async getMultipleAccounts(pubkeys: Base58[], dataSlice?: { offset: number; length: number }): Promise<(RawAccount | null)[]> {
    const out: (RawAccount | null)[] = [];
    for (let i = 0; i < pubkeys.length; i += 100) {
      const chunk = pubkeys.slice(i, i + 100);
      const infos = await withRetry(
        () =>
          this.connection.getMultipleAccountsInfo(
            chunk.map((k) => new PublicKey(k)),
            dataSlice ? { commitment: this.commitment, dataSlice } : { commitment: this.commitment }
          ),
        "getMultipleAccounts",
        this.log
      );
      infos.forEach((info, j) => out.push(toRaw(chunk[j] as Base58, info)));
    }
    return out;
  }

  async getTokenAccountsByOwner(owner: Base58, tokenProgram: Base58): Promise<RawAccount[]> {
    const res = await withRetry(() => this.connection.getTokenAccountsByOwner(new PublicKey(owner), { programId: new PublicKey(tokenProgram) }, this.commitment), "getTokenAccountsByOwner", this.log);
    return res.value.map(({ pubkey, account }) => toRaw(pubkey.toBase58(), account) as RawAccount);
  }

  async getProgramAccounts(programId: Base58, filters: AccountFilter[], dataSlice?: { offset: number; length: number }): Promise<RawAccount[]> {
    const run = async (conn: Connection) => {
      const res = await conn.getProgramAccounts(new PublicKey(programId), {
        commitment: this.commitment,
        filters: filters as GetProgramAccountsFilter[],
        ...(dataSlice ? { dataSlice } : {})
      });
      return res.map(({ pubkey, account }) => toRaw(pubkey.toBase58(), account) as RawAccount);
    };
    // Primary first; once it rejects a getProgramAccounts (keyed free tiers meter these by compute units) stay on the
    // fallback for the rest of the session rather than paying a failed attempt on every call.
    if (this.fallback && this.gpaUseFallback) return withRetry(() => run(this.fallback as Connection), "getProgramAccounts(fallback)", this.log, 8);
    try {
      return await withRetry(() => run(this.connection), "getProgramAccounts", this.log, this.fallback ? 0 : 8);
    } catch (err) {
      if (!this.fallback) throw err;
      this.log(`getProgramAccounts on primary failed (${err instanceof Error ? err.message.slice(0, 80) : err}); using the fallback RPC from now on`);
      this.gpaUseFallback = true;
      return withRetry(() => run(this.fallback as Connection), "getProgramAccounts(fallback)", this.log, 8);
    }
  }
}

/** Serialisable record of every read, keyed by method + JSON args. */
export interface ReaderRecording {
  capturedAt: string;
  calls: Record<string, unknown>;
}

const key = (method: string, args: unknown[]) => `${method}:${JSON.stringify(args)}`;

function serialiseAccount(a: RawAccount | null): unknown {
  return a ? { ...a, data: Buffer.from(a.data).toString("base64") } : null;
}
function deserialiseAccount(v: unknown): RawAccount | null {
  if (!v) return null;
  const o = v as Omit<RawAccount, "data"> & { data: string };
  return { ...o, data: new Uint8Array(Buffer.from(o.data, "base64")) };
}

export class RecordingReader implements ChainReader {
  readonly recording: ReaderRecording = { capturedAt: new Date().toISOString(), calls: {} };
  constructor(private readonly inner: ChainReader) {}

  private async record<T>(method: string, args: unknown[], fn: () => Promise<T>, ser: (v: T) => unknown): Promise<T> {
    const v = await fn();
    this.recording.calls[key(method, args)] = ser(v);
    return v;
  }
  getSlot() {
    return this.record("getSlot", [], () => this.inner.getSlot(), (v) => v);
  }
  getBlockTime(slot: number) {
    return this.record("getBlockTime", [slot], () => this.inner.getBlockTime(slot), (v) => v);
  }
  getAccount(pubkey: Base58) {
    return this.record("getAccount", [pubkey], () => this.inner.getAccount(pubkey), serialiseAccount);
  }
  getMultipleAccounts(pubkeys: Base58[], dataSlice?: { offset: number; length: number }) {
    return this.record("getMultipleAccounts", [pubkeys, dataSlice ?? null], () => this.inner.getMultipleAccounts(pubkeys, dataSlice), (v) => v.map(serialiseAccount));
  }
  getProgramAccounts(programId: Base58, filters: AccountFilter[], dataSlice?: { offset: number; length: number }) {
    return this.record("getProgramAccounts", [programId, filters, dataSlice ?? null], () => this.inner.getProgramAccounts(programId, filters, dataSlice), (v) =>
      v.map(serialiseAccount)
    );
  }
  getTokenAccountsByOwner(owner: Base58, tokenProgram: Base58) {
    return this.record("getTokenAccountsByOwner", [owner, tokenProgram], () => this.inner.getTokenAccountsByOwner(owner, tokenProgram), (v) => v.map(serialiseAccount));
  }
}

export class ReplayReader implements ChainReader {
  constructor(private readonly recording: ReaderRecording) {}
  private lookup<T>(method: string, args: unknown[]): T {
    const k = key(method, args);
    if (!(k in this.recording.calls)) throw new Error(`fixture has no recording for ${k.slice(0, 200)}`);
    return this.recording.calls[k] as T;
  }
  async getSlot() {
    return this.lookup<number>("getSlot", []);
  }
  async getBlockTime(slot: number) {
    return this.lookup<number | null>("getBlockTime", [slot]);
  }
  async getAccount(pubkey: Base58) {
    return deserialiseAccount(this.lookup("getAccount", [pubkey]));
  }
  async getMultipleAccounts(pubkeys: Base58[], dataSlice?: { offset: number; length: number }) {
    return this.lookup<unknown[]>("getMultipleAccounts", [pubkeys, dataSlice ?? null]).map(deserialiseAccount);
  }
  async getProgramAccounts(programId: Base58, filters: AccountFilter[], dataSlice?: { offset: number; length: number }) {
    return this.lookup<unknown[]>("getProgramAccounts", [programId, filters, dataSlice ?? null]).map((v) => deserialiseAccount(v) as RawAccount);
  }
  async getTokenAccountsByOwner(owner: Base58, tokenProgram: Base58) {
    return this.lookup<unknown[]>("getTokenAccountsByOwner", [owner, tokenProgram]).map((v) => deserialiseAccount(v) as RawAccount);
  }
}

/** Reads .env-style config for RPC URLs. */
export function rpcUrlsFromEnv(env: NodeJS.ProcessEnv = process.env): { mainnet: string; mainnetFallback: string; fork: string } {
  const publicMainnet = "https://api.mainnet-beta.solana.com";
  return {
    mainnet: env.MAINNET_RPC_URL || publicMainnet,
    mainnetFallback: publicMainnet,
    fork: env.FORK_RPC_URL || "http://127.0.0.1:8899"
  };
}
