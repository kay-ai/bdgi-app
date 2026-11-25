import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash } from "@/lib/crypto";
import { normalisePhone } from "@/lib/phone";
import { Forbidden, assertCan } from "@/server/permissions/assert";
import { can, hasRole, type Actor } from "@/server/permissions/can";
import { scopeCohorts, scopeSchools, scopeStudents, scopeVolunteers } from "@/server/permissions/scope";
import { audit } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { contactMode, reach } from "./reach";

/**
 * Groups (cohorts) in the console (spec/07, M5 cut down; D-021): staff create a group at a school,
 * place students in it and assign coaches. A coach must be an active volunteer whose safeguarding is
 * cleared: finished training and signed code of conduct (spec/06 §3.2), or, while that training is
 * not built, a staff member confirming her checks. The service enforces it, whatever the form sends.
 */

export const GROUP_STATUSES = ["draft", "open", "running", "completed", "cancelled"] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];
type Result<T = object> = ({ ok: true } & T) | { ok: false; code: string };

const today = () => new Date().toISOString().slice(0, 10);
const surnameOf = (enc: string | null) => {
  try {
    return decrypt(enc) ?? "";
  } catch {
    return "";
  }
};
const like = (q?: string) => (q && q.trim() ? `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null);
const isCoachRole = inArray(s.cohortMember.role, ["lead_coach", "assistant_coach"]);

/** A volunteer may coach once she is active and her safeguarding is cleared. */
export function clearedToCoach(v: { stage: string; trainingCompletedAt: Date | null; codeOfConductSignedAt: Date | null; safeguardingCheckedAt: Date | null }) {
  return v.stage === "active" && (!!v.safeguardingCheckedAt || (!!v.trainingCompletedAt && !!v.codeOfConductSignedAt));
}

/** The group with the state of its school, or null if it's gone or outside the actor's scope. */
async function groupFor(actor: Actor, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [g] = await db
    .select({ cohort: s.cohort, stateId: s.school.stateId, schoolName: s.school.name })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(and(eq(s.cohort.id, id), isNull(s.cohort.deletedAt), scopeCohorts(actor)));
  return g ?? null;
}

/* ---------- List and form options ---------- */

export async function listGroups(actor: Actor | null, f: { status?: string; q?: string } = {}) {
  assertCan(actor, "cohort.manage");
  const q = like(f.q);
  const where = and(
    isNull(s.cohort.deletedAt),
    scopeCohorts(actor!),
    f.status && (GROUP_STATUSES as readonly string[]).includes(f.status) ? eq(s.cohort.status, f.status as GroupStatus) : undefined,
    q ? or(ilike(s.cohort.name, q), ilike(s.school.name, q)) : undefined,
  );
  const rows = await db
    .select({
      id: s.cohort.id,
      name: s.cohort.name,
      term: s.cohort.term,
      status: s.cohort.status,
      startsOn: s.cohort.startsOn,
      endsOn: s.cohort.endsOn,
      capacity: s.cohort.capacity,
      school: s.school.name,
      state: s.state.name,
      programme: s.programme.nameEn,
      students: sql<number>`(select count(*)::int from cohort_member m where m.cohort_id = ${s.cohort.id} and m.role = 'student' and m.left_on is null)`,
      coaches: sql<string | null>`(select string_agg(p.first_name, ', ' order by m.role desc, p.first_name) from cohort_member m join person p on p.id = m.person_id where m.cohort_id = ${s.cohort.id} and m.role in ('lead_coach','assistant_coach') and m.left_on is null)`,
    })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .leftJoin(s.state, eq(s.state.id, s.school.stateId))
    .innerJoin(s.programme, eq(s.programme.id, s.cohort.programmeId))
    .where(where)
    .orderBy(sql`case ${s.cohort.status} when 'running' then 0 when 'open' then 1 when 'draft' then 2 else 3 end`, desc(s.cohort.startsOn))
    .limit(200);
  const byStatus = await db
    .select({ status: s.cohort.status, n: count() })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(and(isNull(s.cohort.deletedAt), scopeCohorts(actor!)))
    .groupBy(s.cohort.status);
  return { rows, counts: Object.fromEntries(byStatus.map((b) => [b.status, b.n])) as Record<string, number> };
}

/** Programmes and the schools this actor may create groups at. */
export async function groupFormOptions(actor: Actor | null) {
  assertCan(actor, "cohort.manage");
  const [programmes, schools] = await Promise.all([
    db.select({ id: s.programme.id, name: s.programme.nameEn }).from(s.programme).where(ne(s.programme.status, "archived")).orderBy(asc(s.programme.sort)),
    db
      .select({ id: s.school.id, name: s.school.name, state: s.state.name })
      .from(s.school)
      .leftJoin(s.state, eq(s.state.id, s.school.stateId))
      .where(and(scopeSchools(actor!), isNull(s.school.deletedAt)))
      .orderBy(asc(s.school.name))
      .limit(2000),
  ]);
  return { programmes, schools };
}

/* ---------- Create and edit ---------- */

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const groupInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    programmeId: z.string().uuid(),
    schoolId: z.string().uuid(),
    term: z.string().trim().min(2).max(40),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    meetingDay: z.number().int().min(0).max(6).nullable().optional(),
    meetingTime: time.or(z.literal("")).nullable().optional(),
    venue: z.string().trim().max(120).nullable().optional(),
    capacity: z.number().int().min(1).max(200),
    status: z.enum(GROUP_STATUSES).optional(),
  })
  .refine((v) => v.endsOn >= v.startsOn, { path: ["endsOn"] });

/** Create a group (id null) or edit one. A state lead may only use schools in her states. */
export async function saveGroup(actor: Actor | null, id: string | null, raw: unknown, ip: string | null = null): Promise<Result<{ id: string }>> {
  const p = groupInput.safeParse(raw);
  if (!p.success) return { ok: false, code: "invalid" };
  const v = p.data;
  const [school] = await db.select({ stateId: s.school.stateId }).from(s.school).where(and(eq(s.school.id, v.schoolId), isNull(s.school.deletedAt)));
  if (!school) return { ok: false, code: "invalid" };
  const ctx = assertCan(actor, "cohort.manage", { ip, resource: { stateId: school.stateId } });
  const values = {
    name: v.name,
    programmeId: v.programmeId,
    schoolId: v.schoolId,
    term: v.term,
    startsOn: v.startsOn,
    endsOn: v.endsOn,
    meetingDay: v.meetingDay ?? null,
    meetingTime: v.meetingTime || null,
    venue: v.venue || null,
    capacity: v.capacity,
  };
  if (!id) {
    const [row] = await db.transaction(async (tx) => {
      const r = await tx
        .insert(s.cohort)
        .values({ ...values, status: v.status ?? "open", createdBy: actor!.personId })
        .returning({ id: s.cohort.id });
      await audit(tx, ctx, { action: "cohort.create", entityType: "cohort", entityId: r[0]!.id, meta: { name: v.name } });
      return r;
    });
    return { ok: true, id: row!.id };
  }
  const g = await groupFor(actor!, id);
  if (!g) return { ok: false, code: "not_found" };
  assertCan(actor, "cohort.manage", { resource: { stateId: g.stateId } });
  await db.transaction(async (tx) => {
    await tx
      .update(s.cohort)
      .set({ ...values, ...(v.status ? { status: v.status, closedAt: v.status === "completed" || v.status === "cancelled" ? new Date() : null } : {}), updatedAt: new Date() })
      .where(eq(s.cohort.id, id));
    await audit(tx, ctx, { action: "cohort.update", entityType: "cohort", entityId: id, meta: { status: v.status ?? g.cohort.status } });
  });
  return { ok: true, id };
}

/* ---------- One group ---------- */

export async function groupDetail(actor: Actor | null, id: string) {
  assertCan(actor, "cohort.manage");
  const g = await groupFor(actor!, id);
  if (!g) return null;
  const [programme] = await db.select({ name: s.programme.nameEn }).from(s.programme).where(eq(s.programme.id, g.cohort.programmeId));
  const members = await db
    .select({
      personId: s.person.id,
      firstName: s.person.firstName,
      surname: s.person.surname,
      classLevel: s.person.classLevel,
      age: s.person.ageAtSignup,
      status: s.person.status,
      role: s.cohortMember.role,
      joinedOn: s.cohortMember.joinedOn,
      leftOn: s.cohortMember.leftOn,
      leftReason: s.cohortMember.leftReason,
      speeches: sql<number>`(select count(*)::int from speech_attempt a where a.person_id = ${s.person.id} and a.status = 'done')`,
      lastSpeech: sql<Date | null>`(select max(a.created_at) from speech_attempt a where a.person_id = ${s.person.id} and a.status = 'done')`,
    })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .where(eq(s.cohortMember.cohortId, id))
    .orderBy(asc(s.person.firstName));
  const view = members.map((m) => ({ ...m, surname: surnameOf(m.surname), lastSpeech: m.lastSpeech ? new Date(m.lastSpeech) : null }));
  return {
    group: { ...g.cohort, school: g.schoolName, stateId: g.stateId, programme: programme?.name ?? "" },
    students: view.filter((m) => m.role === "student" && !m.leftOn),
    coaches: view.filter((m) => m.role !== "student" && !m.leftOn),
    former: view.filter((m) => m.leftOn),
    canManage: can(actor, "cohort.manage", { stateId: g.stateId }),
  };
}

/**
 * Students who could join this group: active or waitlisted, with participation permission (or 18+),
 * in the actor's scope and not already in it. Students of the group's school come first.
 */
export async function studentCandidates(actor: Actor | null, cohortId: string, q?: string) {
  assertCan(actor, "cohort.manage");
  const g = await groupFor(actor!, cohortId);
  if (!g) return [];
  const pattern = like(q);
  const inThisGroup = db
    .select({ id: s.cohortMember.personId })
    .from(s.cohortMember)
    .where(and(eq(s.cohortMember.cohortId, cohortId), isNull(s.cohortMember.leftOn)));
  const rows = await db
    .select({
      id: s.person.id,
      firstName: s.person.firstName,
      surname: s.person.surname,
      age: s.person.ageAtSignup,
      classLevel: s.person.classLevel,
      status: s.person.status,
      school: sql<string | null>`coalesce(${s.school.name}, ${s.person.schoolOther})`,
      sameSchool: sql<boolean>`${s.person.schoolId} = ${g.cohort.schoolId}`,
      otherGroup: sql<string | null>`(select c.name from cohort_member m join cohort c on c.id = m.cohort_id where m.person_id = ${s.person.id} and m.role = 'student' and m.left_on is null and c.deleted_at is null and c.status in ('draft','open','running') limit 1)`,
    })
    .from(s.person)
    .leftJoin(s.school, eq(s.school.id, s.person.schoolId))
    .where(
      and(
        sql`exists (select 1 from person_role r where r.person_id = ${s.person.id} and r.role = 'student' and r.revoked_at is null)`,
        inArray(s.person.status, ["active", "waitlisted"]),
        isNull(s.person.deletedAt),
        scopeStudents(actor!),
        notInArray(s.person.id, inThisGroup),
        sql`(coalesce(${s.person.ageAtSignup}, 0) >= 18 or exists (select 1 from consent c where c.student_id = ${s.person.id} and c.type = 'participation' and c.given_at is not null and c.withdrawn_at is null))`,
        pattern ? ilike(s.person.firstName, pattern) : undefined,
      ),
    )
    .orderBy(sql`case when ${s.person.schoolId} = ${g.cohort.schoolId} then 0 else 1 end`, asc(s.person.firstName))
    .limit(60);
  return rows.map((r) => ({ ...r, surname: surnameOf(r.surname) }));
}

const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Place students in a group. A waitlisted student becomes active. With `notify`, each family gets
 * `student.placed` once (the event key stops repeats).
 */
export async function addStudents(actor: Actor | null, cohortId: string, personIds: string[], notify: boolean, ip: string | null = null): Promise<Result<{ added: number }>> {
  const ids = [...new Set(personIds)].filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 100);
  if (!ids.length) return { ok: false, code: "invalid" };
  if (!actor) throw new Forbidden("cohort.manage");
  const g = await groupFor(actor, cohortId);
  if (!g) return { ok: false, code: "not_found" };
  const ctx = assertCan(actor, "cohort.manage", { ip, resource: { stateId: g.stateId } });
  if (g.cohort.status === "completed" || g.cohort.status === "cancelled") return { ok: false, code: "closed" };
  const allowed = new Set((await studentCandidates(actor, cohortId)).map((c) => c.id));
  // studentCandidates is capped; check the rest one by one through the same rules.
  const pending = ids.filter((x) => !allowed.has(x));
  for (const id of pending) {
    const [ok] = await db
      .select({ id: s.person.id })
      .from(s.person)
      .where(
        and(
          eq(s.person.id, id),
          inArray(s.person.status, ["active", "waitlisted"]),
          isNull(s.person.deletedAt),
          scopeStudents(actor),
          sql`exists (select 1 from person_role r where r.person_id = ${s.person.id} and r.role = 'student' and r.revoked_at is null)`,
          sql`(coalesce(${s.person.ageAtSignup}, 0) >= 18 or exists (select 1 from consent c where c.student_id = ${s.person.id} and c.type = 'participation' and c.given_at is not null and c.withdrawn_at is null))`,
        ),
      );
    if (ok) allowed.add(id);
  }
  const chosen = ids.filter((x) => allowed.has(x));
  if (!chosen.length) return { ok: false, code: "invalid" };
  const [{ n: current } = { n: 0 }] = await db
    .select({ n: count() })
    .from(s.cohortMember)
    .where(and(eq(s.cohortMember.cohortId, cohortId), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn)));
  if (current + chosen.length > g.cohort.capacity) return { ok: false, code: "full" };

  const coach = await db
    .select({ firstName: s.person.firstName })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .where(and(eq(s.cohortMember.cohortId, cohortId), isCoachRole, isNull(s.cohortMember.leftOn)))
    .orderBy(desc(s.cohortMember.role))
    .limit(1);
  const msgIds: string[] = [];
  await db.transaction(async (tx) => {
    for (const personId of chosen) {
      await tx
        .insert(s.cohortMember)
        .values({ cohortId, personId, role: "student", joinedOn: today() })
        .onConflictDoUpdate({ target: [s.cohortMember.cohortId, s.cohortMember.personId], set: { role: "student", leftOn: null, leftReason: null, joinedOn: today(), updatedAt: new Date() } });
      const [p] = await tx
        .update(s.person)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(s.person.id, personId), eq(s.person.status, "waitlisted")))
        .returning({ id: s.person.id });
      await audit(tx, ctx, { action: "cohort.add_student", entityType: "cohort", entityId: cohortId, subjectPersonId: personId, meta: { fromWaitlist: !!p } });
      if (!notify) continue;
      const [who] = await tx
        .select({ firstName: s.person.firstName, age: s.person.ageAtSignup, phone: s.person.phone, email: s.person.email, preferredChannel: s.person.preferredChannel })
        .from(s.person)
        .where(eq(s.person.id, personId));
      const [guardian] = await tx
        .select({ phone: s.person.phone, email: s.person.email, preferredChannel: s.person.preferredChannel })
        .from(s.guardianLink)
        .innerJoin(s.person, eq(s.person.id, s.guardianLink.guardianId))
        .where(eq(s.guardianLink.studentId, personId))
        .orderBy(desc(s.guardianLink.isPrimary))
        .limit(1);
      const target = guardian && (who?.age ?? 0) < 18 ? guardian : (who ?? guardian);
      const to = target ? reach(target) : null;
      if (!to || !who) continue;
      const id = await queueTemplate(
        {
          templateKey: "student.placed",
          to: to.to,
          channel: to.channel,
          personId,
          vars: {
            firstName: who.firstName,
            cohortName: g.cohort.name,
            date: fmtDate(g.cohort.startsOn),
            time: g.cohort.meetingTime ? g.cohort.meetingTime.slice(0, 5) : "time to be confirmed",
            venue: g.cohort.venue || g.schoolName,
            coachName: coach[0]?.firstName ?? "to be confirmed",
          },
          eventKey: `student.placed:${cohortId}:${personId}`,
        },
        tx,
      );
      if (id) msgIds.push(id);
    }
  });
  await dispatch(msgIds).catch((e) => console.error("[groups] placed message failed", e instanceof Error ? e.message : "unexpected"));
  return { ok: true, added: chosen.length };
}

/** Take a student or coach out of a group. Their history stays; they just stop being current. */
export async function removeMember(actor: Actor | null, cohortId: string, personId: string, reason: string, ip: string | null = null): Promise<Result> {
  if (!actor) throw new Forbidden("cohort.manage");
  const g = await groupFor(actor, cohortId);
  if (!g) return { ok: false, code: "not_found" };
  const ctx = assertCan(actor, "cohort.manage", { ip, resource: { stateId: g.stateId } });
  const r = await db
    .update(s.cohortMember)
    .set({ leftOn: today(), leftReason: reason.trim().slice(0, 200) || null, updatedAt: new Date() })
    .where(and(eq(s.cohortMember.cohortId, cohortId), eq(s.cohortMember.personId, personId), isNull(s.cohortMember.leftOn)))
    .returning({ role: s.cohortMember.role });
  if (!r.length) return { ok: false, code: "not_found" };
  await audit(db, ctx, { action: "cohort.remove_member", entityType: "cohort", entityId: cohortId, subjectPersonId: personId, meta: { role: r[0]!.role } });
  return { ok: true };
}

/* ---------- Coaches ---------- */

/** Active volunteers the actor can see, with whether each is cleared to coach and her current groups. */
export async function coachCandidates(actor: Actor | null, cohortId: string) {
  assertCan(actor, "cohort.manage");
  const g = await groupFor(actor!, cohortId);
  if (!g) return [];
  const rows = await db
    .select({
      id: s.person.id,
      firstName: s.person.firstName,
      surname: s.person.surname,
      state: s.state.name,
      stage: s.volunteerProfile.stage,
      trainingCompletedAt: s.volunteerProfile.trainingCompletedAt,
      codeOfConductSignedAt: s.volunteerProfile.codeOfConductSignedAt,
      safeguardingCheckedAt: s.volunteerProfile.safeguardingCheckedAt,
      maxCohorts: s.volunteerProfile.maxCohorts,
      groups: sql<number>`(select count(*)::int from cohort_member m join cohort c on c.id = m.cohort_id where m.person_id = ${s.person.id} and m.role in ('lead_coach','assistant_coach') and m.left_on is null and c.deleted_at is null and c.status in ('draft','open','running'))`,
    })
    .from(s.volunteerProfile)
    .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
    .leftJoin(s.state, eq(s.state.id, s.person.stateId))
    .where(
      and(
        eq(s.volunteerProfile.stage, "active"),
        isNull(s.person.deletedAt),
        scopeVolunteers(actor!),
        notInArray(
          s.person.id,
          db
            .select({ id: s.cohortMember.personId })
            .from(s.cohortMember)
            .where(and(eq(s.cohortMember.cohortId, cohortId), isNull(s.cohortMember.leftOn))),
        ),
      ),
    )
    .orderBy(asc(s.person.firstName))
    .limit(300);
  return rows.map((r) => ({ id: r.id, firstName: r.firstName, surname: surnameOf(r.surname), state: r.state, groups: r.groups, maxCohorts: r.maxCohorts, cleared: clearedToCoach(r) }));
}

export const assignInput = z.object({
  personId: z.string().uuid(),
  role: z.enum(["lead_coach", "assistant_coach"]),
  /** The staff member confirms the volunteer's safeguarding checks are done. */
  confirmSafeguarding: z.boolean().optional(),
});

/** Put a volunteer in a group as lead or assistant coach. Refused unless she is cleared (D-021). */
export async function assignCoach(actor: Actor | null, cohortId: string, raw: unknown, ip: string | null = null): Promise<Result> {
  const p = assignInput.safeParse(raw);
  if (!p.success || !actor) return { ok: false, code: "invalid" };
  const g = await groupFor(actor, cohortId);
  if (!g) return { ok: false, code: "not_found" };
  const ctx = assertCan(actor, "cohort.manage", { ip, resource: { stateId: g.stateId } });
  const [v] = await db
    .select({
      stage: s.volunteerProfile.stage,
      trainingCompletedAt: s.volunteerProfile.trainingCompletedAt,
      codeOfConductSignedAt: s.volunteerProfile.codeOfConductSignedAt,
      safeguardingCheckedAt: s.volunteerProfile.safeguardingCheckedAt,
      stateId: s.person.stateId,
    })
    .from(s.volunteerProfile)
    .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
    .where(and(eq(s.volunteerProfile.personId, p.data.personId), isNull(s.person.deletedAt), scopeVolunteers(actor)));
  if (!v || v.stage !== "active") return { ok: false, code: "not_active" };
  const cleared = clearedToCoach(v);
  if (!cleared && !p.data.confirmSafeguarding) return { ok: false, code: "not_cleared" };
  if (!cleared) assertCan(actor, "volunteer.advance_stage", { resource: { personId: p.data.personId, stateId: v.stateId } });
  await db.transaction(async (tx) => {
    if (!cleared) {
      await tx
        .update(s.volunteerProfile)
        .set({ safeguardingCheckedAt: new Date(), safeguardingCheckedBy: actor.personId, updatedAt: new Date() })
        .where(eq(s.volunteerProfile.personId, p.data.personId));
      await audit(tx, ctx, { action: "volunteer.safeguarding_checked", entityType: "person", entityId: p.data.personId, subjectPersonId: p.data.personId });
    }
    await tx
      .insert(s.cohortMember)
      .values({ cohortId, personId: p.data.personId, role: p.data.role, joinedOn: today() })
      .onConflictDoUpdate({ target: [s.cohortMember.cohortId, s.cohortMember.personId], set: { role: p.data.role, leftOn: null, leftReason: null, joinedOn: today(), updatedAt: new Date() } });
    await audit(tx, ctx, { action: "cohort.assign_coach", entityType: "cohort", entityId: cohortId, subjectPersonId: p.data.personId, meta: { role: p.data.role } });
  });
  return { ok: true };
}

export const newCoachInput = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    surname: z.string().trim().min(1).max(60),
    gender: z.enum(["female", "male", "other", "prefer_not_to_say"]),
    email: z.string().trim().toLowerCase().email().max(200).or(z.literal("")),
    phone: z.string().trim().max(30).or(z.literal("")),
    stateId: z.string().uuid(),
    occupation: z.string().trim().max(100).optional(),
    /** Required: staff confirm references, ID and a safeguarding briefing are done. */
    safeguardingChecked: z.literal(true),
    cohortId: z.string().uuid().or(z.literal("")).optional(),
    role: z.enum(["lead_coach", "assistant_coach"]).optional(),
  })
  .refine((v) => !!v.email || !!v.phone, { path: ["email"] });

/**
 * Staff add a coach directly (D-021): an active volunteer, safeguarding confirmed by the staff
 * member, told by message that her Hub is ready. Refused if the email or phone already belongs to
 * someone, so one person never ends up with two records.
 */
export async function addCoach(actor: Actor | null, raw: unknown, ip: string | null = null): Promise<Result<{ id: string }>> {
  const p = newCoachInput.safeParse(raw);
  if (!p.success) return { ok: false, code: "invalid" };
  const v = p.data;
  const ctx = assertCan(actor, "volunteer.advance_stage", { ip, resource: { stateId: v.stateId } });
  const phone = v.phone ? normalisePhone(v.phone) : null;
  if (v.phone && !phone) return { ok: false, code: "invalid_phone" };
  const clash: SQL[] = [];
  if (v.email) clash.push(eq(s.person.emailHash, lookupHash(v.email)));
  if (phone) clash.push(eq(s.person.phoneHash, lookupHash(phone)));
  const [existing] = await db
    .select({ id: s.person.id })
    .from(s.person)
    .where(and(or(...clash), isNull(s.person.deletedAt)))
    .limit(1);
  if (existing) return { ok: false, code: "exists" };
  if (v.cohortId) {
    const g = await groupFor(actor!, v.cohortId);
    if (!g) return { ok: false, code: "not_found" };
    assertCan(actor, "cohort.manage", { resource: { stateId: g.stateId } });
  }
  const now = new Date();
  const msgIds: string[] = [];
  const personId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.person)
      .values({
        firstName: v.firstName,
        surname: encrypt(v.surname),
        gender: v.gender,
        email: v.email ? encrypt(v.email) : null,
        emailHash: v.email ? lookupHash(v.email) : null,
        phone: phone ? encrypt(phone) : null,
        phoneHash: phone ? lookupHash(phone) : null,
        preferredChannel: v.email && contactMode() === "email" ? "email" : "whatsapp",
        stateId: v.stateId,
        status: "active",
      })
      .returning({ id: s.person.id });
    const id = row!.id;
    await tx.insert(s.personRole).values({ personId: id, role: "volunteer", grantedBy: actor!.personId });
    await tx.insert(s.volunteerProfile).values({
      personId: id,
      stage: "active",
      occupation: v.occupation || null,
      motivation: "Added by BGDI staff.",
      activatedAt: now,
      safeguardingCheckedAt: now,
      safeguardingCheckedBy: actor!.personId,
    });
    await audit(tx, ctx, { action: "volunteer.add_by_staff", entityType: "person", entityId: id, subjectPersonId: id });
    if (v.cohortId) {
      await tx.insert(s.cohortMember).values({ cohortId: v.cohortId, personId: id, role: v.role ?? "lead_coach", joinedOn: today() });
      await audit(tx, ctx, { action: "cohort.assign_coach", entityType: "cohort", entityId: v.cohortId, subjectPersonId: id, meta: { role: v.role ?? "lead_coach" } });
    }
    const to = reach({ phone: phone ? encrypt(phone) : null, email: v.email ? encrypt(v.email) : null, preferredChannel: v.email ? "email" : "whatsapp" });
    if (to) {
      const m = await queueTemplate(
        { templateKey: "volunteer.activated", to: to.to, channel: to.channel, personId: id, vars: { link: `${process.env.APP_URL ?? ""}/app/volunteer` }, eventKey: `volunteer.activated:${id}` },
        tx,
      );
      if (m) msgIds.push(m);
    }
    return id;
  });
  await dispatch(msgIds).catch((e) => console.error("[groups] coach message failed", e instanceof Error ? e.message : "unexpected"));
  return { ok: true, id: personId };
}

/** States for the "add a coach" form: all of them for programme managers and admins, a state lead's own. */
export async function coachFormStates(actor: Actor | null) {
  assertCan(actor, "volunteer.advance_stage");
  const rows = await db.select({ id: s.state.id, name: s.state.name }).from(s.state).where(eq(s.state.isActive, true)).orderBy(asc(s.state.name));
  if (hasRole(actor, "programme_manager", "admin")) return rows;
  const mine = new Set(actor!.roles.filter((r) => r.role === "state_lead" && r.stateId).map((r) => r.stateId));
  return rows.filter((r) => mine.has(r.id));
}
