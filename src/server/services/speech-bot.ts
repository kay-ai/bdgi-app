import "server-only";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash } from "@/lib/crypto";
import { normalisePhone } from "@/lib/phone";
import { providerFor } from "@/server/providers";
import { createAttemptFor, eligibility, MAX_AUDIO_BYTES, type Feedback } from "./speech";

/**
 * The WhatsApp voice-note coach (spec/12 §7). The webhook hands every inbound message here; this
 * finds the student, keeps the pending motion in `bot_state` (24 hours), turns a voice note into a
 * `speech_attempt` with channel `whatsapp`, and answers NEW, SCORE and STOP. The scorecard itself
 * goes back as `speech.result` when scoring finishes (processAttempt).
 */

export type BotInbound = {
  from: string;
  text?: string | null;
  audio?: { bytes: Uint8Array; contentType: string } | null;
  /** The provider's message id: a retried webhook with the same id is ignored. */
  providerMessageId?: string | null;
};

export type BotResult = { reply: string | null; attemptId?: string; personId?: string; duplicate?: boolean };

const PENDING_HOURS = 24;
const hub = () => `${process.env.APP_URL ?? ""}/app/coach`;

export const BOT_TEXT = {
  unknown: () => `Hello! This number is for BGDI students practising their speeches. We couldn't find a student with this phone number. Sign in to your Hub to practise: ${hub()}`,
  manyChildren: () => `Hello! More than one student uses this phone number, so we can't tell who is speaking. Please practise in the Hub instead: ${hub()}`,
  notEligible: (why: string) => `Speech practice isn't open for you on WhatsApp right now: ${why} You can see more in your Hub: ${hub()}`,
  prompt: (firstName: string, motion: string) => `Hi ${firstName}! Send a voice note of up to 2 minutes on this motion: "${motion}". Reply NEW for a different motion.`,
  received: (firstName: string) => `Thank you, ${firstName}! Your coach is listening to your speech. Your scorecard will arrive here in about a minute.`,
  noScore: () => `You don't have a scorecard yet. Send a voice note and your coach will score it.`,
  score: (stars: number, strength: string, next: string, link: string) => `Your last speech: ${"★".repeat(stars)}${"☆".repeat(5 - stars)}\nWell done: ${strength}\nNext time: ${next}\nFull scorecard: ${link}`,
  stopped: () => `OK, we've cleared your motion. Send a voice note or NEW whenever you want to practise again.`,
  tooLong: () => `That voice note is too long. Please keep your speech to 2 minutes and send it again.`,
  busy: () => `Your last speech is still being scored. Wait a minute, then send the next one.`,
  failed: () => `Sorry, we couldn't take that voice note. Please try again in a moment.`,
};

const WHY: Record<string, string> = {
  disabled: "practice is paused for everyone at the moment.",
  not_student: "practice is for BGDI students.",
  not_ready: "it opens once your sign-up is complete and your guardian has given permission.",
  no_consent: "your parent or guardian needs to allow AI speech practice first.",
  cap: "you've used all your speeches for this month. More open on the 1st.",
};

/** The student behind a phone number: herself, or the only child of a guardian using that phone. */
async function studentFor(phone: string): Promise<{ personId: string; firstName: string } | "unknown" | "many"> {
  const people = await db
    .select({ id: s.person.id, firstName: s.person.firstName })
    .from(s.person)
    .where(and(eq(s.person.phoneHash, lookupHash(phone)), isNull(s.person.deletedAt)));
  if (!people.length) return "unknown";
  const ids = people.map((p) => p.id);
  const students = await db
    .select({ id: s.personRole.personId })
    .from(s.personRole)
    .where(and(inArray(s.personRole.personId, ids), eq(s.personRole.role, "student"), isNull(s.personRole.revokedAt)));
  if (students.length === 1) return { personId: students[0]!.id, firstName: people.find((p) => p.id === students[0]!.id)!.firstName };
  if (students.length > 1) return "many";
  const children = await db
    .select({ id: s.person.id, firstName: s.person.firstName })
    .from(s.guardianLink)
    .innerJoin(s.person, eq(s.person.id, s.guardianLink.studentId))
    .where(and(inArray(s.guardianLink.guardianId, ids), isNull(s.person.deletedAt)));
  if (children.length === 1) return { personId: children[0]!.id, firstName: children[0]!.firstName };
  return children.length > 1 ? "many" : "unknown";
}

async function pendingMotion(personId: string, now: Date) {
  const [b] = await db
    .select({ motionId: s.botState.motionId, text: s.motion.textEn, expiresAt: s.botState.expiresAt })
    .from(s.botState)
    .leftJoin(s.motion, eq(s.motion.id, s.botState.motionId))
    .where(eq(s.botState.personId, personId));
  return b && b.expiresAt > now && b.motionId && b.text ? { id: b.motionId, text: b.text } : null;
}

/** A fresh motion, never the one she just had; starter motions first for her first tries. */
async function newMotion(personId: string, now: Date) {
  const current = await pendingMotion(personId, now);
  const [m] = await db
    .select({ id: s.motion.id, text: s.motion.textEn })
    .from(s.motion)
    .where(and(eq(s.motion.isActive, true), current ? ne(s.motion.id, current.id) : sql`true`))
    .orderBy(sql`random()`)
    .limit(1);
  if (!m) return null;
  const expiresAt = new Date(now.getTime() + PENDING_HOURS * 3600_000);
  await db
    .insert(s.botState)
    .values({ personId, motionId: m.id, expiresAt })
    .onConflictDoUpdate({ target: s.botState.personId, set: { motionId: m.id, expiresAt, updatedAt: now } });
  return m;
}

