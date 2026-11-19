import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt } from "@/lib/crypto";
import { assertCan } from "@/server/permissions/assert";
import { actorStates, can, hasRole, type Actor } from "@/server/permissions/can";
import { scopeStudents, scopeVolunteers } from "@/server/permissions/scope";
import { audit } from "./audit";
import { dispatch, queueTemplate } from "./messaging";

/**
 * Console lists of students, volunteers and schools, with approval (spec/07 §3–5, cut down).
 * Every list is scoped the same way as `can()`: admins and programme managers see everything,
 * state leads their states. Decisions are audited.
 */

export const PEOPLE_PAGE_SIZE = 25;
export type PeopleFilters = { status?: string; q?: string; page?: number };

const like = (q?: string) => (q && q.trim() ? `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null);
const paging = (page?: number) => {
  const p = Math.max(1, Math.floor(page ?? 1));
  return { page: p, offset: (p - 1) * PEOPLE_PAGE_SIZE };
};
const pages = (total: number) => Math.max(1, Math.ceil(total / PEOPLE_PAGE_SIZE));
const surnameOf = (enc: string | null) => {
  try {
    return decrypt(enc) ?? "";
  } catch {
    return "";
  }
};

/* ---------- Students ---------- */

export const STUDENT_STATUSES = ["pending_review", "pending_consent", "active", "waitlisted", "paused", "declined", "left"] as const;

const isStudent = sql`exists (select 1 from person_role r where r.person_id = ${s.person.id} and r.role = 'student' and r.revoked_at is null)`;

export async function listStudents(actor: Actor | null, f: PeopleFilters) {
  assertCan(actor, "intake.review");
  const base: SQL[] = [isStudent, isNull(s.person.deletedAt), scopeStudents(actor!)];
  const q = like(f.q);
  if (q) base.push(ilike(s.person.firstName, q));
  const where = and(...base, f.status ? eq(s.person.status, f.status as (typeof STUDENT_STATUSES)[number]) : undefined);
  const { page, offset } = paging(f.page);

  const [rows, [total], byStatus] = await Promise.all([
    db
      .select({
        id: s.person.id,
        firstName: s.person.firstName,
        surname: s.person.surname,
        age: s.person.ageAtSignup,
        status: s.person.status,
        classLevel: s.person.classLevel,
        school: sql<string | null>`coalesce(${s.school.name}, ${s.person.schoolOther})`,
        state: s.state.name,
        createdAt: s.person.createdAt,
        guardian: sql<string | null>`(select g.first_name from guardian_link l join person g on g.id = l.guardian_id where l.student_id = ${s.person.id} order by l.is_primary desc limit 1)`,
        participation: sql<boolean>`exists (select 1 from consent c where c.student_id = ${s.person.id} and c.type = 'participation' and c.given_at is not null and c.withdrawn_at is null)`,
        aiPractice: sql<boolean>`exists (select 1 from consent c where c.student_id = ${s.person.id} and c.type = 'ai_practice' and c.given_at is not null and c.withdrawn_at is null)`,
      })
      .from(s.person)
      .leftJoin(s.school, eq(s.school.id, s.person.schoolId))
      .leftJoin(s.state, eq(s.state.id, s.person.stateId))
      .where(where)
      .orderBy(sql`case when ${s.person.status} = 'pending_review' then 0 else 1 end`, desc(s.person.createdAt))
      .limit(PEOPLE_PAGE_SIZE)
      .offset(offset),
    db.select({ n: count() }).from(s.person).where(where),
    db
      .select({ status: s.person.status, n: count() })
      .from(s.person)
      .where(and(...base))
      .groupBy(s.person.status),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, surname: surnameOf(r.surname), canDecide: r.status === "pending_review" || r.status === "waitlisted" })),
    total: total?.n ?? 0,
    page,
    pages: pages(total?.n ?? 0),
    counts: Object.fromEntries(byStatus.map((b) => [b.status, b.n])) as Record<string, number>,
  };
}

type Decision = "approve" | "decline" | "waitlist";

/** Approve (→ active), waitlist or decline a student whose sign-up is waiting for review. */
export async function decideStudent(actor: Actor | null, personId: string, decision: Decision, ip: string | null = null) {
  const [p] = await db
    .select({ id: s.person.id, status: s.person.status, stateId: s.person.stateId })
    .from(s.person)
    .where(and(eq(s.person.id, personId), isStudent, isNull(s.person.deletedAt)));
  if (!p) return { ok: false as const, code: "not_found" as const };
  const ctx = assertCan(actor, "intake.review", { ip, resource: { personId, stateId: p.stateId } });
  if (p.status !== "pending_review" && p.status !== "waitlisted") return { ok: false as const, code: "wrong_status" as const };
  const status = decision === "approve" ? "active" : decision === "waitlist" ? "waitlisted" : "declined";
  await db.transaction(async (tx) => {
    await tx.update(s.person).set({ status, updatedAt: new Date() }).where(eq(s.person.id, personId));
    await audit(tx, ctx, { action: `student.${decision}`, entityType: "person", entityId: personId, subjectPersonId: personId, meta: { from: p.status, to: status } });
  });
  return { ok: true as const, status };
}

/* ---------- Volunteers ---------- */

export const VOLUNTEER_STAGES = ["applied", "references_pending", "interview", "training", "active", "paused", "declined", "left"] as const;
const OPEN_STAGES = ["applied", "references_pending", "interview", "training"];

export async function listVolunteers(actor: Actor | null, f: PeopleFilters) {
  assertCan(actor, "volunteer.view_applications");
  const base: SQL[] = [isNull(s.person.deletedAt), scopeVolunteers(actor!)];
  const q = like(f.q);
  if (q) base.push(ilike(s.person.firstName, q));
  const where = and(...base, f.status ? eq(s.volunteerProfile.stage, f.status as (typeof VOLUNTEER_STAGES)[number]) : undefined);
  const { page, offset } = paging(f.page);

  const [rows, [total], byStage] = await Promise.all([
    db
      .select({
        id: s.person.id,
        firstName: s.person.firstName,
        surname: s.person.surname,
        stage: s.volunteerProfile.stage,
        occupation: s.volunteerProfile.occupation,
        organisation: s.volunteerProfile.organisation,
        skills: s.volunteerProfile.skills,
        isNysc: s.volunteerProfile.isNysc,
        isAlumna: s.volunteerProfile.isAlumna,
        motivation: s.volunteerProfile.motivation,
        state: s.state.name,
        createdAt: s.volunteerProfile.createdAt,
        refs: sql<number>`(select count(*)::int from volunteer_reference v where v.volunteer_id = ${s.person.id})`,
        refsOk: sql<number>`(select count(*)::int from volunteer_reference v where v.volunteer_id = ${s.person.id} and v.status = 'positive')`,
      })
      .from(s.volunteerProfile)
      .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
      .leftJoin(s.state, eq(s.state.id, s.person.stateId))
      .where(where)
      .orderBy(sql`case when ${s.volunteerProfile.stage} in ('applied','references_pending','interview','training') then 0 else 1 end`, desc(s.volunteerProfile.createdAt))
      .limit(PEOPLE_PAGE_SIZE)
      .offset(offset),
    db.select({ n: count() }).from(s.volunteerProfile).innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId)).where(where),
    db
      .select({ stage: s.volunteerProfile.stage, n: count() })
      .from(s.volunteerProfile)
      .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
      .where(and(...base))
      .groupBy(s.volunteerProfile.stage),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, surname: surnameOf(r.surname), canDecide: OPEN_STAGES.includes(r.stage) })),
    total: total?.n ?? 0,
    page,
    pages: pages(total?.n ?? 0),
    counts: Object.fromEntries(byStage.map((b) => [b.stage, b.n])) as Record<string, number>,
  };
}

/**
 * Approve a volunteer (→ active, with the "you're active" message) or decline them. Approval may
 * skip the reference, interview and training stages: BGDI asked for a single approve step for now.
 */
export async function decideVolunteer(actor: Actor | null, personId: string, decision: "approve" | "decline", ip: string | null = null) {
  const [v] = await db
    .select({ id: s.person.id, stage: s.volunteerProfile.stage, stateId: s.person.stateId, phone: s.person.phone })
    .from(s.volunteerProfile)
    .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
    .where(and(eq(s.person.id, personId), isNull(s.person.deletedAt)));
  if (!v) return { ok: false as const, code: "not_found" as const };
  const ctx = assertCan(actor, "volunteer.advance_stage", { ip, resource: { personId, stateId: v.stateId } });
  if (!OPEN_STAGES.includes(v.stage)) return { ok: false as const, code: "wrong_status" as const };
  const now = new Date();
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    if (decision === "approve") {
      await tx.update(s.volunteerProfile).set({ stage: "active", activatedAt: now, updatedAt: now }).where(eq(s.volunteerProfile.personId, personId));
      await tx.update(s.person).set({ status: "active", updatedAt: now }).where(eq(s.person.id, personId));
      const to = decrypt(v.phone);
      if (to) {
        const id = await queueTemplate(
          {
            templateKey: "volunteer.activated",
            to,
            channel: "whatsapp",
            personId,
            vars: { link: `${process.env.APP_URL ?? ""}/app/volunteer` },
            eventKey: `volunteer.activated:${personId}`,
          },
          tx,
        );
        if (id) ids.push(id);
      }
    } else {
      await tx.update(s.volunteerProfile).set({ stage: "declined", updatedAt: now }).where(eq(s.volunteerProfile.personId, personId));
      await tx.update(s.person).set({ status: "declined", updatedAt: now }).where(eq(s.person.id, personId));
    }
    await audit(tx, ctx, { action: `volunteer.${decision}`, entityType: "person", entityId: personId, subjectPersonId: personId, meta: { from: v.stage } });
  });
  await dispatch(ids).catch((e) => console.error("[console] volunteer message failed", e instanceof Error ? e.message : "unexpected"));
  return { ok: true as const };
}

/* ---------- Schools ---------- */

export const REQUEST_STATUSES = ["new", "contacted", "accepted", "declined"] as const;

function stateScope(actor: Actor, col: Parameters<typeof eq>[0]): SQL {
  if (hasRole(actor, "programme_manager", "safeguarding_lead", "admin")) return sql`true`;
  const states = actorStates(actor);
  return states.length ? inArray(col, states) : sql`false`;
}

export async function listSchools(actor: Actor | null, f: PeopleFilters) {
  assertCan(actor, "school.view");
  const a = actor!;
  const q = like(f.q);
  const reqWhere = and(
    stateScope(a, s.schoolRequest.stateId),
    q ? sql`coalesce(${s.school.name}, ${s.schoolRequest.schoolNameOther}) ilike ${q}` : undefined,
    f.status ? eq(s.schoolRequest.status, f.status as (typeof REQUEST_STATUSES)[number]) : undefined,
  );
  const reqBase = and(stateScope(a, s.schoolRequest.stateId), q ? sql`coalesce(${s.school.name}, ${s.schoolRequest.schoolNameOther}) ilike ${q}` : undefined);
  const schoolWhere = and(
    isNull(s.school.deletedAt),
    sql`${s.school.partnershipStatus} <> 'none'`,
    stateScope(a, s.school.stateId),
    q ? ilike(s.school.name, q) : undefined,
  );
  const [requests, byStatus, partners] = await Promise.all([
    db
      .select({
        id: s.schoolRequest.id,
        school: sql<string>`coalesce(${s.school.name}, ${s.schoolRequest.schoolNameOther})`,
        state: s.state.name,
        lga: s.lga.name,
        requesterName: s.schoolRequest.requesterName,
        requesterRole: s.schoolRequest.requesterRole,
        approxStudents: s.schoolRequest.approxStudents,
        preferredTerm: s.schoolRequest.preferredTerm,
        message: s.schoolRequest.message,
        status: s.schoolRequest.status,
        createdAt: s.schoolRequest.createdAt,
      })
      .from(s.schoolRequest)
      .leftJoin(s.school, eq(s.school.id, s.schoolRequest.schoolId))
      .leftJoin(s.state, eq(s.state.id, s.schoolRequest.stateId))
      .leftJoin(s.lga, eq(s.lga.id, s.schoolRequest.lgaId))
      .where(reqWhere)
      .orderBy(sql`case when ${s.schoolRequest.status} in ('new','contacted') then 0 else 1 end`, desc(s.schoolRequest.createdAt))
      .limit(100),
    db
      .select({ status: s.schoolRequest.status, n: count() })
      .from(s.schoolRequest)
      .leftJoin(s.school, eq(s.school.id, s.schoolRequest.schoolId))
      .where(reqBase)
      .groupBy(s.schoolRequest.status),
    db
      .select({
        id: s.school.id,
        name: s.school.name,
        state: s.state.name,
        lga: s.lga.name,
        partnershipStatus: s.school.partnershipStatus,
        students: sql<number>`(select count(*)::int from person p where p.school_id = ${s.school.id} and p.deleted_at is null and exists (select 1 from person_role r where r.person_id = p.id and r.role = 'student' and r.revoked_at is null))`,
      })
      .from(s.school)
      .leftJoin(s.state, eq(s.state.id, s.school.stateId))
      .leftJoin(s.lga, eq(s.lga.id, s.school.lgaId))
      .where(schoolWhere)
      .orderBy(s.school.name)
      .limit(200),
  ]);
  return {
    requests: requests.map((r) => ({ ...r, canDecide: r.status === "new" || r.status === "contacted" })),
    counts: Object.fromEntries(byStatus.map((b) => [b.status, b.n])) as Record<string, number>,
    partners,
    canEdit: can(a, "school.edit"),
  };
}

/** Accept, decline or mark "contacted" on a "bring BGDI to my school" request. */
export async function decideSchoolRequest(actor: Actor | null, id: string, decision: "accept" | "decline" | "contacted", ip: string | null = null) {
  const [r] = await db.select().from(s.schoolRequest).where(eq(s.schoolRequest.id, id));
  if (!r) return { ok: false as const, code: "not_found" as const };
  const ctx = assertCan(actor, "school.edit", { ip, resource: { stateId: r.stateId } });
  if (r.status !== "new" && r.status !== "contacted") return { ok: false as const, code: "wrong_status" as const };
  const status = decision === "accept" ? "accepted" : decision === "decline" ? "declined" : "contacted";
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(s.schoolRequest).set({ status, handledBy: actor!.personId, updatedAt: now }).where(eq(s.schoolRequest.id, id));
    if (status === "accepted" && r.schoolId) {
      await tx
        .update(s.school)
        .set({ partnershipStatus: "in_discussion", updatedAt: now })
        .where(and(eq(s.school.id, r.schoolId), eq(s.school.partnershipStatus, "none")));
    }
    await audit(tx, ctx, { action: `school_request.${decision}`, entityType: "school_request", entityId: id, meta: { from: r.status } });
  });
  return { ok: true as const, status };
}
