import { schedule } from "@lookthrough/registrar";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { demoMode, errorJson, forkReachable, FORK_DOWN_MESSAGE, json, store, keysDir } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!demoMode()) return errorJson("The issuer console signs with the demo registrar keypair; enable DEMO_MODE=1.", 403);
  if (!(await forkReachable())) return errorJson(FORK_DOWN_MESSAGE, 503);
  const body = (await req.json()) as { label: string; mint: string; symbol: string; kind: "distribution" | "vote"; inMinutes: number; usdcPerShare?: number; question?: string; deadlineMinutes?: number; title?: string; registry?: string[] };
  const regPath = path.join(keysDir(), "registry.json");
  const registry = body.registry ?? (existsSync(regPath) ? (JSON.parse(readFileSync(regPath, "utf8")) as string[]) : []);
  if (!body.label || !body.mint) return errorJson("label and mint are required");
  const lines: string[] = [];
  const record = await schedule(store(), { ...body, registry }, (m, d) => lines.push(d === undefined ? m : `${m} ${JSON.stringify(d)}`));
  return json({ action: record, lines });
}