async function lastScore(personId: string) {
  const [a] = await db
    .select({ id: s.speechAttempt.id, stars: s.speechAttempt.overallStars, feedback: s.speechAttempt.feedback })
    .from(s.speechAttempt)
    .where(and(eq(s.speechAttempt.personId, personId), eq(s.speechAttempt.status, "done")))
    .orderBy(desc(s.speechAttempt.createdAt))
    .limit(1);
  if (!a || !a.stars) return null;
  const f = a.feedback as Feedback | null;
  return BOT_TEXT.score(a.stars, f?.strengths[0] ?? "", f?.nextSteps[0] ?? "", `${process.env.APP_URL ?? ""}/app/coach/attempt/${a.id}`);
}

export async function handleBotMessage(inbound: BotInbound, now = new Date()): Promise<BotResult> {
  const phone = normalisePhone(inbound.from);
  // Every inbound message is logged (body encrypted); a webhook retry with the same id stops here.
  const eventKey = inbound.providerMessageId ? `wa-in:${inbound.providerMessageId}` : null;
  const who = phone ? await studentFor(phone) : "unknown";
  const personId = typeof who === "object" ? who.personId : null;
  const logged = await db
    .insert(s.message)
    .values({
      direction: "inbound",
      personId,
      toAddress: encrypt(phone ?? inbound.from),
      channel: "whatsapp",
      templateKey: "bot.inbound",
      bodyRendered: encrypt(inbound.audio ? "[voice note]" : (inbound.text ?? "").slice(0, 1000)),
      status: "delivered",
      eventKey,
      deliveredAt: now,
    })
    .onConflictDoNothing({ target: s.message.eventKey })
    .returning({ id: s.message.id });
  if (eventKey && !logged.length) return { reply: null, duplicate: true };

  if (who === "unknown") return { reply: BOT_TEXT.unknown() };
  if (who === "many") return { reply: BOT_TEXT.manyChildren() };
  const { firstName } = who;
  const id = who.personId;
  const command = (inbound.text ?? "").trim().toUpperCase();

  if (!inbound.audio && command === "STOP") {
    await db.delete(s.botState).where(eq(s.botState.personId, id));
    return { reply: BOT_TEXT.stopped(), personId: id };
  }
  if (!inbound.audio && command === "SCORE") return { reply: (await lastScore(id)) ?? BOT_TEXT.noScore(), personId: id };

  const e = await eligibility(id, now);
  if (!e.ok) return { reply: BOT_TEXT.notEligible(WHY[e.reason] ?? ""), personId: id };

  if (!inbound.audio) {
    const m = command === "NEW" ? await newMotion(id, now) : ((await pendingMotion(id, now)) ?? (await newMotion(id, now)));
    return { reply: m ? BOT_TEXT.prompt(firstName, m.text) : BOT_TEXT.failed(), personId: id };
  }

  if (inbound.audio.bytes.byteLength > MAX_AUDIO_BYTES) return { reply: BOT_TEXT.tooLong(), personId: id };
  // A voice note with no pending motion is an open speech (spec/12 §7 step 2).
  const motion = await pendingMotion(id, now);
  const r = await createAttemptFor(
    { actor: null, locale: "en", ip: null, userAgent: "whatsapp" },
    id,
    { audio: inbound.audio.bytes, contentType: inbound.audio.contentType, durationHint: 60, kind: "free", motionId: motion?.id ?? null, side: motion ? "for" : "open" },
    "whatsapp",
  );
  if (!r.ok) {
    const reply = r.code === "busy" ? BOT_TEXT.busy() : r.code === "too_large" ? BOT_TEXT.tooLong() : WHY[r.code] ? BOT_TEXT.notEligible(WHY[r.code]!) : BOT_TEXT.failed();
    return { reply, personId: id };
  }
  await db.delete(s.botState).where(eq(s.botState.personId, id));
  return { reply: BOT_TEXT.received(firstName), attemptId: r.id, personId: id };
}

/**
 * Free-text reply inside WhatsApp's 24-hour window (spec/12 §7 step 4). Logged like any message;
 * with no WhatsApp provider set up it goes to the console adapter.
 */
export async function sendBotReply(to: string, body: string, personId: string | null) {
  const phone = normalisePhone(to) ?? to;
  let status: "sent" | "failed" = "failed";
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    const r = await providerFor("whatsapp").send({ to: phone, body });
    if (r.ok) {
      status = "sent";
      providerId = r.providerId;
    } else error = r.error;
  } catch (e) {
    error = e instanceof Error ? e.message : "send failed";
  }
  await db.insert(s.message).values({
    direction: "outbound",
    personId,
    toAddress: encrypt(phone),
    channel: "whatsapp",
    templateKey: "bot.reply",
    bodyRendered: encrypt(body),
    status,
    providerId,
    error,
    sentAt: status === "sent" ? new Date() : null,
  });
  return status === "sent";
}
