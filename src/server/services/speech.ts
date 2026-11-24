import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { LESSON, PLACEMENT, SKILL, SKILLS, type Lesson, type SkillKey } from "@/server/coach/curriculum";
import { computeMetrics, deliveryBars, overallStars, rejectReason, type DeliveryBars, type Metrics } from "@/server/coach/metrics";
import { COACH_JSON_SCHEMA, coachOutput, fallbackFeedback, PROMPT_VERSION, SYSTEM_PROMPT, userMessage, type CoachOutput } from "@/server/coach/prompt";
import { deliveryScores, nextLesson, passedLesson, rankFor, updateRatings, weakest, type Ratings } from "@/server/coach/tailor";
import type { Actor } from "@/server/permissions/can";
import { scorer, transcriber } from "@/server/providers/speech";
import { speaker } from "@/server/providers/tts";
import { reach } from "./reach";
import { storage } from "@/server/providers/storage";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";

/**
 * The speech coach (spec/12, extended with a tailored lesson path: DECISIONS.md D-015).
 * Flow: createAttempt stores the recording → processAttempt transcribes, measures, scores,
 * updates the student's skill ratings and lesson progress, then deletes the recording.
 */

export type CoachSettings = { enabled: boolean; cap: number; maxSeconds: number; minSeconds: number; anchors: string };
export const AI_SETTING_KEYS = ["ai_enabled", "ai_monthly_attempt_cap", "ai_max_seconds", "ai_min_seconds", "ai_rubric_anchors"] as const;

/** The coach's settings (spec/12 §5), with safe defaults for any row that isn't there yet. */
export async function coachSettings(): Promise<CoachSettings> {
  const rows = await db.select().from(s.setting).where(inArray(s.setting.key, [...AI_SETTING_KEYS]));
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: v.ai_enabled !== false,
    cap: Number(v.ai_monthly_attempt_cap ?? 20),
    maxSeconds: Number(v.ai_max_seconds ?? 150),
    minSeconds: Number(v.ai_min_seconds ?? 20),
    anchors: typeof v.ai_rubric_anchors === "string" ? v.ai_rubric_anchors : "",
  };
}
const settings = coachSettings;

/**
 * The group a speech is filed under, so the student's human coach can supervise it (D-015). It
 * never decides whether she may practise: the coach works with each student on her own.
 */
export async function currentCohortOf(personId: string): Promise<string | null> {
  const [r] = await db
    .select({ id: s.cohort.id })
    .from(s.cohortMember)
    .innerJoin(s.cohort, eq(s.cohort.id, s.cohortMember.cohortId))
    .where(and(eq(s.cohortMember.personId, personId), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn), isNull(s.cohort.deletedAt), isNull(s.cohort.closedAt)))
    .orderBy(desc(s.cohortMember.joinedOn))
    .limit(1);
  return r?.id ?? null;
}

const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** Attempts this month that count toward the cap: rejected and failed ones don't (spec/12 §3). */
async function usedThisMonth(personId: string, now = new Date()) {
  const [r] = await db
    .select({ n: count() })
    .from(s.speechAttempt)
    .where(and(eq(s.speechAttempt.personId, personId), gte(s.speechAttempt.createdAt, monthStart(now)), notInArray(s.speechAttempt.status, ["rejected", "failed"])));
  return r?.n ?? 0;
}

export type Eligibility =
  | { ok: true; left: number; cap: number; maxSeconds: number; minSeconds: number }
  | { ok: false; reason: "disabled" | "not_student" | "not_ready" | "no_consent" | "cap"; cap?: number };

/**
 * Who may practise (spec/12 §1): the kill switch is on; the person is a student whose sign-up is
 * complete (pending review or active, CONFIRM in D-015); `ai_practice` consent is given and not
 * withdrawn, or they were 18+ at sign-up; and this month's attempts are under the cap. Her group
 * plays no part: each student is coached on her own (D-015).
 */
