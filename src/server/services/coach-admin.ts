import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { LESSON, PLACEMENT, SKILLS, type SkillKey } from "@/server/coach/curriculum";
import type { Metrics } from "@/server/coach/metrics";
import { can, isStaff, type Actor } from "@/server/permissions/can";
import { Forbidden } from "@/server/permissions/assert";
import { audit, type Ctx } from "./audit";
import { AI_SETTING_KEYS, coachSettings, eligibility, type CoachSettings, type Feedback, type Scores } from "./speech";

/**
 * The staff side of the speech coach (spec/12 §4 and §5): `/console/ai`, the cohort AI table, a
 * student's attempts with transcripts (audited), and coaches' reviews of AI scorecards. The human
 * coaches' own view is in coach-supervision.ts.
 */

const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
/** Audit rows need an entity id; settings and bulk imports have none of their own. */
const NO_ENTITY = "00000000-0000-0000-0000-000000000000";

function requireAi(actor: Actor | null): asserts actor is Actor {
  if (!actor || !can(actor, "ai.settings")) throw new Forbidden("ai.settings");
}

/* ---------- Estimated cost (spec/12 §5: "attempts × estimated unit cost") ---------- */

/**
 * List prices in US dollars, used only for the estimate on `/console/ai`. Update them when the
 * providers change their prices; the bill itself is the source of truth.
 */
export const UNIT_COST = {
  /** Per audio minute. */
  transcribe: { aws: 0.024, groq: 0.04 / 60, console: 0 } as Record<string, number>,
  /** Per million tokens, by model id prefix. */
  model: [
    { prefix: "openai/gpt-oss-120b", in: 0.15, out: 0.6 },
    { prefix: "openai/gpt-oss-20b", in: 0.075, out: 0.3 },
    { prefix: "llama-3.3-70b", in: 0.59, out: 0.79 },
  ],
  fallbackModel: { in: 0.6, out: 0.8 },
};

export function estimateCost(i: { audioMinutes: number; tokensIn: number; tokensOut: number; model?: string | null; transcriber?: string }) {
  const perMin = UNIT_COST.transcribe[i.transcriber ?? process.env.TRANSCRIBE_PROVIDER ?? "console"] ?? UNIT_COST.transcribe.aws!;
  const m = (i.model && UNIT_COST.model.find((x) => i.model!.startsWith(x.prefix))) || (i.model?.startsWith("console") ? { in: 0, out: 0 } : UNIT_COST.fallbackModel);
  return i.audioMinutes * perMin + (i.tokensIn / 1e6) * m.in + (i.tokensOut / 1e6) * m.out;
}

/* ---------- /console/ai ---------- */

export type AiUsage = {
  attempts: number;
  scored: number;
  rejected: number;
  failed: number;
  students: number;
  viaWhatsapp: number;
  audioMinutes: number;
  tokensIn: number;
  tokensOut: number;
  avgStars: number | null;
  costUsd: number;
  costPerAttempt: number | null;
  budgetUsd: number;
  flagged: number;
};

