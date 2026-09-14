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
process.env.LOOKTHROUGH_KEYS_DIR ??= path.join(root, ".keys");
if (!process.env.REGISTRAR_KEYPAIR_PATH && existsSync(path.join(root, ".keys/registrar.json"))) process.env.REGISTRAR_KEYPAIR_PATH = path.join(root, ".keys/registrar.json");
// load the repo .env for route handlers started from apps/web
try {
  const env = readFileSync(path.join(root, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2] ?? "";
  }
} catch {
  // no .env, fine
}

export const dataDir = path.join(root, "apps/web/public/data");
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