export async function eligibility(personId: string, now = new Date()): Promise<Eligibility> {
  const st = await settings();
  if (!st.enabled) return { ok: false, reason: "disabled" };
  const [p] = await db.select({ status: s.person.status, age: s.person.ageAtSignup }).from(s.person).where(eq(s.person.id, personId));
  const [isStudent] = await db
    .select({ id: s.personRole.id })
    .from(s.personRole)
    .where(and(eq(s.personRole.personId, personId), eq(s.personRole.role, "student"), isNull(s.personRole.revokedAt)))
    .limit(1);
  if (!p || !isStudent) return { ok: false, reason: "not_student" };
  if (p.status !== "active" && p.status !== "pending_review") return { ok: false, reason: "not_ready" };
  if ((p.age ?? 0) < 18) {
    const [c] = await db
      .select({ id: s.consent.id })
      .from(s.consent)
      .where(and(eq(s.consent.studentId, personId), eq(s.consent.type, "ai_practice"), sql`${s.consent.givenAt} is not null`, isNull(s.consent.withdrawnAt)))
      .limit(1);
    if (!c) return { ok: false, reason: "no_consent" };
  }
  const used = await usedThisMonth(personId, now);
  if (used >= st.cap) return { ok: false, reason: "cap", cap: st.cap };
  return { ok: true, left: st.cap - used, cap: st.cap, maxSeconds: st.maxSeconds, minSeconds: st.minSeconds };
}

/* ---------- The student's path ---------- */

async function ratingsFor(personId: string): Promise<Ratings> {
  const rows = await db.select({ k: s.coachSkill.skillKey, r: s.coachSkill.rating }).from(s.coachSkill).where(eq(s.coachSkill.personId, personId));
  return Object.fromEntries(rows.map((x) => [x.k, Number(x.r)])) as Ratings;
}

async function passedFor(personId: string) {
  const rows = await db
    .select({ k: s.coachLesson.lessonKey })
    .from(s.coachLesson)
    .where(and(eq(s.coachLesson.personId, personId), eq(s.coachLesson.status, "passed")));
  return new Set(rows.map((r) => r.k));
}

export type AttemptSummary = { id: string; kind: string; lessonKey: string | null; stars: number | null; status: string; createdAt: Date; title: string };

function titleFor(a: { kind: string; lessonKey: string | null; motion?: string | null }) {
  if (a.kind === "placement") return "Your first speech";
  if (a.kind === "lesson" && a.lessonKey && LESSON[a.lessonKey]) return LESSON[a.lessonKey]!.title;
  return a.motion ?? "Free practice";
}

/** Everything the coach home needs. */
export async function coachHome(personId: string) {
  const [ratings, passed, elig] = await Promise.all([ratingsFor(personId), passedFor(personId), eligibility(personId)]);
  const placed = Object.keys(ratings).length > 0;
  const recent = await db
    .select({
      id: s.speechAttempt.id,
      kind: s.speechAttempt.kind,
      lessonKey: s.speechAttempt.lessonKey,
      stars: s.speechAttempt.overallStars,
      status: s.speechAttempt.status,
      createdAt: s.speechAttempt.createdAt,
      motion: s.motion.textEn,
      metrics: s.speechAttempt.metrics,
    })
    .from(s.speechAttempt)
    .leftJoin(s.motion, eq(s.motion.id, s.speechAttempt.motionId))
    .where(eq(s.speechAttempt.personId, personId))
    .orderBy(desc(s.speechAttempt.createdAt))
    .limit(12);
  return {
    eligibility: elig,
    placed,
    ratings,
    passed: [...passed],
    next: placed ? nextLesson(ratings, passed) : null,
    rank: rankFor(ratings),
    recent: recent.map((r) => ({
      id: r.id,
      kind: r.kind,
      lessonKey: r.lessonKey,
      stars: r.stars,
      status: r.status,
      createdAt: r.createdAt,
      title: titleFor(r),
      wpm: (r.metrics as Metrics | null)?.wpm ?? null,
      fillersPerMin: (r.metrics as Metrics | null)?.fillersPerMin ?? null,
    })),
  };
}

/** "started" or "passed" for one lesson, or null if never tried. */
export async function lessonStatus(personId: string, lessonKey: string) {
  const [r] = await db
    .select({ status: s.coachLesson.status })
    .from(s.coachLesson)
    .where(and(eq(s.coachLesson.personId, personId), eq(s.coachLesson.lessonKey, lessonKey)));
  return r?.status ?? null;
}

