import "server-only";
import { and, asc, count, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { actorStates, can, hasRole, isStaff, type Actor } from "@/server/permissions/can";
import { scopeCohorts, scopeStudents, scopeVolunteers } from "@/server/permissions/scope";
import { isStudent, stateScope } from "./console-people";

/**
 * Console home (spec/07 §1): what is waiting, what is coming, and how sign-ups are moving.
 * Each block is computed only when the actor may see that area, with the same scoping as its list.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** Lagos is UTC+1 all year. */
const lagosMidnight = (now: Date) => {
  const l = new Date(now.getTime() + HOUR);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - HOUR);
};
/** Monday 00:00 Lagos time of the week holding `now`. */
export const lagosWeekStart = (now: Date) => {
  const mid = lagosMidnight(now);
  const dow = (new Date(mid.getTime() + HOUR).getUTCDay() + 6) % 7;
  return new Date(mid.getTime() - dow * DAY);
};
const monthStart = (now: Date) => {
  const l = new Date(now.getTime() + HOUR);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - HOUR);
};
/** Week key (Monday's date in Lagos) for a timestamp column, as text. */
const weekKey = (col: SQL | Parameters<typeof eq>[0]) => sql<string>`to_char(date_trunc('week', (${col} at time zone 'UTC') + interval '1 hour'), 'YYYY-MM-DD')`;
const ymd = (d: Date) => new Date(d.getTime() + HOUR).toISOString().slice(0, 10);

export const WEEKS = 12;
export type QueueItem = { kind: "student" | "volunteer" | "school"; id: string; name: string; detail: string | null; createdAt: Date; avatarKey?: string };

