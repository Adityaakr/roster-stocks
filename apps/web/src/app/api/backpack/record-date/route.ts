import { suggestRecordDate } from "@lookthrough/resolver";
import { backpackClient, connection, errorJson, json } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Suggest a record date: the next US regular-session close that is not a holiday, plus the slot that is `minutes` out on the fork. */
export async function GET(req: Request) {
  const minutes = Number(new URL(req.url).searchParams.get("minutes") ?? "3");
  try {
    const bp = backpackClient();
    const [sessions, holidays] = await Promise.all([bp.marketSessions(), bp.marketHolidays()]);
    const s = suggestRecordDate(new Date(), sessions, holidays);
    let slot: number | null = null;
    try {
      slot = (await connection().getSlot()) + Math.ceil((minutes * 60_000) / 400);
    } catch {
      slot = null;
    }
    return json({ closeAt: s.closeAt.toISOString(), sessionName: s.sessionName, skipped: s.skipped, demoSlot: slot, minutes });
  } catch (err) {
    return errorJson(`Record-date suggestion unavailable: ${err instanceof Error ? err.message : err}`, 502);
  }
}