export async function motionsFor(limit = 40) {
  return db.select({ id: s.motion.id, text: s.motion.textEn, difficulty: s.motion.difficulty }).from(s.motion).where(eq(s.motion.isActive, true)).limit(limit);
}

/* ---------- Creating an attempt ---------- */

const AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/x-m4a", "audio/aac"];
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

export type NewAttempt = {
  audio: Uint8Array;
  contentType: string;
  durationHint: number;
  kind: "placement" | "lesson" | "free";
  lessonKey?: string | null;
  motionId?: string | null;
  side?: "for" | "against" | "open";
};

export type CreateResult = { ok: true; id: string } | { ok: false; code: "forbidden" | "invalid" | "too_large" | "busy" | Exclude<Eligibility, { ok: true }>["reason"] };

export async function createAttempt(ctx: Ctx, input: NewAttempt): Promise<CreateResult> {
  const actor = ctx.actor;
  if (!actor || !actor.roles.some((r) => r.role === "student")) return { ok: false, code: "forbidden" };
  return createAttemptFor(ctx, actor.personId, input, "web");
}

/** Shared by the web upload and the WhatsApp bot (spec/12 §7 step 3: "run the same pipeline"). */
export async function createAttemptFor(ctx: Ctx, personId: string, input: NewAttempt, channel: "web" | "whatsapp"): Promise<CreateResult> {
  const baseType = input.contentType.split(";")[0]!.trim().toLowerCase();
  if (!AUDIO_TYPES.includes(baseType)) return { ok: false, code: "invalid" };
  if (input.audio.byteLength > MAX_AUDIO_BYTES) return { ok: false, code: "too_large" };
  if (input.audio.byteLength < 1000) return { ok: false, code: "invalid" };

  let side = input.side ?? "open";
  let motionId: string | null = null;
  let lessonKey: string | null = null;
  if (input.kind === "lesson") {
    const l = input.lessonKey ? LESSON[input.lessonKey] : undefined;
    if (!l) return { ok: false, code: "invalid" };
    lessonKey = l.key;
    side = l.drill.side;
  } else if (input.kind === "placement") {
    side = PLACEMENT.side;
  } else if (input.motionId) {
    const [m] = await db.select({ id: s.motion.id }).from(s.motion).where(and(eq(s.motion.id, input.motionId), eq(s.motion.isActive, true)));
    if (!m) return { ok: false, code: "invalid" };
    motionId = m.id;
  }

  const elig = await eligibility(personId);
  if (!elig.ok) return { ok: false, code: elig.reason };
  const cohortId = await currentCohortOf(personId);
  // One speech at a time: a second upload while one is still being scored is refused.
  const [busy] = await db
    .select({ id: s.speechAttempt.id })
    .from(s.speechAttempt)
    .where(and(eq(s.speechAttempt.personId, personId), inArray(s.speechAttempt.status, ["uploaded", "transcribing", "scoring"]), gte(s.speechAttempt.createdAt, new Date(Date.now() - 5 * 60_000))))
    .limit(1);
  if (busy) return { ok: false, code: "busy" };

  const [a] = await db
    .insert(s.speechAttempt)
    .values({ personId, cohortId, side, channel, kind: input.kind, lessonKey, motionId, durationSeconds: String(Math.round(input.durationHint)), status: "uploaded" })
    .returning({ id: s.speechAttempt.id });
  const ext = baseType.includes("mp4") || baseType.includes("m4a") || baseType.includes("aac") ? "m4a" : baseType.includes("ogg") ? "ogg" : baseType.includes("mpeg") ? "mp3" : "webm";
  const key = `speech/${a!.id}.${ext}`;
  await storage().put(key, input.audio, baseType);
  await db.update(s.speechAttempt).set({ audioKey: key, metrics: { contentType: baseType } }).where(eq(s.speechAttempt.id, a!.id));
  await audit(db, ctx, { action: "speech.create", entityType: "speech_attempt", entityId: a!.id, subjectPersonId: personId, meta: { kind: input.kind, lessonKey, channel } });
  return { ok: true, id: a!.id };
}

/* ---------- Scoring ---------- */