export async function aiUsage(now = new Date()): Promise<AiUsage> {
  const since = monthStart(now);
  const rows = await db
    .select({
      status: s.speechAttempt.status,
      channel: s.speechAttempt.channel,
      model: s.speechAttempt.modelId,
      n: count(),
      seconds: sql<string>`coalesce(sum(${s.speechAttempt.durationSeconds}), 0)`,
      tin: sql<string>`coalesce(sum(${s.speechAttempt.tokensIn}), 0)`,
      tout: sql<string>`coalesce(sum(${s.speechAttempt.tokensOut}), 0)`,
      stars: sql<string | null>`avg(${s.speechAttempt.overallStars})`,
      flagged: sql<number>`count(*) filter (where ${s.speechAttempt.flaggedForSafeguarding})::int`,
    })
    .from(s.speechAttempt)
    .where(gte(s.speechAttempt.createdAt, since))
    .groupBy(s.speechAttempt.status, s.speechAttempt.channel, s.speechAttempt.modelId);
  const [students] = await db
    .select({ n: sql<number>`count(distinct ${s.speechAttempt.personId})::int` })
    .from(s.speechAttempt)
    .where(gte(s.speechAttempt.createdAt, since));
  const [budget] = await db.select({ v: s.setting.value }).from(s.setting).where(eq(s.setting.key, "aws_monthly_budget_usd"));

  let cost = 0;
  let starsSum = 0;
  let starsN = 0;
  const u = { attempts: 0, scored: 0, rejected: 0, failed: 0, viaWhatsapp: 0, audioMinutes: 0, tokensIn: 0, tokensOut: 0, flagged: 0 };
  for (const r of rows) {
    const minutes = Number(r.seconds) / 60;
    u.attempts += r.n;
    if (r.status === "done") {
      u.scored += r.n;
      if (r.stars !== null) {
        starsSum += Number(r.stars) * r.n;
        starsN += r.n;
      }
    }
    if (r.status === "rejected") u.rejected += r.n;
    if (r.status === "failed") u.failed += r.n;
    if (r.channel === "whatsapp") u.viaWhatsapp += r.n;
    // Audio that reached the transcriber costs money whatever the outcome.
    if (r.status !== "uploaded") u.audioMinutes += minutes;
    u.tokensIn += Number(r.tin);
    u.tokensOut += Number(r.tout);
    u.flagged += r.flagged;
    cost += estimateCost({ audioMinutes: r.status === "uploaded" ? 0 : minutes, tokensIn: Number(r.tin), tokensOut: Number(r.tout), model: r.model });
  }
  return {
    ...u,
    audioMinutes: Math.round(u.audioMinutes * 10) / 10,
    students: students?.n ?? 0,
    avgStars: starsN ? Math.round((starsSum / starsN) * 10) / 10 : null,
    costUsd: Math.round(cost * 100) / 100,
    costPerAttempt: u.attempts ? Math.round((cost / u.attempts) * 1000) / 1000 : null,
    budgetUsd: Number(budget?.v ?? 150),
  };
}

export type AiCohortRow = { id: string; name: string; school: string; programme: string; term: string; status: string; isPilotGroup: boolean; students: number; practising: number; attempts: number; openConcerns: number };

/** Every live cohort with its pilot flag, this month's use and open coach concerns (spec/12 §5). */
export async function aiCohorts(now = new Date()): Promise<AiCohortRow[]> {
  const cohorts = await db
    .select({
      id: s.cohort.id,
      name: s.cohort.name,
      school: s.school.name,
      programme: s.programme.nameEn,
      term: s.cohort.term,
      status: s.cohort.status,
      isPilotGroup: s.cohort.isPilotGroup,
    })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .innerJoin(s.programme, eq(s.programme.id, s.cohort.programmeId))
    .where(and(isNull(s.cohort.deletedAt), isNull(s.cohort.closedAt)))
    .orderBy(s.school.name, s.cohort.name);
  if (!cohorts.length) return [];
  const ids = cohorts.map((c) => c.id);
  const members = await db
    .select({ cohortId: s.cohortMember.cohortId, n: count() })
    .from(s.cohortMember)
    .where(and(inArray(s.cohortMember.cohortId, ids), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn)))
    .groupBy(s.cohortMember.cohortId);
  const use = await db
    .select({ cohortId: s.speechAttempt.cohortId, n: count(), people: sql<number>`count(distinct ${s.speechAttempt.personId})::int` })
    .from(s.speechAttempt)
    .where(and(inArray(s.speechAttempt.cohortId, ids), gte(s.speechAttempt.createdAt, monthStart(now))))
    .groupBy(s.speechAttempt.cohortId);
  const concerns = await db
    .select({ cohortId: s.speechAttempt.cohortId, n: count() })
    .from(s.coachReview)
    .innerJoin(s.speechAttempt, eq(s.speechAttempt.id, s.coachReview.attemptId))
    .where(and(inArray(s.speechAttempt.cohortId, ids), eq(s.coachReview.verdict, "concern"), isNull(s.coachReview.resolvedAt)))
    .groupBy(s.speechAttempt.cohortId);
  return cohorts.map((c) => ({
    ...c,
    openConcerns: concerns.find((x) => x.cohortId === c.id)?.n ?? 0,
    students: members.find((m) => m.cohortId === c.id)?.n ?? 0,
    attempts: use.find((u) => u.cohortId === c.id)?.n ?? 0,
    practising: use.find((u) => u.cohortId === c.id)?.people ?? 0,
  }));
}