export async function consoleDashboard(actor: Actor, now = new Date()) {
  const see = {
    students: can(actor, "intake.review"),
    volunteers: can(actor, "volunteer.view_applications") && isStaff(actor),
    schools: can(actor, "school.view") && isStaff(actor),
    donations: can(actor, "donation.view"),
    messages: can(actor, "user.manage"),
    sessions: can(actor, "cohort.view") && isStaff(actor),
    cases: can(actor, "case.count"),
  };
  const today = lagosMidnight(now);
  const week = lagosWeekStart(now);
  const firstWeek = new Date(week.getTime() - (WEEKS - 1) * 7 * DAY);
  const none = Promise.resolve(null);

  const studentBase = and(isStudent, isNull(s.person.deletedAt), scopeStudents(actor));
  const volunteerBase = and(isNull(s.person.deletedAt), scopeVolunteers(actor));
  const sessionBase = and(scopeCohorts(actor), sql`${s.session.status} <> 'cancelled'`);

  const [students, studentWeeks, pendingStudents, volunteers, volunteerWeeks, openVolunteers, requests, newRequests, partners, donations, messages, sessionCounts, nextSessions, tasks, cases] =
    await Promise.all([
      see.students ? db.select({ status: s.person.status, n: count() }).from(s.person).where(studentBase).groupBy(s.person.status) : none,
      see.students
        ? db
            .select({ week: weekKey(s.person.createdAt), n: count() })
            .from(s.person)
            .where(and(studentBase, gte(s.person.createdAt, firstWeek)))
            .groupBy(weekKey(s.person.createdAt))
        : none,
      see.students
        ? db
            .select({ id: s.person.id, name: s.person.firstName, detail: sql<string | null>`coalesce(${s.school.name}, ${s.person.schoolOther})`, createdAt: s.person.createdAt, avatarKey: s.person.avatarKey })
            .from(s.person)
            .leftJoin(s.school, eq(s.school.id, s.person.schoolId))
            .where(and(studentBase, eq(s.person.status, "pending_review")))
            .orderBy(asc(s.person.createdAt))
            .limit(6)
        : none,
      see.volunteers
        ? db
            .select({ stage: s.volunteerProfile.stage, n: count() })
            .from(s.volunteerProfile)
            .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
            .where(volunteerBase)
            .groupBy(s.volunteerProfile.stage)
        : none,
      see.volunteers
        ? db
            .select({ week: weekKey(s.volunteerProfile.createdAt), n: count() })
            .from(s.volunteerProfile)
            .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
            .where(and(volunteerBase, gte(s.volunteerProfile.createdAt, firstWeek)))
            .groupBy(weekKey(s.volunteerProfile.createdAt))
        : none,
      see.volunteers
        ? db
            .select({ id: s.person.id, name: s.person.firstName, detail: s.volunteerProfile.occupation, createdAt: s.volunteerProfile.createdAt, avatarKey: s.person.avatarKey })
            .from(s.volunteerProfile)
            .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
            .where(and(volunteerBase, inArray(s.volunteerProfile.stage, ["applied", "references_pending", "interview", "training"])))
            .orderBy(asc(s.volunteerProfile.createdAt))
            .limit(6)
        : none,
      see.schools
        ? db.select({ status: s.schoolRequest.status, n: count() }).from(s.schoolRequest).where(stateScope(actor, s.schoolRequest.stateId)).groupBy(s.schoolRequest.status)
        : none,
      see.schools
        ? db
            .select({ id: s.schoolRequest.id, name: sql<string>`coalesce(${s.school.name}, ${s.schoolRequest.schoolNameOther})`, detail: s.schoolRequest.requesterName, createdAt: s.schoolRequest.createdAt })
            .from(s.schoolRequest)
            .leftJoin(s.school, eq(s.school.id, s.schoolRequest.schoolId))
            .where(and(stateScope(actor, s.schoolRequest.stateId), eq(s.schoolRequest.status, "new")))
            .orderBy(asc(s.schoolRequest.createdAt))
            .limit(6)
        : none,
      see.schools
        ? db
            .select({ n: count() })
            .from(s.school)
            .where(and(isNull(s.school.deletedAt), sql`${s.school.partnershipStatus} = 'active'`, stateScope(actor, s.school.stateId)))
        : none,
      see.donations
        ? db
            .select({ currency: s.donation.currency, total: sql<string>`coalesce(sum(${s.donation.amountMinor}), 0)`, gifts: count() })
            .from(s.donation)
            .where(and(eq(s.donation.status, "paid"), gte(s.donation.paidAt, monthStart(now))))
            .groupBy(s.donation.currency)
        : none,
      see.messages
        ? db
            .select({ failed: sql<number>`count(*) filter (where ${s.message.status} = 'failed')::int`, sent: count() })
            .from(s.message)
            .where(and(eq(s.message.direction, "outbound"), gte(s.message.createdAt, new Date(now.getTime() - DAY))))
        : none,
      see.sessions
        ? db
            .select({
              today: sql<number>`count(*) filter (where ${s.session.startsAt} >= ${today} and ${s.session.startsAt} < ${new Date(today.getTime() + DAY)})::int`,
              week: sql<number>`count(*) filter (where ${s.session.startsAt} >= ${week} and ${s.session.startsAt} < ${new Date(week.getTime() + 7 * DAY)})::int`,
              unmarked: sql<number>`count(*) filter (where ${s.session.status} = 'held' and not exists (select 1 from attendance a where a.session_id = ${s.session.id}))::int`,
            })
            .from(s.session)
            .innerJoin(s.cohort, eq(s.cohort.id, s.session.cohortId))
            .where(sessionBase)
        : none,
      see.sessions
        ? db
            .select({ id: s.session.id, startsAt: s.session.startsAt, cohort: s.cohort.name, school: s.school.name, venue: sql<string | null>`coalesce(${s.session.venue}, ${s.cohort.venue})` })
            .from(s.session)
            .innerJoin(s.cohort, eq(s.cohort.id, s.session.cohortId))
            .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
            .where(and(sessionBase, eq(s.session.status, "planned"), gte(s.session.startsAt, now)))
            .orderBy(asc(s.session.startsAt))
            .limit(6)
        : none,
      isStaff(actor) ? db.select({ n: count() }).from(s.task).where(and(eq(s.task.status, "open"), taskScope(actor))) : none,
      see.cases
        ? db
            .select({ severity: s.safeguardingCase.severity, n: count() })
            .from(s.safeguardingCase)
            .where(sql`${s.safeguardingCase.status} <> 'closed'`)
            .groupBy(s.safeguardingCase.severity)
        : none,
    ]);

  const byKey = <K extends string>(rows: { n: number }[] | null, key: K) =>
    rows ? (Object.fromEntries((rows as ({ n: number } & Record<K, string>)[]).map((r) => [r[key], r.n])) as Record<string, number>) : null;
  const studentCounts = byKey(students, "status");
  const volunteerCounts = byKey(volunteers, "stage");
  const requestCounts = byKey(requests, "status");

  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(firstWeek.getTime() + i * 7 * DAY);
    const key = ymd(start);
    return {
      start,
      students: studentWeeks?.find((w) => w.week === key)?.n ?? 0,
      volunteers: volunteerWeeks?.find((w) => w.week === key)?.n ?? 0,
    };
  });

  const queue: QueueItem[] = [
    ...(pendingStudents ?? []).map((r) => ({ kind: "student" as const, ...r })),
    ...(openVolunteers ?? []).map((r) => ({ kind: "volunteer" as const, ...r })),
    ...(newRequests ?? []).map((r) => ({ kind: "school" as const, ...r })),
  ]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 8);

  const openStages = ["applied", "references_pending", "interview", "training"];
  return {
    see,
    students: studentCounts && {
      pendingReview: studentCounts.pending_review ?? 0,
      pendingConsent: studentCounts.pending_consent ?? 0,
      active: studentCounts.active ?? 0,
      thisWeek: weekly.at(-1)!.students,
    },
    volunteers: volunteerCounts && {
      open: openStages.reduce((n, k) => n + (volunteerCounts[k] ?? 0), 0),
      byStage: openStages.map((stage) => ({ stage, n: volunteerCounts[stage] ?? 0 })),
      active: volunteerCounts.active ?? 0,
    },
    schools: requestCounts && { newRequests: requestCounts.new ?? 0, contacted: requestCounts.contacted ?? 0, partners: partners?.[0]?.n ?? 0 },
    donations: donations && {
      ngnMinor: Number(donations.find((d) => d.currency === "NGN")?.total ?? 0),
      usdMinor: Number(donations.find((d) => d.currency === "USD")?.total ?? 0),
      gifts: donations.reduce((n, d) => n + d.gifts, 0),
    },
    messages: messages && { failed: messages[0]?.failed ?? 0, sent: messages[0]?.sent ?? 0 },
    sessions: sessionCounts && { today: sessionCounts[0]?.today ?? 0, week: sessionCounts[0]?.week ?? 0, unmarked: sessionCounts[0]?.unmarked ?? 0, next: nextSessions ?? [] },
    tasks: tasks?.[0]?.n ?? null,
    cases: cases && byKey(cases, "severity"),
    weekly,
    queue,
  };
}

