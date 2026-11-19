import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { can, type Actor } from "@/server/permissions/can";
import { Forbidden } from "@/server/permissions/assert";
import { basicStudent, type BasicStudent } from "@/server/validation/student";

/**
 * A cohort's student list for whoever may see the cohort (spec/03 §4.2). Coaches and champions
 * get the basic view only: the query never selects surname, phone, date of birth or guardians,
 * and the result is parsed through a strict schema so an extra field fails loudly.
 */
export async function cohortStudents(actor: Actor, cohortId: string): Promise<BasicStudent[]> {
  const [c] = await db
    .select({ id: s.cohort.id, schoolId: s.cohort.schoolId, stateId: s.school.stateId, aiCoachEnabled: s.cohort.aiCoachEnabled })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(and(eq(s.cohort.id, cohortId), isNull(s.cohort.deletedAt)));
  if (!c) throw new Forbidden("cohort.view");
  const resource = { personId: null, stateId: c.stateId, schoolId: c.schoolId, cohortIds: [c.id], aiReady: false };
  if (!can(actor, "cohort.view", resource)) throw new Forbidden("cohort.view");

  const rows = await db
    .select({
      id: s.person.id,
      firstName: s.person.firstName,
      avatarKey: s.person.avatarKey,
      classLevel: s.person.classLevel,
      schoolName: s.school.name,
    })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .leftJoin(s.school, eq(s.school.id, s.person.schoolId))
    .where(
      and(eq(s.cohortMember.cohortId, cohortId), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn), isNull(s.person.deletedAt)),
    )
    .orderBy(s.person.firstName);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);

  const [att, scores] = await Promise.all([
    db
      .select({
        personId: s.attendance.personId,
        held: sql<number>`count(*)::int`,
        present: sql<number>`count(*) filter (where ${s.attendance.status} = 'present')::int`,
      })
      .from(s.attendance)
      .innerJoin(s.session, eq(s.session.id, s.attendance.sessionId))
      .where(and(eq(s.session.cohortId, cohortId), eq(s.session.status, "held"), inArray(s.attendance.personId, ids)))
      .groupBy(s.attendance.personId),
    db
      .select({ personId: s.assessment.personId, total: s.assessment.rubricTotal, takenAt: s.assessment.takenAt })
      .from(s.assessment)
      .where(and(eq(s.assessment.cohortId, cohortId), inArray(s.assessment.personId, ids)))
      .orderBy(desc(s.assessment.takenAt)),
  ]);

  return rows.map((r) => {
    const a = att.find((x) => x.personId === r.id);
    const last = scores.find((x) => x.personId === r.id && x.total !== null);
    return toBasicStudent({
      ...r,
      attendancePct: a && a.held ? Math.round((a.present / a.held) * 100) : null,
      lastScore: last ? Number(last.total) : null,
    });
  });
}

/** The only way a student leaves the server for a coach: picks the allowed fields, then checks them. */
export function toBasicStudent(r: {
  id: string;
  firstName: string;
  avatarKey: string;
  classLevel: string | null;
  schoolName: string | null;
  attendancePct: number | null;
  lastScore: number | null;
}): BasicStudent {
  return basicStudent.parse({
    id: r.id,
    firstName: r.firstName,
    avatarKey: r.avatarKey,
    classLevel: r.classLevel,
    schoolName: r.schoolName,
    attendancePct: r.attendancePct,
    lastScore: r.lastScore,
  });
}
