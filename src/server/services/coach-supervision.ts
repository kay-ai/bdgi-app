import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { encrypt } from "@/lib/crypto";
import { LESSON, LESSONS, PLACEMENT, SKILLS, type SkillKey } from "@/server/coach/curriculum";
import type { Metrics } from "@/server/coach/metrics";
import { nextLesson, rankFor, weakest, type Rank, type Ratings } from "@/server/coach/tailor";
import { can, type Actor } from "@/server/permissions/can";
import { audit, type Ctx } from "./audit";
import { eligibility, type Feedback, type Scores } from "./speech";

/**
 * The human coach's side of the speech coach (D-015). The AI listens to each student and guides
 * her along her own path; her group plays no part in that. The volunteers who lead a group
 * supervise: they see how each of their students is getting on with the AI, which students need
 * a look, and every scorecard's feedback, and they mark each scorecard "looks right" or "needs a
 * look" for staff. They never hear the recording or read the transcript (spec/12 §4).
 */

const DAY = 86_400_000;
/** Thresholds for "needs a look". */
export const ATTENTION = { quietDays: 14, lowStars: 2, stuckTries: 3, troubleOf: 5, troubleCount: 2 };

export type AttentionCode = "never_tried" | "cannot_practise" | "quiet" | "low_stars" | "stuck" | "recording_trouble" | "ai_fallback" | "concern_open";

export type StudentSummary = {
  id: string;
  firstName: string;
  avatarKey: string;
  rank: Rank | null;
  mean: number | null;
  lessonsPassed: number;
  lessonsTotal: number;
  nextLesson: string | null;
  weakest: string[];
  scored: number;
  thisMonth: number;
  lastAt: Date | null;
  recentStars: number | null;
  starsChange: number | null;
  unreviewed: number;
  attention: AttentionCode[];
  cannotPractise: string | null;
};

type Visible = { personId: string; cohortId: string };

/**
 * Students this coach may supervise: current members of a group she leads or assists, with active
 * participation permission (or 18+), as for every other coach view (spec/09 rule 2).
 */
async function visibleStudents(actor: Actor, onlyPersonId?: string): Promise<Visible[]> {
  if (!actor.coachCohortIds.length) return [];
  const rows = await db
    .select({ personId: s.cohortMember.personId, cohortId: s.cohortMember.cohortId, age: s.person.ageAtSignup })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .innerJoin(s.cohort, eq(s.cohort.id, s.cohortMember.cohortId))
    .where(
      and(
        inArray(s.cohortMember.cohortId, actor.coachCohortIds),
        eq(s.cohortMember.role, "student"),
        isNull(s.cohortMember.leftOn),
        isNull(s.person.deletedAt),
        isNull(s.cohort.deletedAt),
        onlyPersonId ? eq(s.cohortMember.personId, onlyPersonId) : undefined,
        or(
          sql`${s.person.ageAtSignup} >= 18`,
          sql`exists (select 1 from consent c where c.student_id = ${s.person.id} and c.type = 'participation' and c.given_at is not null and c.withdrawn_at is null)`,
        ),
      ),
    );
  return rows.filter((r) => can(actor, "speech.view", { personId: r.personId, cohortIds: [r.cohortId] })).map(({ personId, cohortId }) => ({ personId, cohortId }));
}