export type RecentAttempt = { id: string; personId: string; firstName: string; title: string; status: string; stars: number | null; channel: string; flagged: boolean; createdAt: Date };

function titleOf(a: { kind: string; lessonKey: string | null; motion: string | null }) {
  if (a.kind === "placement") return "Placement speech";
  if (a.kind === "lesson" && a.lessonKey && LESSON[a.lessonKey]) return LESSON[a.lessonKey]!.title;
  return a.motion ?? "Free practice";
}

export async function recentAttempts(limit = 20): Promise<RecentAttempt[]> {
  const rows = await db
    .select({
      id: s.speechAttempt.id,
      personId: s.speechAttempt.personId,
      firstName: s.person.firstName,
      kind: s.speechAttempt.kind,
      lessonKey: s.speechAttempt.lessonKey,
      motion: s.motion.textEn,
      status: s.speechAttempt.status,
      stars: s.speechAttempt.overallStars,
      channel: s.speechAttempt.channel,
      flagged: s.speechAttempt.flaggedForSafeguarding,
      createdAt: s.speechAttempt.createdAt,
    })
    .from(s.speechAttempt)
    .innerJoin(s.person, eq(s.person.id, s.speechAttempt.personId))
    .leftJoin(s.motion, eq(s.motion.id, s.speechAttempt.motionId))
    .orderBy(desc(s.speechAttempt.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, title: titleOf(r) }));
}

export type MotionRow = { id: string; textEn: string; textYo: string | null; difficulty: "starter" | "intermediate" | "advanced"; sdg: number | null; isActive: boolean; uses: number };

export async function listMotions(): Promise<MotionRow[]> {
  const rows = await db
    .select({
      id: s.motion.id,
      textEn: s.motion.textEn,
      textYo: s.motion.textYo,
      difficulty: s.motion.difficulty,
      sdg: s.motion.sdg,
      isActive: s.motion.isActive,
      uses: sql<number>`(select count(*)::int from ${s.speechAttempt} where ${s.speechAttempt.motionId} = ${s.motion.id})`,
    })
    .from(s.motion)
    .orderBy(desc(s.motion.isActive), s.motion.difficulty, s.motion.textEn);
  return rows;
}

export async function aiAdmin(actor: Actor | null) {
  requireAi(actor);
  const [settings, usage, cohorts, motions, recent, reviews] = await Promise.all([coachSettings(), aiUsage(), aiCohorts(), listMotions(), recentAttempts(), coachReviews()]);
  return { settings, usage, cohorts, motions, recent, reviews };
}

/* ---------- Changes ---------- */

export const aiSettingsInput = z.object({
  enabled: z.boolean(),
  cap: z.coerce.number().int().min(1).max(100),
  maxSeconds: z.coerce.number().int().min(60).max(300),
  minSeconds: z.coerce.number().int().min(5).max(60),
  anchors: z.string().trim().max(2000),
});
export type AiSettingsInput = z.infer<typeof aiSettingsInput>;