async function askModel(input: Parameters<typeof userMessage>[0]): Promise<{ out: CoachOutput | null; model: string; tokensIn: number; tokensOut: number }> {
  const sc = scorer();
  let tokensIn = 0;
  let tokensOut = 0;
  let model = sc.name;
  // One retry on an unusable answer, then fixed sentences (spec/12 §3).
  for (let i = 0; i < 2; i++) {
    try {
      const r = await sc.complete({ system: SYSTEM_PROMPT, user: userMessage(input), schemaName: "coach_feedback", schema: COACH_JSON_SCHEMA });
      tokensIn += r.tokensIn;
      tokensOut += r.tokensOut;
      model = r.model;
      const parsed = coachOutput.safeParse(JSON.parse(r.text));
      if (parsed.success) return { out: parsed.data, model, tokensIn, tokensOut };
      console.warn("[speech] model reply did not match the schema");
    } catch (e) {
      console.warn("[speech] scoring call failed:", e instanceof Error ? e.message : "unknown");
    }
  }
  return { out: null, model, tokensIn, tokensOut };
}

export type Feedback = {
  strengths: string[];
  nextSteps: string[];
  encouragement: string;
  betterLine: { original: string; improved: string; why: string } | null;
  focus: { skill: SkillKey; score: number | null; passed: boolean; feedback: string | null } | null;
  usedFallback: boolean;
};

export type Scores = {
  bars: DeliveryBars & { structure: number | null; argument: number | null };
  skills: Partial<Record<SkillKey, number | null>>;
};

const RETRY_DELAY_MS = 2 * 60_000;

