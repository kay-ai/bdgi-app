import "server-only";
import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { actorStates, hasRole, type Actor, type Role } from "./can";

const none = sql`false`;
const all = sql`true`;
const anyOf = (parts: (SQL | undefined)[]) => {
  const p = parts.filter((x): x is SQL => !!x);
  return p.length === 0 ? none : p.length === 1 ? p[0]! : or(...p)!;
};
const inIds = (col: Parameters<typeof inArray>[0], ids: string[]) => (ids.length ? inArray(col, ids) : undefined);

/** Students currently in a cohort the actor coaches. */
const coachedStudentIds = (cohortIds: string[]) =>
  db
    .select({ id: s.cohortMember.personId })
    .from(s.cohortMember)
    .where(and(inArray(s.cohortMember.cohortId, cohortIds), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn)));

/**
 * Which `person` rows (students) the actor may see (spec/03 §4). Staff: all (state leads: their
 * states); volunteer: students in cohorts they coach now; champion: their school; guardian: their
 * children; student: themselves.
 */
export function scopeStudents(actor: Actor): SQL {
  if (hasRole(actor, "programme_manager", "safeguarding_lead", "admin")) return all;
  return anyOf([
    hasRole(actor, "state_lead") ? inIds(s.person.stateId, actorStates(actor)) : undefined,
    hasRole(actor, "volunteer") && actor.coachCohortIds.length ? inArray(s.person.id, coachedStudentIds(actor.coachCohortIds)) : undefined,
    hasRole(actor, "school_champion") ? inIds(s.person.schoolId, actor.championSchoolIds) : undefined,
    hasRole(actor, "guardian") ? inIds(s.person.id, actor.childIds) : undefined,
    hasRole(actor, "student") ? eq(s.person.id, actor.personId) : undefined,
  ]);
}

export function scopeSchools(actor: Actor): SQL {
  if (hasRole(actor, "programme_manager", "safeguarding_lead", "admin")) return all;
  const coachedSchools = actor.coachCohortIds.length
    ? inArray(s.school.id, db.select({ id: s.cohort.schoolId }).from(s.cohort).where(inArray(s.cohort.id, actor.coachCohortIds)))
    : undefined;
  return anyOf([
    hasRole(actor, "state_lead") ? inIds(s.school.stateId, actorStates(actor)) : undefined,
    hasRole(actor, "volunteer") ? coachedSchools : undefined,
    hasRole(actor, "school_champion") ? inIds(s.school.id, actor.championSchoolIds) : undefined,
  ]);
}

export function scopeCohorts(actor: Actor): SQL {
  if (hasRole(actor, "programme_manager", "safeguarding_lead", "admin")) return all;
  const memberOf = (ids: string[]) =>
    ids.length
      ? inArray(s.cohort.id, db.select({ id: s.cohortMember.cohortId }).from(s.cohortMember).where(inArray(s.cohortMember.personId, ids)))
      : undefined;
  return anyOf([
    hasRole(actor, "state_lead") && actorStates(actor).length
      ? inArray(s.cohort.schoolId, db.select({ id: s.school.id }).from(s.school).where(inArray(s.school.stateId, actorStates(actor))))
      : undefined,
    hasRole(actor, "volunteer") ? inIds(s.cohort.id, actor.coachCohortIds) : undefined,
    hasRole(actor, "school_champion") ? inIds(s.cohort.schoolId, actor.championSchoolIds) : undefined,
    hasRole(actor, "guardian") ? memberOf(actor.childIds) : undefined,
    hasRole(actor, "student") ? memberOf([actor.personId]) : undefined,
  ]);
}

/** Volunteer records: staff who may review applications; a volunteer sees their own. */
export function scopeVolunteers(actor: Actor): SQL {
  if (hasRole(actor, "programme_manager", "safeguarding_lead", "admin")) return all;
  return anyOf([
    hasRole(actor, "state_lead") ? inIds(s.person.stateId, actorStates(actor)) : undefined,
    hasRole(actor, "volunteer") ? eq(s.person.id, actor.personId) : undefined,
  ]);
}

/** Build the Actor for a person: active roles plus the relationships `can()` checks against. */
export async function loadActor(userId: string, personId: string): Promise<Actor | null> {
  const [p] = await db
    .select({ id: s.person.id, firstName: s.person.firstName, userId: s.person.userId, deletedAt: s.person.deletedAt })
    .from(s.person)
    .where(eq(s.person.id, personId));
  if (!p || p.deletedAt) return null;
  const [roles, children, coaching, schools] = await Promise.all([
    db
      .select({ role: s.personRole.role, stateId: s.personRole.stateId })
      .from(s.personRole)
      .where(and(eq(s.personRole.personId, personId), isNull(s.personRole.revokedAt))),
    db.select({ id: s.guardianLink.studentId }).from(s.guardianLink).where(eq(s.guardianLink.guardianId, personId)),
    db
      .select({ id: s.cohortMember.cohortId })
      .from(s.cohortMember)
      .where(and(eq(s.cohortMember.personId, personId), inArray(s.cohortMember.role, ["lead_coach", "assistant_coach"]), isNull(s.cohortMember.leftOn))),
    db.select({ id: s.school.id }).from(s.school).where(eq(s.school.championId, personId)),
  ]);
  return {
    userId,
    personId,
    firstName: p.firstName,
    roles: roles.map((r) => ({ role: r.role as Role, stateId: r.stateId })),
    childIds: children.map((c) => c.id),
    coachCohortIds: coaching.map((c) => c.id),
    championSchoolIds: schools.map((c) => c.id),
  };
}
