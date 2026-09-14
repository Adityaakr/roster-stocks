import { demoMode, errorJson, forkReachable, FORK_DOWN_MESSAGE, json, startSnapshotJob, store } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Start the record-date snapshot for an action as a background job; poll /api/registrar/jobs/[id]. */
export async function POST(req: Request) {
  if (!demoMode()) return errorJson("The issuer console runs the registrar; enable DEMO_MODE=1.", 403);
  if (!(await forkReachable())) return errorJson(FORK_DOWN_MESSAGE, 503);
  const body = (await req.json()) as { actionId: string; reuseFrom?: string };
  try {
    store().get(body.actionId);
  } catch {
    return errorJson(`No action named ${body.actionId}.`, 404);
  }
  const job = startSnapshotJob(body.actionId, body.reuseFrom);
  return json({ job });
}
