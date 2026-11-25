import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt } from "@/lib/crypto";
import { LESSON } from "@/server/coach/curriculum";
import { assertCan } from "@/server/permissions/assert";
import { can, type Actor } from "@/server/permissions/can";
import { scopeStudents } from "@/server/permissions/scope";
import { studentGroups, studentProgress } from "./student-progress";

/**
 * One student in the console (spec/07 person page, cut down; D-022): who she is, her family and
 * permissions, her groups and coaches, her own progress and recent speeches. Contact details and
 * transcripts are not shown here: messages have their own page, transcripts the audited AI page.
 */

const plain = (enc: string | null) => {
  try {
    return decrypt(enc) ?? "";
  } catch {
    return "";
  }
};

const CONSENTS = ["participation", "ai_practice", "photo", "stories"] as const;

export async function studentDetail(actor: Actor | null, personId: string) {
  if (!/^[0-9a-f-]{36}$/.test(personId)) return null;
  const [p] = await db
    .select({
      id: s.person.id,
      firstName: s.person.firstName,
      surname: s.person.surname,
      preferredName: s.person.preferredName,
      age: s.person.ageAtSignup,
      gender: s.person.gender,
      classLevel: s.person.classLevel,
      status: s.person.status,
      avatarKey: s.person.avatarKey,
      createdAt: s.person.createdAt,
      stateId: s.person.stateId,
      schoolId: s.person.schoolId,
      school: sql<string | null>`coalesce(${s.school.name}, ${s.person.schoolOther})`,
      state: s.state.name,
      lga: s.lga.name,
    })
    .from(s.person)
    .leftJoin(s.school, eq(s.school.id, s.person.schoolId))
    .leftJoin(s.state, eq(s.state.id, s.person.stateId))
    .leftJoin(s.lga, eq(s.lga.id, s.person.lgaId))
    .where(
      and(
        eq(s.person.id, personId),
        isNull(s.person.deletedAt),
        sql`exists (select 1 from person_role r where r.person_id = ${s.person.id} and r.role = 'student' and r.revoked_at is null)`,
        actor ? scopeStudents(actor) : sql`false`,
      ),
    );
  if (!p) return null;
  assertCan(actor, "intake.review", { resource: { personId, stateId: p.stateId } });

  const [guardians, consents, [intake], groups, progress, speeches, [concerns]] = await Promise.all([
    db
      .select({ firstName: s.person.firstName, relationship: s.guardianLink.relationship, isPrimary: s.guardianLink.isPrimary })
      .from(s.guardianLink)
      .innerJoin(s.person, eq(s.person.id, s.guardianLink.guardianId))
      .where(eq(s.guardianLink.studentId, personId))
      .orderBy(desc(s.guardianLink.isPrimary)),
    db
      .select({ type: s.consent.type, givenAt: s.consent.givenAt, withdrawnAt: s.consent.withdrawnAt, method: s.consent.method })
      .from(s.consent)
      .where(eq(s.consent.studentId, personId))
      .orderBy(desc(s.consent.createdAt)),
    db
      .select({ dreamCareer: s.intakeResponse.dreamCareer, communityDream: s.intakeResponse.communityDream, interests: s.intakeResponse.interests, needs: s.intakeResponse.needs, completedAt: s.intakeResponse.completedAt })
      .from(s.intakeResponse)
      .where(eq(s.intakeResponse.personId, personId)),
    studentGroups(personId),
    studentProgress(personId),
    db
      .select({
        id: s.speechAttempt.id,
        kind: s.speechAttempt.kind,
        lessonKey: s.speechAttempt.lessonKey,
        motion: s.motion.textEn,
        status: s.speechAttempt.status,
        stars: s.speechAttempt.overallStars,
        channel: s.speechAttempt.channel,
        createdAt: s.speechAttempt.createdAt,
      })
      .from(s.speechAttempt)
      .leftJoin(s.motion, eq(s.motion.id, s.speechAttempt.motionId))
      .where(eq(s.speechAttempt.personId, personId))
      .orderBy(desc(s.speechAttempt.createdAt))
      .limit(8),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.coachReview)
      .innerJoin(s.speechAttempt, eq(s.speechAttempt.id, s.coachReview.attemptId))
      .where(and(eq(s.speechAttempt.personId, personId), eq(s.coachReview.verdict, "concern"), isNull(s.coachReview.resolvedAt))),
  ]);

  // The latest record of each kind of permission decides its state.
  const permission = CONSENTS.map((type) => {
    const c = consents.find((x) => x.type === type);
    return { type, state: !c ? "none" : c.withdrawnAt ? "withdrawn" : c.givenAt ? "given" : "waiting", method: c?.method ?? null, at: c?.withdrawnAt ?? c?.givenAt ?? null };
  });
  const cohortIds = groups.map((g) => g.id);
  return {
    person: { ...p, surname: plain(p.surname) },
    guardians,
    permission,
    profile: intake ?? null,
    groups,
    progress,
    speeches: speeches.map((a) => ({
      ...a,
      title: a.kind === "placement" ? "First speech" : a.kind === "lesson" && a.lessonKey && LESSON[a.lessonKey] ? LESSON[a.lessonKey]!.title : (a.motion ?? "Free practice"),
    })),
    openConcerns: concerns?.n ?? 0,
    canSeeSpeech: can(actor, "speech.view", { personId, stateId: p.stateId, cohortIds }),
    canManageGroups: can(actor, "cohort.manage", { stateId: p.stateId }),
    canDecide: p.status === "pending_review" || p.status === "waitlisted",
  };
}
