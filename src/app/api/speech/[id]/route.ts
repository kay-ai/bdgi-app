import { NextResponse } from "next/server";
import { getActor } from "@/server/auth/current";
import { getAttempt } from "@/server/services/speech";

export const dynamic = "force-dynamic";

/** Polled every 3 s by the waiting screen (spec/12 §2 step 5). Only the student who spoke can read it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await params;
  const a = await getAttempt(actor, id);
  if (!a) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ status: a.status, rejectReason: a.rejectReason }, { headers: { "Cache-Control": "no-store" } });
}
