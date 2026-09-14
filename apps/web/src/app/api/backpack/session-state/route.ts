import { marketSessionState } from "@lookthrough/resolver";
import { backpackClient, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bp = backpackClient();
    const [sessions, holidays] = await Promise.all([bp.marketSessions(), bp.marketHolidays()]);
    return json(marketSessionState(new Date(), sessions, holidays));
  } catch (err) {
    return json({ open: false, session: null, label: `Backpack sessions unavailable: ${err instanceof Error ? err.message : err}` }, { status: 200 });
  }
}
