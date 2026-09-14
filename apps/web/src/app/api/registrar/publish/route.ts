import { publish } from "@lookthrough/registrar";
import { demoMode, errorJson, forkReachable, FORK_DOWN_MESSAGE, json, store } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!demoMode()) return errorJson("Publishing signs with the demo registrar keypair; enable DEMO_MODE=1.", 403);
  if (!(await forkReachable())) return errorJson(FORK_DOWN_MESSAGE, 503);
  const body = (await req.json()) as { actionId: string };
  const lines: string[] = [];
  try {
    const record = await publish(store(), body.actionId, (m, d) => lines.push(d === undefined ? m : `${m} ${JSON.stringify(d)}`), { metadataUri: `/actions/${body.actionId}/entitlements.json` });
    return json({ action: record, lines });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : String(err), 422, { lines });
  }
}
