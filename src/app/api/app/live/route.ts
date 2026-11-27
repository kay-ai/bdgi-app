import { NextResponse } from "next/server";
import { getActor } from "@/server/auth/current";
import { liveSessionFor } from "@/server/services/sessions";

export const dynamic = "force-dynamic";

/** GET /api/app/live: the id of the live session in one of her groups, or null (D-025). The Hub asks every 30 seconds. */
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const live = await liveSessionFor(actor.personId);
  return NextResponse.json({ id: live?.id ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
