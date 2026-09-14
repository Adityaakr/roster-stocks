import { errorJson, getJob, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return errorJson("No such job. The dev server may have restarted; run the snapshot again.", 404);
  return json({ job });
}