function titleOf(a: { kind: string; lessonKey: string | null; motion: string | null }) {
  if (a.kind === "placement") return "First speech (placement)";
  if (a.kind === "lesson" && a.lessonKey && LESSON[a.lessonKey]) return LESSON[a.lessonKey]!.title;
  return a.motion ?? "Free practice";
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

async function summaries(actor: Actor, ids: string[], now: Date): Promise<Map<string, StudentSummary>> {
  const out = new Map<string, StudentSummary>();
  if (!ids.length) return out;
  const [people, skills, lessons, attempts, myReviews, concerns] = await Promise.all([
    db.select({ id: s.person.id, firstName: s.person.firstName, avatarKey: s.person.avatarKey }).from(s.person).where(inArray(s.person.id, ids)),
    db.select({ personId: s.coachSkill.personId, k: s.coachSkill.skillKey, r: s.coachSkill.rating }).from(s.coachSkill).where(inArray(s.coachSkill.personId, ids)),
    db
      .select({ personId: s.coachLesson.personId, key: s.coachLesson.lessonKey, status: s.coachLesson.status, attempts: s.coachLesson.attempts })
      .from(s.coachLesson)
      .where(inArray(s.coachLesson.personId, ids)),
    db
      .select({ id: s.speechAttempt.id, personId: s.speechAttempt.personId, status: s.speechAttempt.status, stars: s.speechAttempt.overallStars, feedback: s.speechAttempt.feedback, createdAt: s.speechAttempt.createdAt })
      .from(s.speechAttempt)
      .where(inArray(s.speechAttempt.personId, ids))
      .orderBy(desc(s.speechAttempt.createdAt)),
    db
      .select({ attemptId: s.coachReview.attemptId })
      .from(s.coachReview)
      .innerJoin(s.speechAttempt, eq(s.speechAttempt.id, s.coachReview.attemptId))
      .where(and(eq(s.coachReview.reviewerId, actor.personId), inArray(s.speechAttempt.personId, ids))),
    db
      .select({ personId: s.speechAttempt.personId })
      .from(s.coachReview)
      .innerJoin(s.speechAttempt, eq(s.speechAttempt.id, s.coachReview.attemptId))
      .where(and(inArray(s.speechAttempt.personId, ids), eq(s.coachReview.verdict, "concern"), isNull(s.coachReview.resolvedAt))),
  ]);
  const reviewed = new Set(myReviews.map((r) => r.attemptId));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const elig = await Promise.all(ids.map((id) => eligibility(id, now)));

  ids.forEach((id, i) => {
    const p = people.find((x) => x.id === id);
    if (!p) return;
    const ratings = Object.fromEntries(skills.filter((x) => x.personId === id).map((x) => [x.k, Number(x.r)])) as Ratings;
    const mine = lessons.filter((l) => l.personId === id);
    const passed = new Set(mine.filter((l) => l.status === "passed").map((l) => l.key));
    const all = attempts.filter((a) => a.personId === id);
    const done = all.filter((a) => a.status === "done");
    const stars = done.map((a) => a.stars).filter((n): n is number => n !== null);
    const recent = avg(stars.slice(0, 3));
    const before = avg(stars.slice(3, 6));
    const placed = Object.keys(ratings).length > 0;
    const e = elig[i]!;
    const attention: AttentionCode[] = [];
    if (!e.ok && e.reason !== "cap") attention.push("cannot_practise");
    if (!all.length) attention.push("never_tried");
    else if (now.getTime() - all[0]!.createdAt.getTime() > ATTENTION.quietDays * DAY) attention.push("quiet");
    if (stars.length >= 3 && recent !== null && recent <= ATTENTION.lowStars) attention.push("low_stars");
    if (mine.some((l) => l.status !== "passed" && l.attempts >= ATTENTION.stuckTries)) attention.push("stuck");
    if (all.slice(0, ATTENTION.troubleOf).filter((a) => a.status === "rejected" || a.status === "failed").length >= ATTENTION.troubleCount) attention.push("recording_trouble");
    if ((done[0]?.feedback as Feedback | null)?.usedFallback) attention.push("ai_fallback");
    if (concerns.some((c) => c.personId === id)) attention.push("concern_open");
    const next = placed ? nextLesson(ratings, passed) : null;
    out.set(id, {
      id,
      firstName: p.firstName,
      avatarKey: p.avatarKey,
      rank: placed ? rankFor(ratings).rank : null,
      mean: placed ? rankFor(ratings).mean : null,
      lessonsPassed: passed.size,
      lessonsTotal: LESSONS.length,
      nextLesson: next?.title ?? null,
      weakest: placed ? weakest(ratings, 2).map((k) => SKILLS.find((x) => x.key === k)!.name) : [],
      scored: done.length,
      thisMonth: all.filter((a) => a.createdAt >= monthStart).length,
      lastAt: all[0]?.createdAt ?? null,
      recentStars: recent,
      starsChange: recent !== null && before !== null ? Math.round((recent - before) * 10) / 10 : null,
      unreviewed: done.slice(0, 10).filter((a) => !reviewed.has(a.id)).length,
      attention,
      cannotPractise: !e.ok ? e.reason : null,
    });
  });
  return out;
}

export type SupervisionGroup = {
  cohortId: string;
  name: string;
  school: string;
  students: StudentSummary[];
  practisingThisMonth: number;
  needsLook: number;
};

/** The coach's home: each of her groups, students needing a look first. */
export async function supervision(actor: Actor, now = new Date()): Promise<SupervisionGroup[]> {
  const visible = await visibleStudents(actor);
  const sums = await summaries(actor, [...new Set(visible.map((v) => v.personId))], now);
  const cohorts = actor.coachCohortIds.length
    ? await db
        .select({ id: s.cohort.id, name: s.cohort.name, school: s.school.name })
        .from(s.cohort)
        .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
        .where(and(inArray(s.cohort.id, actor.coachCohortIds), isNull(s.cohort.deletedAt)))
    : [];
  return cohorts.map((c) => {
    const students = visible
      .filter((v) => v.cohortId === c.id)
      .map((v) => sums.get(v.personId))
      .filter((x): x is StudentSummary => !!x)
      .sort((a, b) => b.attention.length - a.attention.length || a.firstName.localeCompare(b.firstName));
    return {
      cohortId: c.id,
      name: c.name,
      school: c.school,
      students,
      practisingThisMonth: students.filter((x) => x.thisMonth > 0).length,
      needsLook: students.filter((x) => x.attention.length > 0).length,
    };
  });
}

export type CoachScorecard = {
  id: string;
  title: string;
  motion: string | null;
  side: string;
  channel: string;
  status: string;
  rejectReason: string | null;
  stars: number | null;
  metrics: Pick<Metrics, "wpm" | "fillersPerMin" | "durationSeconds"> | null;
  bars: Scores["bars"] | null;
  feedback: Pick<Feedback, "strengths" | "nextSteps" | "encouragement" | "betterLine" | "focus" | "usedFallback"> | null;
  lessonPass: number | null;
  createdAt: Date;
  myReview: { verdict: "ok" | "concern"; reason: string | null } | null;
  resolved: boolean;
};

/**
 * One student's coaching, for her coach: progress on her own path and her recent scorecards with
 * the AI's feedback. No audio and no transcript; the AI's "stronger way to say it" quotes one
 * sentence of hers, which the coach needs to judge that advice.
 */
export async function studentForCoach(actor: Actor, personId: string, now = new Date()) {
  if (!/^[0-9a-f-]{36}$/.test(personId)) return null;
  const visible = await visibleStudents(actor, personId);
  if (!visible.length) return null;
  const summary = (await summaries(actor, [personId], now)).get(personId);
  if (!summary) return null;
  const skills = await db.select({ k: s.coachSkill.skillKey, r: s.coachSkill.rating }).from(s.coachSkill).where(eq(s.coachSkill.personId, personId));
  const rows = await db
    .select({
      id: s.speechAttempt.id,
      kind: s.speechAttempt.kind,
      lessonKey: s.speechAttempt.lessonKey,
      motion: s.motion.textEn,
      side: s.speechAttempt.side,
      channel: s.speechAttempt.channel,
      status: s.speechAttempt.status,
      rejectReason: s.speechAttempt.rejectReason,
      stars: s.speechAttempt.overallStars,
      metrics: s.speechAttempt.metrics,
      scores: s.speechAttempt.scores,
      feedback: s.speechAttempt.feedback,
      createdAt: s.speechAttempt.createdAt,
    })
    .from(s.speechAttempt)
    .leftJoin(s.motion, eq(s.motion.id, s.speechAttempt.motionId))
    .where(eq(s.speechAttempt.personId, personId))
    .orderBy(desc(s.speechAttempt.createdAt))
    .limit(15);
  const reviews = rows.length
    ? await db
        .select({ attemptId: s.coachReview.attemptId, reviewerId: s.coachReview.reviewerId, verdict: s.coachReview.verdict, reason: s.coachReview.reason, resolvedAt: s.coachReview.resolvedAt })
        .from(s.coachReview)
        .where(inArray(s.coachReview.attemptId, rows.map((r) => r.id)))
    : [];
  const scorecards: CoachScorecard[] = rows.map((r) => {
    const m = r.metrics as Metrics | null;
    const f = r.feedback as Feedback | null;
    const lesson = r.lessonKey ? LESSON[r.lessonKey] : undefined;
    const mine = reviews.find((x) => x.attemptId === r.id && x.reviewerId === actor.personId);
    return {
      id: r.id,
      title: titleOf(r),
      motion: lesson ? lesson.drill.motion : r.kind === "placement" ? PLACEMENT.motion : r.motion,
      side: r.side,
      channel: r.channel,
      status: r.status,
      rejectReason: r.rejectReason,
      stars: r.stars,
      metrics: m && "wpm" in m ? { wpm: m.wpm, fillersPerMin: m.fillersPerMin, durationSeconds: m.durationSeconds } : null,
      bars: (r.scores as Scores | null)?.bars ?? null,
      feedback: f ? { strengths: f.strengths, nextSteps: f.nextSteps, encouragement: f.encouragement, betterLine: f.betterLine, focus: f.focus, usedFallback: f.usedFallback } : null,
      lessonPass: lesson?.drill.passScore ?? null,
      createdAt: r.createdAt,
      myReview: mine ? { verdict: mine.verdict, reason: mine.reason } : null,
      resolved: reviews.some((x) => x.attemptId === r.id && x.verdict === "concern" && x.resolvedAt !== null),
    };
  });
  const ratings = Object.fromEntries(skills.map((x) => [x.k, Number(x.r)])) as Partial<Record<SkillKey, number>>;
  return {
    summary,
    skills: SKILLS.map((k) => ({ key: k.key, name: k.name, area: k.area, rating: ratings[k.key] ?? null })),
    scorecards,
  };
}

export const reviewInput = z
  .object({
    attemptId: z.string().uuid(),
    verdict: z.enum(["ok", "concern"]),
    reason: z.enum(["score_wrong", "feedback_wrong", "feedback_unhelpful", "tone", "other"]).optional().nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((v) => v.verdict === "ok" || !!v.reason, { path: ["reason"] });

/** A coach marks one scorecard "looks right" or "needs a look" (with a reason) for staff. */
export async function reviewScorecard(ctx: Ctx, raw: unknown): Promise<{ ok: true } | { ok: false; code: "invalid" | "not_found" }> {
  const actor = ctx.actor;
  const p = reviewInput.safeParse(raw);
  if (!actor || !p.success) return { ok: false, code: "invalid" };
  const v = p.data;
  const [a] = await db.select({ personId: s.speechAttempt.personId, status: s.speechAttempt.status }).from(s.speechAttempt).where(eq(s.speechAttempt.id, v.attemptId));
  if (!a || a.status !== "done" || !(await visibleStudents(actor, a.personId)).length) return { ok: false, code: "not_found" };
  const values = {
    verdict: v.verdict,
    reason: v.verdict === "concern" ? (v.reason ?? "other") : null,
    note: v.note ? encrypt(v.note) : null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(s.coachReview)
    .values({ attemptId: v.attemptId, reviewerId: actor.personId, ...values })
    .onConflictDoUpdate({ target: [s.coachReview.attemptId, s.coachReview.reviewerId], set: values })
    .returning({ id: s.coachReview.id });
  await audit(db, ctx, { action: "coach_review.save", entityType: "coach_review", entityId: row!.id, subjectPersonId: a.personId, meta: { verdict: v.verdict, reason: values.reason } });
  return { ok: true };
}
