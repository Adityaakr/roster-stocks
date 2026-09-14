import { json, store } from "@/lib/server";

export const dynamic = "force-dynamic";

/** All actions known to the registrar, newest first. */
export async function GET() {
  return json({ actions: store().list() });
}