export type ConsoleDashboard = Awaited<ReturnType<typeof consoleDashboard>>;

/** Open tasks: everything for admins and programme managers, a state lead's states, else one's own. */
function taskScope(actor: Actor): SQL {
  if (hasRole(actor, "programme_manager", "admin")) return sql`true`;
  const states = actorStates(actor);
  const mine = eq(s.task.assigneeId, actor.personId);
  return states.length ? sql`(${inArray(s.task.stateId, states)} or ${mine})` : mine;
}

/** Sidebar badges: the number waiting in each list. Cheap enough for every console page. */
export async function consoleNavCounts(actor: Actor) {
  const [students, volunteers, schools] = await Promise.all([
    can(actor, "intake.review")
      ? db.select({ n: count() }).from(s.person).where(and(isStudent, isNull(s.person.deletedAt), scopeStudents(actor), eq(s.person.status, "pending_review")))
      : null,
    can(actor, "volunteer.view_applications") && isStaff(actor)
      ? db
          .select({ n: count() })
          .from(s.volunteerProfile)
          .innerJoin(s.person, eq(s.person.id, s.volunteerProfile.personId))
          .where(and(isNull(s.person.deletedAt), scopeVolunteers(actor), inArray(s.volunteerProfile.stage, ["applied", "references_pending", "interview", "training"])))
      : null,
    can(actor, "school.view") && isStaff(actor)
      ? db.select({ n: count() }).from(s.schoolRequest).where(and(stateScope(actor, s.schoolRequest.stateId), eq(s.schoolRequest.status, "new")))
      : null,
  ]);
  return { students: students?.[0]?.n ?? 0, volunteers: volunteers?.[0]?.n ?? 0, schools: schools?.[0]?.n ?? 0 };
}