/** Claim and run one attempt. Safe to call twice: only an `uploaded` attempt is claimed. */
export async function processAttempt(id: string, now = new Date()) {
  const [claimed] = await db
    .update(s.speechAttempt)
    .set({ status: "transcribing", updatedAt: now })
    .where(and(eq(s.speechAttempt.id, id), eq(s.speechAttempt.status, "uploaded")))
    .returning();
  if (!claimed) return null;
  const a = claimed;
  const contentType = (a.metrics as { contentType?: string } | null)?.contentType ?? "audio/webm";
  const st = await settings();
  try {
    const [p] = await db.select({ firstName: s.person.firstName, phone: s.person.phone, email: s.person.email, preferredChannel: s.person.preferredChannel, stateId: s.person.stateId }).from(s.person).where(eq(s.person.id, a.personId));
    const lesson: Lesson | null = a.lessonKey ? (LESSON[a.lessonKey] ?? null) : null;
    const target = lesson?.drill.targetSeconds ?? 120;
    const motionText =
      a.kind === "lesson" && lesson ? lesson.drill.motion : a.kind === "placement" ? PLACEMENT.motion : a.motionId ? ((await db.select({ t: s.motion.textEn }).from(s.motion).where(eq(s.motion.id, a.motionId)))[0]?.t ?? "Open speech") : "Open speech";

    const tr = await transcriber().transcribe({ key: a.audioKey!, contentType, durationHint: Number(a.durationSeconds ?? 0), attemptId: a.id });
    const m = computeMetrics(tr.words, Math.min(tr.durationSeconds || Number(a.durationSeconds ?? 0), st.maxSeconds + 5));
    const reject = rejectReason(m, Math.min(st.minSeconds, Math.round(target * 0.4)));
    if (reject) {
      await db
        .update(s.speechAttempt)
        .set({ status: "rejected", rejectReason: reject, metrics: m, durationSeconds: String(m.durationSeconds), updatedAt: new Date() })
        .where(eq(s.speechAttempt.id, a.id));
      return { status: "rejected" as const, reason: reject };
    }

    await db.update(s.speechAttempt).set({ status: "scoring", transcript: encrypt(tr.text), words: tr.words, metrics: m, durationSeconds: String(m.durationSeconds), updatedAt: new Date() }).where(eq(s.speechAttempt.id, a.id));

    const ratingsBefore = await ratingsFor(a.personId);
    const { out, model, tokensIn, tokensOut } = await askModel({
      firstName: p?.firstName ?? "there",
      motion: motionText,
      side: a.side,
      kind: a.kind,
      lesson,
      weakestSkills: weakest(ratingsBefore),
      transcript: tr.text,
      metrics: m,
      anchors: st.anchors,
    });

    const bars = deliveryBars(m, target);
    const delivery = deliveryScores(bars);
    const skills: Scores["skills"] = { ...(out?.skills ?? {}), ...delivery };
    const stars = overallStars(out?.structure ?? null, out?.argument ?? null, bars);
    const focusSkill = lesson?.skill ?? null;
    const focusScore = focusSkill ? (SKILL[focusSkill].area === "delivery" ? delivery[focusSkill as keyof typeof delivery] : (out?.focus.score ?? out?.skills[focusSkill as keyof CoachOutput["skills"]] ?? null)) : null;
    const fb = out ?? null;
    const fixed = fallbackFeedback(m, p?.firstName ?? "there");
    const feedback: Feedback = {
      strengths: (fb?.strengths ?? fixed.strengths).slice(0, 2),
      nextSteps: (fb?.next_steps ?? fixed.next_steps).slice(0, 2),
      encouragement: fb?.encouragement ?? fixed.encouragement,
      betterLine: fb?.better_line ?? null,
      focus: lesson && focusSkill ? { skill: focusSkill, score: focusScore, passed: focusScore !== null && passedLesson(lesson, focusScore), feedback: fb?.focus.feedback ?? null } : null,
      usedFallback: !fb,
    };
    // Off-topic speeches still get feedback but don't move the content ratings.
    const rateable: Scores["skills"] = fb?.off_topic ? { ...delivery } : skills;
    const ratingsAfter = updateRatings(ratingsBefore, rateable, focusSkill ?? undefined);

    await db.transaction(async (tx) => {
      for (const k of SKILLS.map((x) => x.key)) {
        if (rateable[k] === null || rateable[k] === undefined || ratingsAfter[k] === undefined) continue;
        await tx
          .insert(s.coachSkill)
          .values({ personId: a.personId, skillKey: k, rating: String(ratingsAfter[k]), assessments: 1 })
          .onConflictDoUpdate({
            target: [s.coachSkill.personId, s.coachSkill.skillKey],
            set: { rating: String(ratingsAfter[k]), assessments: sql`${s.coachSkill.assessments} + 1`, updatedAt: new Date() },
          });
      }
      if (lesson) {
        const passed = feedback.focus?.passed ?? false;
        await tx
          .insert(s.coachLesson)
          .values({ personId: a.personId, lessonKey: lesson.key, status: passed ? "passed" : "started", attempts: 1, bestScore: focusScore, passedAt: passed ? new Date() : null })
          .onConflictDoUpdate({
            target: [s.coachLesson.personId, s.coachLesson.lessonKey],
            set: {
              attempts: sql`${s.coachLesson.attempts} + 1`,
              bestScore: sql`greatest(coalesce(${s.coachLesson.bestScore}, 0), ${focusScore ?? 0})`,
              // Once passed, a lesson stays passed.
              status: passed ? "passed" : sql`${s.coachLesson.status}`,
              passedAt: passed ? sql`coalesce(${s.coachLesson.passedAt}, now())` : sql`${s.coachLesson.passedAt}`,
              updatedAt: new Date(),
            },
          });
      }
      await tx
        .update(s.speechAttempt)
        .set({
          status: "done",
          scores: { bars: { ...bars, structure: fb?.structure ?? null, argument: fb?.argument ?? null }, skills: rateable, ratingsAfter } satisfies Scores & { ratingsAfter: Ratings },
          feedback,
          overallStars: stars,
          modelId: model,
          promptVersion: PROMPT_VERSION,
          tokensIn,
          tokensOut,
          flaggedForSafeguarding: fb?.safeguarding_flag ?? false,
          updatedAt: new Date(),
        })
        .where(eq(s.speechAttempt.id, a.id));
    });

    if (fb?.safeguarding_flag) await openSafeguardingCase(a.id, a.personId, p?.stateId ?? null);
    // A voice note sent on WhatsApp is answered there (spec/12 §7 step 4); web speeches follow her preference.
    const to = p
      ? a.channel === "whatsapp" && p.phone
        ? { to: p.phone, channel: "whatsapp" as const }
        : reach({ ...p, preferredChannel: p.preferredChannel === "sms" ? "whatsapp" : p.preferredChannel })
      : null;
    if (p && to) {
      const mid = await queueTemplate({
        templateKey: "speech.result",
        to: to.to,
        channel: to.channel,
        personId: a.personId,
        vars: {
          firstName: p.firstName,
          stars: "★".repeat(stars) + "☆".repeat(5 - stars),
          wpm: m.wpm,
          fillers: m.fillerCount,
          strength: feedback.strengths[0] ?? "",
          nextStep: feedback.nextSteps[0] ?? "",
          link: `${process.env.APP_URL ?? ""}/app/coach/attempt/${a.id}`,
        },
        eventKey: `speech.result:${a.id}`,
        storeVars: false,
      }).catch(() => null);
      if (mid) await dispatch([mid]).catch(() => {});
    }
    return { status: "done" as const, stars };
  } catch (e) {
    console.error("[speech] processing failed:", e instanceof Error ? e.message : "unknown");
    await db.update(s.speechAttempt).set({ status: "failed", rejectReason: "server", updatedAt: new Date() }).where(eq(s.speechAttempt.id, a.id));
    return { status: "failed" as const };
  } finally {
    // The recording is deleted once it has been heard, whatever the outcome (spec/12 §3 cleanup).
    if (a.audioKey) {
      await storage()
        .delete(a.audioKey)
        .catch(() => console.warn("[speech] audio delete failed; the bucket lifecycle rule will remove it"));
      await db.update(s.speechAttempt).set({ audioKey: null }).where(eq(s.speechAttempt.id, a.id));
    }
  }
}

