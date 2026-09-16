/**
 * Server-only helpers for route handlers: repo paths, the action store, connections, caches and the snapshot job runner.
 * Secrets (TOKENS_API_KEY, keypairs) never leave this module's callers.
 */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Connection } from "@solana/web3.js";
import { ActionStore } from "@lookthrough/resolver";
import { BackpackClient, RpcReader, TokensClient, rpcUrlsFromEnv } from "@lookthrough/datasources";
import { snapshot as runSnapshotJob, type Log } from "@lookthrough/registrar";

/** apps/web is the Next cwd in dev; walk up to the repo root (the directory holding pnpm-workspace.yaml). */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const root = repoRoot();
// load the repo .env (and .env.<LOOKTHROUGH_ENV> on top) for route handlers started from apps/web
const fromFiles: Record<string, string> = {};
for (const f of [".env", ...(process.env.LOOKTHROUGH_ENV ? [`.env.${process.env.LOOKTHROUGH_ENV}`] : [])]) {
  try {
    for (const line of readFileSync(path.join(root, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1]) fromFiles[m[1]] = m[2] ?? "";
    }
  } catch {
    // no file, fine
  }
}
for (const [k, v] of Object.entries(fromFiles)) if (process.env[k] === undefined) process.env[k] = v;
// Key paths are relative to the repo root, not to apps/web.
process.env.LOOKTHROUGH_KEYS_DIR = path.resolve(root, process.env.LOOKTHROUGH_KEYS_DIR ?? ".keys");
process.env.REGISTRAR_KEYPAIR_PATH = path.resolve(root, process.env.REGISTRAR_KEYPAIR_PATH ?? path.join(process.env.LOOKTHROUGH_KEYS_DIR, "registrar.json"));

/** Absolute keys directory for the active profile (.keys on the fork, .keys/devnet on devnet). */
export function keysDir(): string {
  return process.env.LOOKTHROUGH_KEYS_DIR as string;
}

/** "fork" (surfpool mainnet fork, the default) or "devnet". */
export function cluster(): "fork" | "devnet" {
  return process.env.NEXT_PUBLIC_CLUSTER === "devnet" ? "devnet" : "fork";
}

export const dataDir = process.env.LOOKTHROUGH_DATA_DIR ? path.resolve(root, process.env.LOOKTHROUGH_DATA_DIR) : path.join(root, "apps/web/public/data");
export const actionsDir = path.join(dataDir, "actions");

export function store(): ActionStore {
  return new ActionStore(actionsDir);
}

export function forkUrl(): string {
  return rpcUrlsFromEnv().fork;
}

export function connection(): Connection {
  return new Connection(forkUrl(), "confirmed");
}

export function reader(log?: (m: string) => void): RpcReader {
  return new RpcReader({ url: forkUrl(), logger: log ?? (() => undefined) });
}

export function demoMode(): boolean {
  return process.env.DEMO_MODE === "1" || process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

export function readVisibility(mint: string): Record<string, unknown> | null {
  const p = path.join(dataDir, "visibility", `${mint}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>) : null;
}

let backpack: BackpackClient | null = null;
export function backpackClient(): BackpackClient {
  backpack ??= new BackpackClient({ cacheTtlMs: 60_000 });
  return backpack;
}

let tokens: TokensClient | null | undefined;
/** null when TOKENS_API_KEY is not configured. */
export function tokensClient(): TokensClient | null {
  if (tokens !== undefined) return tokens;
  const key = process.env.TOKENS_API_KEY;
  tokens = key ? new TokensClient({ apiKey: key, cacheTtlMs: 60_000, logger: (m) => console.error(`[tokens] ${m}`) }) : null;
  return tokens;
}

export async function forkReachable(): Promise<boolean> {
  try {
    await connection().getSlot();
    return true;
  } catch {
    return false;
  }
}

export const FORK_DOWN_MESSAGE = `Couldn't reach the fork at ${forkUrl().replace(/^https?:\/\//, "")}. Start it with pnpm fork.`;

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
}

export function errorJson(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ error: message, ...(extra ?? {}) }, { status });
}

// Snapshot jobs (one per action, in memory; the dev server is a single process).
export interface SnapshotJob {
  id: string;
  actionId: string;
  status: "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  lines: string[];
  progress: Record<string, unknown>;
  error?: string;
}
const jobs = new Map<string, SnapshotJob>();

export function getJob(id: string): SnapshotJob | undefined {
  return jobs.get(id);
}

export function startSnapshotJob(actionId: string, reuseFrom?: string): SnapshotJob {
  const existing = [...jobs.values()].find((j) => j.actionId === actionId && j.status === "running");
  if (existing) return existing;
  const job: SnapshotJob = { id: `${actionId}-${Date.now()}`, actionId, status: "running", startedAt: new Date().toISOString(), lines: [], progress: {} };
  jobs.set(job.id, job);
  const log: Log = (m, data) => {
    job.lines.push(data === undefined ? m : `${m} ${JSON.stringify(data)}`);
    if (job.lines.length > 400) job.lines.splice(0, job.lines.length - 400);
  };
  runSnapshotJob(store(), actionId, log, {
    ...(reuseFrom ? { reuseFrom } : {}),
    onProgress: (step, data) => {
      job.progress[step] = data ?? true;
    }
  })
    .then(() => {
      job.status = "done";
      job.finishedAt = new Date().toISOString();
    })
    .catch((err: unknown) => {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.finishedAt = new Date().toISOString();
    });
  return job;
}