export async function saveAiSettings(ctx: Ctx, raw: unknown): Promise<{ ok: true } | { ok: false; code: "invalid" }> {
  requireAi(ctx.actor);
  const p = aiSettingsInput.safeParse(raw);
  if (!p.success || p.data.minSeconds >= p.data.maxSeconds) return { ok: false, code: "invalid" };
  const before = await coachSettings();
  const v = p.data;
  const values: Record<(typeof AI_SETTING_KEYS)[number], unknown> = {
    ai_enabled: v.enabled,
    ai_monthly_attempt_cap: v.cap,
    ai_max_seconds: v.maxSeconds,
    ai_min_seconds: v.minSeconds,
    ai_rubric_anchors: v.anchors,
  };
  const actorId = ctx.actor!.personId;
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      await tx
        .insert(s.setting)
        .values({ key, value, updatedBy: actorId })
        .onConflictDoUpdate({ target: s.setting.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
    }
    const changed = (Object.keys(v) as (keyof CoachSettings)[]).filter((k) => before[k] !== v[k]);
    await audit(tx, ctx, { action: "ai.settings", entityType: "setting", entityId: NO_ENTITY, meta: { changed, enabled: v.enabled } });
  });
  return { ok: true };
}

export const motionInput = z.object({
  id: z.string().uuid().optional().nullable(),
  textEn: z.string().trim().min(10).max(300),
  textYo: z.string().trim().max(300).optional().nullable(),
  difficulty: z.enum(["starter", "intermediate", "advanced"]),
  sdg: z.coerce.number().int().min(1).max(17).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function saveMotion(ctx: Ctx, raw: unknown): Promise<{ ok: true; id: string } | { ok: false; code: "invalid" | "duplicate" | "not_found" }> {
  requireAi(ctx.actor);
  const p = motionInput.safeParse(raw);
  if (!p.success) return { ok: false, code: "invalid" };
  const v = p.data;
  const [dup] = await db
    .select({ id: s.motion.id })
    .from(s.motion)
    .where(sql`lower(${s.motion.textEn}) = ${v.textEn.toLowerCase()}`);
  if (dup && dup.id !== v.id) return { ok: false, code: "duplicate" };
  const values = { textEn: v.textEn, textYo: v.textYo || null, difficulty: v.difficulty, sdg: v.sdg ?? null, isActive: v.isActive };
  let id = v.id ?? null;
  if (id) {
    const r = await db.update(s.motion).set({ ...values, updatedAt: new Date() }).where(eq(s.motion.id, id)).returning({ id: s.motion.id });
    if (!r.length) return { ok: false, code: "not_found" };
  } else {
    const [r] = await db.insert(s.motion).values(values).returning({ id: s.motion.id });
    id = r!.id;
  }
  await audit(db, ctx, { action: v.id ? "motion.update" : "motion.create", entityType: "motion", entityId: id, meta: { isActive: v.isActive } });
  return { ok: true, id };
}

export async function setMotionActive(ctx: Ctx, id: string, isActive: boolean) {
  requireAi(ctx.actor);
  const r = await db.update(s.motion).set({ isActive, updatedAt: new Date() }).where(eq(s.motion.id, id)).returning({ id: s.motion.id });
  if (r.length) await audit(db, ctx, { action: "motion.update", entityType: "motion", entityId: id, meta: { isActive } });
  return r.length > 0;
}

const LEVELS = ["starter", "intermediate", "advanced"] as const;

/**
 * "Import list" (spec/12 §5): one motion per line. A line may start with a level and a bar,
 * "intermediate | This house would …"; otherwise the chosen default level is used. Lines already
 * in the list (ignoring case) and lines under 10 characters are skipped.
 */
export function parseMotionList(text: string, fallback: (typeof LEVELS)[number]) {
  const out: { textEn: string; difficulty: (typeof LEVELS)[number] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*•\d.)\s]+(?=\D)/, "").trim();
    if (!line) continue;
    const m = /^(starter|intermediate|advanced)\s*[|,;:\t]\s*(.+)$/i.exec(line);
    const textEn = (m ? m[2]! : line).trim().replace(/^"|"$/g, "");
    if (textEn.length < 10 || textEn.length > 300) continue;
    out.push({ textEn, difficulty: m ? (m[1]!.toLowerCase() as (typeof LEVELS)[number]) : fallback });
  }
  return out;
}