/** Cron backstop: attempts that were stored but never processed (the request ended early). */
export async function sweepSpeech(now = new Date()) {
  const stuck = await db
    .select({ id: s.speechAttempt.id })
    .from(s.speechAttempt)
    .where(and(eq(s.speechAttempt.status, "uploaded"), lt(s.speechAttempt.createdAt, new Date(now.getTime() - RETRY_DELAY_MS))))
    .limit(10);
  let done = 0;
  for (const x of stuck) if (await processAttempt(x.id, now)) done++;
  // Attempts left mid-way by a crashed function are failed so the student can try again.
  await db
    .update(s.speechAttempt)
    .set({ status: "failed", rejectReason: "server", updatedAt: now })
    .where(and(inArray(s.speechAttempt.status, ["transcribing", "scoring"]), lt(s.speechAttempt.updatedAt, new Date(now.getTime() - 10 * 60_000))));
  const purged = await purgeOldTranscripts(now);
  return { processed: done, purged };
}

/** spec/12 §8: transcripts (and the word timings that could rebuild them) are kept 12 months. */
export async function purgeOldTranscripts(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  const rows = await db
    .update(s.speechAttempt)
    .set({ transcript: null, words: null, updatedAt: now })
    .where(and(lt(s.speechAttempt.createdAt, cutoff), sql`(${s.speechAttempt.transcript} is not null or ${s.speechAttempt.words} is not null)`))
    .returning({ id: s.speechAttempt.id });
  return rows.length;
}

async function openSafeguardingCase(attemptId: string, personId: string, stateId: string | null) {
  const year = new Date().getFullYear();
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(s.safeguardingCase)
      .where(sql`${s.safeguardingCase.reference} like ${`SG-${year}-%`}`);
    const ref = `SG-${year}-${String(n + 1).padStart(4, "0")}`;
    const [c] = await tx
      .insert(s.safeguardingCase)
      .values({
        reference: ref,
        subjectPersonId: personId,
        aboutPersonId: personId,
        category: "other",
        severity: "medium",
        description: encrypt(`Speech practice transcript flagged; review attempt ${attemptId}`),
        source: "ai_flag",
      })
      .returning({ id: s.safeguardingCase.id });
    const leads = await tx
      .select({ id: s.person.id, phone: s.person.phone, email: s.person.email, preferredChannel: s.person.preferredChannel })
      .from(s.personRole)
      .innerJoin(s.person, eq(s.person.id, s.personRole.personId))
      .where(sql`${s.personRole.role} in ('safeguarding_lead','admin') and ${s.personRole.revokedAt} is null`);
    for (const l of leads) {
      const to = reach(l);
      if (!to) continue;
      const id = await queueTemplate(
        {
          templateKey: "staff.case_new",
          to: to.to,
          channel: to.channel,
          personId: l.id,
          vars: { reference: ref, severity: "medium", link: `${process.env.APP_URL ?? ""}/console` },
          eventKey: `staff.case_new:${c!.id}:${l.id}`,
        },
        tx,
      );
      if (id) ids.push(id);
    }
    await tx.insert(s.auditEvent).values({ action: "case.create", entityType: "safeguarding_case", entityId: c!.id, subjectPersonId: personId, meta: { source: "ai_flag", stateId } });
  });
  await dispatch(ids).catch(() => {});
}

