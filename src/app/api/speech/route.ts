import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getActor, requestMeta } from "@/server/auth/current";
import { hit } from "@/server/services/rate-limit";
import { createAttempt, MAX_AUDIO_BYTES, processAttempt } from "@/server/services/speech";

export const dynamic = "force-dynamic";
// Transcribing and scoring run after the response; Amazon Transcribe can take up to 90 s.
export const maxDuration = 120;

const fields = z.object({
  kind: z.enum(["placement", "lesson", "free"]),
  lessonKey: z.string().max(40).optional().nullable(),
  motionId: z.string().uuid().optional().nullable(),
  side: z.enum(["for", "against", "open"]).optional(),
  duration: z.coerce.number().min(0).max(600),
});

/** A student sends a recording to the coach (spec/12 §2 step 4). Scoring continues after the reply. */
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!(await hit(`speech:${actor.personId}`, 30, 3600))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_AUDIO_BYTES + 64 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const parsed = fields.safeParse({
    kind: form?.get("kind"),
    lessonKey: form?.get("lessonKey") || null,
    motionId: form?.get("motionId") || null,
    side: form?.get("side") || undefined,
    duration: form?.get("duration"),
  });
  if (!(audio instanceof Blob) || !parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const meta = await requestMeta();
  const res = await createAttempt(
    { actor, locale: "en", ip: meta.ip, userAgent: meta.userAgent },
    { ...parsed.data, durationHint: parsed.data.duration, audio: new Uint8Array(await audio.arrayBuffer()), contentType: audio.type || "audio/webm" },
  );
  if (!res.ok) {
    const status = res.code === "forbidden" ? 403 : res.code === "too_large" ? 413 : res.code === "busy" ? 409 : res.code === "invalid" ? 400 : 403;
    return NextResponse.json({ error: res.code }, { status });
  }
  after(() => processAttempt(res.id));
  return NextResponse.json({ id: res.id }, { status: 201 });
}