export async function importMotions(ctx: Ctx, text: string, fallback: string): Promise<{ added: number; skipped: number }> {
  requireAi(ctx.actor);
  const level = (LEVELS as readonly string[]).includes(fallback) ? (fallback as (typeof LEVELS)[number]) : "starter";
  const parsed = parseMotionList(text.slice(0, 50_000), level);
  const existing = new Set((await db.select({ t: s.motion.textEn }).from(s.motion)).map((r) => r.t.toLowerCase()));
  const fresh: typeof parsed = [];
  for (const m of parsed) {
    const k = m.textEn.toLowerCase();
    if (existing.has(k)) continue;
    existing.add(k);
    fresh.push(m);
  }
  if (fresh.length) await db.insert(s.motion).values(fresh.map((m) => ({ ...m, isActive: true })));
  await audit(db, ctx, { action: "motion.import", entityType: "motion", entityId: NO_ENTITY, meta: { added: fresh.length, skipped: parsed.length - fresh.length } });
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  return { added: fresh.length, skipped: lines - fresh.length };
}

/** The pilot flag (spec/12 §9). The coach itself is never switched per group: each student practises on her own. */
export async function setCohortPilot(ctx: Ctx, cohortId: string, isPilotGroup: boolean) {
  requireAi(ctx.actor);
  const set = { isPilotGroup };
  const r = await db
    .update(s.cohort)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(s.cohort.id, cohortId), isNull(s.cohort.deletedAt)))
    .returning({ id: s.cohort.id });
  if (r.length) await audit(db, ctx, { action: "cohort.ai", entityType: "cohort", entityId: cohortId, meta: set });
  return r.length > 0;
}

/* ---------- Cohort AI tab (spec/12 §4) ---------- */

export type CohortAiStudent = { personId: string; firstName: string; attemptsMonth: number; attemptsTotal: number; avgStars: number | null; lastAt: Date | null };

export async function cohortAi(actor: Actor | null, cohortId: string, now = new Date()) {
  if (!actor || !isStaff(actor)) throw new Forbidden("speech.view");
  const [c] = await db
    .select({ id: s.cohort.id, name: s.cohort.name, school: s.school.name, stateId: s.school.stateId, isPilotGroup: s.cohort.isPilotGroup })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(and(eq(s.cohort.id, cohortId), isNull(s.cohort.deletedAt)));
  if (!c) return null;
  if (!can(actor, "speech.view", { personId: null, stateId: c.stateId })) throw new Forbidden("speech.view");
  const members = await db
    .select({ personId: s.person.id, firstName: s.person.firstName })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .where(and(eq(s.cohortMember.cohortId, cohortId), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn), isNull(s.person.deletedAt)))
    .orderBy(s.person.firstName);
  const ids = members.map((m) => m.personId);
  const stats = ids.length
    ? await db
        .select({
          personId: s.speechAttempt.personId,
          total: count(),
          month: sql<number>`count(*) filter (where ${s.speechAttempt.createdAt} >= ${monthStart(now).toISOString()}::timestamptz)::int`,
          stars: sql<string | null>`avg(${s.speechAttempt.overallStars}) filter (where ${s.speechAttempt.status} = 'done')`,
          lastAt: sql<string | null>`max(${s.speechAttempt.createdAt})`,
        })
        .from(s.speechAttempt)
        .where(inArray(s.speechAttempt.personId, ids))
        .groupBy(s.speechAttempt.personId)
    : [];
  const rows: CohortAiStudent[] = members.map((m) => {
    const st = stats.find((x) => x.personId === m.personId);
    return {
      ...m,
      attemptsMonth: st?.month ?? 0,
      attemptsTotal: st?.total ?? 0,
      avgStars: st?.stars ? Math.round(Number(st.stars) * 10) / 10 : null,
      lastAt: st?.lastAt ? new Date(st.lastAt) : null,
    };
  });
  return {
    cohort: { id: c.id, name: c.name, school: c.school, isPilotGroup: c.isPilotGroup },
    students: rows,
    tried: rows.filter((r) => r.attemptsTotal > 0),
    notTried: rows.filter((r) => r.attemptsTotal === 0),
    attemptsMonth: rows.reduce((a, r) => a + r.attemptsMonth, 0),
  };
}