/* ---------- Reading an attempt ---------- */

export type AttemptView = {
  id: string;
  status: string;
  rejectReason: string | null;
  kind: string;
  title: string;
  lesson: Lesson | null;
  motionId: string | null;
  motion: string;
  side: string;
  stars: number | null;
  metrics: Metrics | null;
  scores: (Scores & { ratingsAfter?: Ratings }) | null;
  feedback: Feedback | null;
  transcript: string | null;
  createdAt: Date;
};

/** The student's own attempt. Anyone else gets null (staff views come with the console, audited). */
export async function getAttempt(actor: Actor, id: string): Promise<AttemptView | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [a] = await db
    .select({ a: s.speechAttempt, motion: s.motion.textEn })
    .from(s.speechAttempt)
    .leftJoin(s.motion, eq(s.motion.id, s.speechAttempt.motionId))
    .where(eq(s.speechAttempt.id, id));
  if (!a || a.a.personId !== actor.personId) return null;
  const lesson = a.a.lessonKey ? (LESSON[a.a.lessonKey] ?? null) : null;
  const m = a.a.metrics as (Metrics & { contentType?: string }) | null;
  return {
    id: a.a.id,
    status: a.a.status,
    rejectReason: a.a.rejectReason,
    kind: a.a.kind,
    title: titleFor({ kind: a.a.kind, lessonKey: a.a.lessonKey, motion: a.motion }),
    lesson,
    motionId: a.a.motionId,
    motion: lesson ? lesson.drill.motion : a.a.kind === "placement" ? PLACEMENT.motion : (a.motion ?? "Open speech"),
    side: a.a.side,
    stars: a.a.overallStars,
    metrics: m && "wpm" in m ? m : null,
    scores: a.a.scores as AttemptView["scores"],
    feedback: a.a.feedback as Feedback | null,
    transcript: a.a.transcript ? decrypt(a.a.transcript) : null,
    createdAt: a.a.createdAt,
  };
}

/* ---------- Read-aloud (spec/12 §6) ---------- */

/** What "Listen to feedback" says: the encouragement, then the strengths and next steps. */
export function feedbackScript(f: Pick<Feedback, "encouragement" | "strengths" | "nextSteps">) {
  return [f.encouragement, "What you did well.", ...f.strengths, "Try this next time.", ...f.nextSteps].join(" ").slice(0, 2900);
}

export async function feedbackAudio(actor: Actor, id: string): Promise<{ ok: true; audio: Uint8Array } | { ok: false; code: "not_found" | "no_tts" | "failed" }> {
  const a = await getAttempt(actor, id);
  if (!a || a.status !== "done" || !a.feedback) return { ok: false, code: "not_found" };
  const voice = speaker();
  if (!voice) return { ok: false, code: "no_tts" };
  const key = `speech-tts/${a.id}.mp3`;
  const store = storage();
  const cached = await store.get(key).catch(() => null);
  if (cached?.byteLength) return { ok: true, audio: cached };
  try {
    const audio = await voice.synthesize(feedbackScript(a.feedback));
    await store.put(key, audio, "audio/mpeg").catch(() => console.warn("[speech] could not cache read-aloud audio"));
    return { ok: true, audio };
  } catch (e) {
    console.warn("[speech] read-aloud failed:", e instanceof Error ? e.message : "unknown");
    return { ok: false, code: "failed" };
  }
}

export { SKILLS };
