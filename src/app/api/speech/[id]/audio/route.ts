import { NextResponse } from "next/server";
import { getActor } from "@/server/auth/current";
import { hit } from "@/server/services/rate-limit";
import { feedbackAudio } from "@/server/services/speech";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * "Listen to feedback" (spec/12 §6): the scorecard's encouragement, strengths and next steps read
 * aloud. Synthesised once and kept at `speech-tts/{id}.mp3` (the bucket's 1-day rule removes it).
 * 404 `no_tts` means no voice service is set up; the page then uses the phone's own voice.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!(await hit(`speech-tts:${actor.personId}`, 30, 3600))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const r = await feedbackAudio(actor, id);
  if (!r.ok) return NextResponse.json({ error: r.code }, { status: r.code === "failed" ? 502 : 404 });
  return new NextResponse(Buffer.from(r.audio), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400", "Content-Length": String(r.audio.byteLength) },
  });
}