/* ---------- A student's attempts for staff (spec/12 §4: "with transcript, audited read") ---------- */

export type StaffAttempt = {
  id: string;
  title: string;
  kind: string;
  side: string;
  channel: string;
  status: string;
  rejectReason: string | null;
  stars: number | null;
  metrics: Metrics | null;
  bars: Scores["bars"] | null;
  feedback: Feedback | null;
  transcript: string | null;
  motionText: string | null;
  flagged: boolean;
  modelId: string | null;
  createdAt: Date;
};

export async function studentAttempts(ctx: Ctx, personId: string) {
  const actor = ctx.actor;
  if (!actor || !isStaff(actor) || !/^[0-9a-f-]{36}$/.test(personId)) throw new Forbidden("speech.view");
  const [p] = await db
    .select({ id: s.person.id, firstName: s.person.firstName, stateId: s.person.stateId, status: s.person.status, ageAtSignup: s.person.ageAtSignup })
    .from(s.person)
    .where(eq(s.person.id, personId));
  if (!p) return null;
  if (!can(actor, "speech.view", { personId, stateId: p.stateId })) throw new Forbidden("speech.view");
  const rows = await db
    .select({ a: s.speechAttempt, motion: s.motion.textEn })
    .from(s.speechAttempt)
    .leftJoin(s.motion, eq(s.motion.id, s.speechAttempt.motionId))
    .where(eq(s.speechAttempt.personId, personId))
    .orderBy(desc(s.speechAttempt.createdAt))
    .limit(50);
  const skills = await db.select({ k: s.coachSkill.skillKey, r: s.coachSkill.rating }).from(s.coachSkill).where(eq(s.coachSkill.personId, personId));
  const lessons = await db
    .select({ k: s.coachLesson.lessonKey, status: s.coachLesson.status })
    .from(s.coachLesson)
    .where(eq(s.coachLesson.personId, personId));
  const withTranscript = rows.filter((r) => r.a.transcript).map((r) => r.a.id);
  // Reading transcripts is recorded, every time (spec/09: sensitive reads are audited).
  await audit(db, ctx, { action: "speech.view_transcript", entityType: "person", entityId: personId, subjectPersonId: personId, meta: { attempts: withTranscript.length } });
  const attempts: StaffAttempt[] = rows.map(({ a, motion }) => {
    const m = a.metrics as (Metrics & { contentType?: string }) | null;
    const lesson = a.lessonKey ? LESSON[a.lessonKey] : undefined;
    return {
      id: a.id,
      title: titleOf({ kind: a.kind, lessonKey: a.lessonKey, motion }),
      kind: a.kind,
      side: a.side,
      channel: a.channel,
      status: a.status,
      rejectReason: a.rejectReason,
      stars: a.overallStars,
      metrics: m && "wpm" in m ? m : null,
      bars: (a.scores as Scores | null)?.bars ?? null,
      feedback: a.feedback as Feedback | null,
      transcript: a.transcript ? decrypt(a.transcript) : null,
      flagged: a.flaggedForSafeguarding,
      modelId: a.modelId,
      createdAt: a.createdAt,
      motionText: lesson ? lesson.drill.motion : a.kind === "placement" ? PLACEMENT.motion : motion,
    };
  });
  return {
    person: { id: p.id, firstName: p.firstName, status: p.status },
    eligibility: await eligibility(personId),
    skills: SKILLS.map((k) => ({ key: k.key, name: k.name, rating: skills.find((x) => x.k === k.key) ? Number(skills.find((x) => x.k === k.key)!.r) : null })),
    lessonsPassed: lessons.filter((l) => l.status === "passed").length,
    attempts,
    reviews: await reviewsFor(attempts.map((a) => a.id)),
  };
}

/* ---------- Coaches' reviews of AI scorecards (D-015) ---------- */

export type ReviewRow = {
  id: string;
  attemptId: string;
  personId: string;
  studentName: string;
  cohortName: string | null;
  title: string;
  stars: number | null;
  reviewer: string;
  reason: string | null;
  note: string | null;
  createdAt: Date;
};

/** Open concerns, oldest first, and how many scorecards coaches have checked this month. */
export async function coachReviews(now = new Date()) {
  const reviewer = sql<string>`(select first_name from person r where r.id = ${s.coachReview.reviewerId})`;
  const rows = await db
    .select({
      id: s.coachReview.id,
      attemptId: s.coachReview.attemptId,
      personId: s.speechAttempt.personId,
      studentName: s.person.firstName,
      cohortName: s.cohort.name,
      kind: s.speechAttempt.kind,
      lessonKey: s.speechAttempt.lessonKey,
      motion: s.motion.textEn,
      stars: s.speechAttempt.overallStars,
      reviewer,
      reason: s.coachReview.reason,
      note: s.coachReview.note,
      createdAt: s.coachReview.createdAt,
    })
    .from(s.coachReview)
    .innerJoin(s.speechAttempt, eq(s.speechAttempt.id, s.coachReview.attemptId))
    .innerJoin(s.person, eq(s.person.id, s.speechAttempt.personId))
    .leftJoin(s.cohort, eq(s.cohort.id, s.speechAttempt.cohortId))
    .leftJoin(s.motion, eq(s.motion.id, s.speechAttempt.motionId))
    .where(and(eq(s.coachReview.verdict, "concern"), isNull(s.coachReview.resolvedAt)))
    .orderBy(s.coachReview.createdAt)
    .limit(100);
  const [month] = await db
    .select({
      ok: sql<number>`count(*) filter (where ${s.coachReview.verdict} = 'ok')::int`,
      concern: sql<number>`count(*) filter (where ${s.coachReview.verdict} = 'concern')::int`,
    })
    .from(s.coachReview)
    .where(gte(s.coachReview.createdAt, monthStart(now)));
  return {
    open: rows.map<ReviewRow>((r) => ({ ...r, title: titleOf(r), note: r.note ? decrypt(r.note) : null })),
    month: { ok: month?.ok ?? 0, concern: month?.concern ?? 0 },
  };
}

export async function resolveReview(ctx: Ctx, reviewId: string, resolution: string) {
  requireAi(ctx.actor);
  const text = resolution.trim().slice(0, 1000);
  const r = await db
    .update(s.coachReview)
    .set({ resolvedAt: new Date(), resolvedBy: ctx.actor!.personId, resolution: text ? encrypt(text) : null, updatedAt: new Date() })
    .where(and(eq(s.coachReview.id, reviewId), isNull(s.coachReview.resolvedAt)))
    .returning({ id: s.coachReview.id, attemptId: s.coachReview.attemptId });
  if (r.length) await audit(db, ctx, { action: "coach_review.resolve", entityType: "coach_review", entityId: reviewId, meta: { attemptId: r[0]!.attemptId } });
  return r.length > 0;
}

/** Reviews of one student's speeches, for the staff student page. */
export async function reviewsFor(attemptIds: string[]) {
  if (!attemptIds.length) return [];
  const rows = await db
    .select({
      attemptId: s.coachReview.attemptId,
      verdict: s.coachReview.verdict,
      reason: s.coachReview.reason,
      note: s.coachReview.note,
      reviewer: s.person.firstName,
      resolvedAt: s.coachReview.resolvedAt,
      createdAt: s.coachReview.createdAt,
    })
    .from(s.coachReview)
    .innerJoin(s.person, eq(s.person.id, s.coachReview.reviewerId))
    .where(inArray(s.coachReview.attemptId, attemptIds));
  return rows.map((r) => ({ ...r, note: r.note ? decrypt(r.note) : null }));
}
