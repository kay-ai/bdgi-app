import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { Forbidden, assertCan } from "@/server/permissions/assert";
import { can, type Actor } from "@/server/permissions/can";
import { newRoomName, videoProvider } from "@/server/providers/video";
import { audit } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { reach } from "./reach";

/**
 * Group sessions (spec/02 session and attendance, spec/06; D-025). Staff create a group's weekly
 * sessions; a coach starts one live, which opens a video room and emails each student; students
 * see a pulsing Join button in their Hub until the coach ends it. Joining marks a student present;
 * the coach can correct attendance. Ending marks the session held and logs the coaches' hours.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; code: string };

/** WAT is UTC+1 all year. */
const WAT_MS = 60 * 60_000;
/** A session can be started from 30 minutes before its time; it ends by itself after 4 hours. */
const EARLY_MS = 30 * 60_000;
const LIVE_MAX_MS = 4 * 60 * 60_000;
const COACH_ROLES = ["lead_coach", "assistant_coach"] as const;
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const isUuid = (x: string) => /^[0-9a-f-]{36}$/.test(x);

/** A Lagos date and time ("2026-12-05", "15:30") as an instant. */
export function watInstant(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!) - WAT_MS);
}

/** Every date from `from` to `to` (inclusive) that falls on `weekday` (0 = Sunday). */
export function weeklyDates(from: string, to: string, weekday: number) {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((weekday - d.getUTCDay() + 7) % 7));
  for (; d <= end && out.length < 60; d.setUTCDate(d.getUTCDate() + 7)) out.push(d.toISOString().slice(0, 10));
  return out;
}

async function cohortInfo(cohortId: string) {
  if (!isUuid(cohortId)) return null;
  const [g] = await db
    .select({ cohort: s.cohort, stateId: s.school.stateId, schoolName: s.school.name })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(and(eq(s.cohort.id, cohortId), isNull(s.cohort.deletedAt)));
  return g ?? null;
}

async function sessionInfo(sessionId: string) {
  if (!isUuid(sessionId)) return null;
  const [r] = await db
    .select({ session: s.session, cohort: s.cohort, stateId: s.school.stateId, schoolName: s.school.name })
    .from(s.session)
    .innerJoin(s.cohort, eq(s.cohort.id, s.session.cohortId))
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(eq(s.session.id, sessionId));
  return r ?? null;
}

/** Current members of a group, coaches and students. */
async function members(cohortId: string) {
  return db
    .select({ personId: s.cohortMember.personId, role: s.cohortMember.role, firstName: s.person.firstName, email: s.person.email, phone: s.person.phone, preferredChannel: s.person.preferredChannel, age: s.person.ageAtSignup })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .where(and(eq(s.cohortMember.cohortId, cohortId), isNull(s.cohortMember.leftOn), isNull(s.person.deletedAt)));
}

const isLive = (x: { liveStartedAt: Date | null; liveEndedAt: Date | null }, now = new Date()) =>
  !!x.liveStartedAt && !x.liveEndedAt && now.getTime() - x.liveStartedAt.getTime() < LIVE_MAX_MS;

/* ---------- Staff: plan sessions ---------- */

/** Make the group's weekly sessions from its first to last date, skipping dates that already have one. */
export async function generateSessions(actor: Actor | null, cohortId: string, ip: string | null = null): Promise<Result<{ created: number }>> {
  const g = await cohortInfo(cohortId);
  if (!g) return { ok: false, code: "not_found" };
  const ctx = assertCan(actor, "session.manage", { ip, resource: { stateId: g.stateId } });
  const c = g.cohort;
  if (c.meetingDay === null || !c.meetingTime) return { ok: false, code: "no_schedule" };
  if (c.status === "completed" || c.status === "cancelled") return { ok: false, code: "closed" };
  const existing = await db.select({ startsAt: s.session.startsAt }).from(s.session).where(eq(s.session.cohortId, cohortId));
  const have = new Set(existing.map((e) => new Date(e.startsAt.getTime() + WAT_MS).toISOString().slice(0, 10)));
  const dates = weeklyDates(c.startsOn, c.endsOn, c.meetingDay).filter((d) => !have.has(d));
  if (!dates.length) return { ok: true, created: 0 };
  await db.transaction(async (tx) => {
    await tx.insert(s.session).values(dates.map((d) => ({ cohortId, startsAt: watInstant(d, c.meetingTime!.slice(0, 5)), durationMinutes: 60, venue: c.venue })));
    await audit(tx, ctx, { action: "session.generate", entityType: "cohort", entityId: cohortId, meta: { created: dates.length } });
  });
  return { ok: true, created: dates.length };
}

export const sessionInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function addSession(actor: Actor | null, cohortId: string, raw: unknown, ip: string | null = null): Promise<Result<{ id: string }>> {
  const g = await cohortInfo(cohortId);
  if (!g) return { ok: false, code: "not_found" };
  const ctx = assertCan(actor, "session.manage", { ip, resource: { stateId: g.stateId } });
  const p = sessionInput.safeParse(raw);
  if (!p.success) return { ok: false, code: "invalid" };
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.session)
      .values({ cohortId, startsAt: watInstant(p.data.date, p.data.time), durationMinutes: p.data.durationMinutes, venue: p.data.venue || g.cohort.venue })
      .returning({ id: s.session.id });
    await audit(tx, ctx, { action: "session.create", entityType: "session", entityId: row!.id });
    return row!.id;
  });
  return { ok: true, id };
}

export async function cancelSession(actor: Actor | null, sessionId: string, reason: string, ip: string | null = null): Promise<Result> {
  const r = await sessionInfo(sessionId);
  if (!r) return { ok: false, code: "not_found" };
  const ctx = assertCan(actor, "session.manage", { ip, resource: { stateId: r.stateId } });
  if (r.session.status !== "planned" || r.session.liveStartedAt) return { ok: false, code: "not_planned" };
  await db.transaction(async (tx) => {
    await tx.update(s.session).set({ status: "cancelled", cancelReason: reason.trim().slice(0, 200) || null, updatedAt: new Date() }).where(eq(s.session.id, sessionId));
    await audit(tx, ctx, { action: "session.cancel", entityType: "session", entityId: sessionId });
  });
  return { ok: true };
}

/** A group's sessions with attendance counts, for the console group page. */
export async function groupSessions(cohortId: string) {
  const rows = await db
    .select({
      id: s.session.id,
      startsAt: s.session.startsAt,
      durationMinutes: s.session.durationMinutes,
      venue: s.session.venue,
      status: s.session.status,
      liveStartedAt: s.session.liveStartedAt,
      liveEndedAt: s.session.liveEndedAt,
      present: sql<number>`(select count(*)::int from attendance a where a.session_id = ${s.session.id} and a.status = 'present')`,
    })
    .from(s.session)
    .where(eq(s.session.cohortId, cohortId))
    .orderBy(asc(s.session.startsAt));
  return rows.map((r) => ({ ...r, live: isLive(r) }));
}

/* ---------- Coaches: run a session ---------- */

/** May this person run (start, end, take attendance for) a session of this group? */
function mayRun(actor: Actor | null, cohortId: string, stateId: string | null) {
  return can(actor, "session.mark_held", { cohortIds: [cohortId], stateId });
}

/** Start the session live: open the video room and email each student once. */
export async function startSession(actor: Actor | null, sessionId: string, ip: string | null = null, now = new Date()): Promise<Result<{ id: string }>> {
  const r = await sessionInfo(sessionId);
  if (!r) return { ok: false, code: "not_found" };
  if (!mayRun(actor, r.cohort.id, r.stateId)) throw new Forbidden("session.mark_held");
  const ctx = { actor, locale: "en" as const, ip };
  const sess = r.session;
  if (isLive(sess, now)) return { ok: true, id: sess.id };
  if (sess.status !== "planned") return { ok: false, code: "not_planned" };
  const end = sess.startsAt.getTime() + sess.durationMinutes * 60_000;
  if (now.getTime() < sess.startsAt.getTime() - EARLY_MS) return { ok: false, code: "too_early" };
  if (now.getTime() > end + 2 * 60 * 60_000) return { ok: false, code: "too_late" };

  const room = await videoProvider().createRoom(newRoomName(), new Date(now.getTime() + LIVE_MAX_MS));
  const people = await members(r.cohort.id);
  const coach = people.find((p) => p.personId === actor!.personId)?.firstName ?? actor!.firstName;
  const students = people.filter((p) => p.role === "student");
  // A student's own address first; for a younger student with none, her guardian's.
  const guardians = students.length
    ? await db
        .select({ studentId: s.guardianLink.studentId, email: s.person.email, phone: s.person.phone, preferredChannel: s.person.preferredChannel })
        .from(s.guardianLink)
        .innerJoin(s.person, eq(s.person.id, s.guardianLink.guardianId))
        .where(inArray(s.guardianLink.studentId, students.map((x) => x.personId)))
        .orderBy(desc(s.guardianLink.isPrimary))
    : [];

  const ids: string[] = [];
  await db.transaction(async (tx) => {
    const [ok] = await tx
      .update(s.session)
      .set({ liveStartedAt: now, liveEndedAt: null, startedBy: actor!.personId, videoRoom: room.url, updatedAt: now })
      .where(and(eq(s.session.id, sess.id), eq(s.session.status, "planned"), isNull(s.session.liveStartedAt)))
      .returning({ id: s.session.id });
    if (!ok) return;
    for (const st of students) {
      const to = reach(st) ?? (() => {
        const g = guardians.find((x) => x.studentId === st.personId);
        return g ? reach(g) : null;
      })();
      if (!to) continue;
      const id = await queueTemplate(
        {
          templateKey: "session.started",
          to: to.to,
          channel: to.channel,
          personId: st.personId,
          vars: { firstName: st.firstName, cohortName: r.cohort.name, coachName: coach, link: `${appUrl()}/app/session/${sess.id}` },
          eventKey: `session.started:${sess.id}:${st.personId}`,
          now,
        },
        tx,
      );
      if (id) ids.push(id);
    }
    await audit(tx, ctx, { action: "session.start", entityType: "session", entityId: sess.id, meta: { notified: ids.length } });
  });
  await dispatch(ids, now).catch((e) => console.error("[sessions] start message failed", e instanceof Error ? e.message : "unexpected"));
  return { ok: true, id: sess.id };
}

/** End the session: close the room, mark it held, and log each coach's hours once. */
export async function endSession(actor: Actor | null, sessionId: string, ip: string | null = null, now = new Date()): Promise<Result> {
  const r = await sessionInfo(sessionId);
  if (!r) return { ok: false, code: "not_found" };
  if (!mayRun(actor, r.cohort.id, r.stateId)) throw new Forbidden("session.mark_held");
  const sess = r.session;
  if (!sess.liveStartedAt || sess.liveEndedAt) return { ok: false, code: "not_live" };
  const coaches = (await members(r.cohort.id)).filter((p) => (COACH_ROLES as readonly string[]).includes(p.role));
  const minutes = Math.max(15, Math.min(sess.durationMinutes, Math.round((now.getTime() - sess.liveStartedAt.getTime()) / 60_000)));
  const hours = (Math.round((minutes / 60) * 4) / 4).toFixed(2);
  const date = new Date(sess.startsAt.getTime() + WAT_MS).toISOString().slice(0, 10);
  await db.transaction(async (tx) => {
    await tx.update(s.session).set({ liveEndedAt: now, status: "held", heldMarkedBy: actor!.personId, updatedAt: now }).where(eq(s.session.id, sess.id));
    for (const c of coaches) {
      await tx
        .insert(s.hoursEntry)
        .values({ personId: c.personId, sessionId: sess.id, date, hours, source: "session", status: "approved", description: r.cohort.name })
        .onConflictDoNothing();
    }
    await audit(tx, { actor, locale: "en", ip }, { action: "session.end", entityType: "session", entityId: sess.id, meta: { coaches: coaches.length } });
  });
  if (sess.videoRoom) await videoProvider().deleteRoom({ url: sess.videoRoom }).catch(() => undefined);
  return { ok: true };
}

/** What the session page needs: the session, whether she can run it, and her video link. */
export async function sessionRoom(actor: Actor | null, sessionId: string, now = new Date()) {
  if (!actor) return null;
  const r = await sessionInfo(sessionId);
  if (!r) return null;
  const people = await members(r.cohort.id);
  const me = people.find((p) => p.personId === actor.personId);
  const runs = mayRun(actor, r.cohort.id, r.stateId);
  // Students and coaches of the group, and staff who manage it, may come in.
  if (!me && !runs) return null;
  const live = isLive(r.session, now);
  let joinUrl: string | null = null;
  if (live && r.session.videoRoom) {
    joinUrl = await videoProvider()
      .joinUrl({ url: r.session.videoRoom }, { name: me?.firstName ?? actor.firstName, isOwner: runs, expiresAt: new Date(r.session.liveStartedAt!.getTime() + LIVE_MAX_MS) })
      .catch(() => null);
    // Coming in counts as being there; a coach can still change it.
    if (me?.role === "student") {
      await db
        .insert(s.attendance)
        .values({ sessionId, personId: actor.personId, status: "present", recordedBy: actor.personId, recordedAt: now, clientId: randomUUID() })
        .onConflictDoNothing({ target: [s.attendance.sessionId, s.attendance.personId] });
    }
  }
  const roster = runs ? await rosterOf(sessionId, r.cohort.id) : [];
  return {
    session: { id: r.session.id, startsAt: r.session.startsAt, durationMinutes: r.session.durationMinutes, venue: r.session.venue, status: r.session.status, liveStartedAt: r.session.liveStartedAt },
    cohort: { id: r.cohort.id, name: r.cohort.name, school: r.schoolName },
    live,
    runs,
    joinUrl,
    provider: videoProvider().name,
    roster,
  };
}

/** The group's current students with their mark for this session. */
function rosterOf(sessionId: string, cohortId: string) {
  return db
    .select({ personId: s.person.id, firstName: s.person.firstName, status: s.attendance.status })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .leftJoin(s.attendance, and(eq(s.attendance.sessionId, sessionId), eq(s.attendance.personId, s.person.id)))
    .where(and(eq(s.cohortMember.cohortId, cohortId), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn)))
    .orderBy(asc(s.person.firstName));
}

/** The attendance list again, for the coach's page to refresh while students come in. */
export async function sessionRoster(actor: Actor | null, sessionId: string) {
  if (!actor || !isUuid(sessionId)) return null;
  const r = await sessionInfo(sessionId);
  if (!r || !mayRun(actor, r.cohort.id, r.stateId)) return null;
  return rosterOf(sessionId, r.cohort.id);
}

export const attendanceInput = z.object({
  marks: z.array(z.object({ personId: z.string().uuid(), status: z.enum(["present", "absent", "excused"]) })).max(200),
});

/** A coach records or corrects attendance. Only current students of the group can be marked. */
export async function recordAttendance(actor: Actor | null, sessionId: string, raw: unknown, ip: string | null = null, now = new Date()): Promise<Result<{ saved: number }>> {
  const r = await sessionInfo(sessionId);
  if (!r) return { ok: false, code: "not_found" };
  const ctx = assertCan(actor, "attendance.record", { ip, resource: { cohortIds: [r.cohort.id], stateId: r.stateId } });
  if (r.session.status === "cancelled") return { ok: false, code: "cancelled" };
  const p = attendanceInput.safeParse(raw);
  if (!p.success) return { ok: false, code: "invalid" };
  const allowed = new Set((await members(r.cohort.id)).filter((m) => m.role === "student").map((m) => m.personId));
  const marks = p.data.marks.filter((m) => allowed.has(m.personId));
  await db.transaction(async (tx) => {
    for (const m of marks) {
      await tx
        .insert(s.attendance)
        .values({ sessionId, personId: m.personId, status: m.status, recordedBy: actor!.personId, recordedAt: now, clientId: randomUUID() })
        .onConflictDoUpdate({ target: [s.attendance.sessionId, s.attendance.personId], set: { status: m.status, recordedBy: actor!.personId, recordedAt: now, updatedAt: now } });
    }
    await audit(tx, ctx, { action: "attendance.record", entityType: "session", entityId: sessionId, meta: { marks: marks.length } });
  });
  return { ok: true, saved: marks.length };
}

/* ---------- The Hub: what's on now ---------- */

/** The live session, if any, in one of this person's current groups. */
export async function liveSessionFor(personId: string, now = new Date()) {
  const rows = await db
    .select({ id: s.session.id, cohortName: s.cohort.name, liveStartedAt: s.session.liveStartedAt, liveEndedAt: s.session.liveEndedAt })
    .from(s.session)
    .innerJoin(s.cohort, eq(s.cohort.id, s.session.cohortId))
    .innerJoin(s.cohortMember, and(eq(s.cohortMember.cohortId, s.cohort.id), eq(s.cohortMember.personId, personId), isNull(s.cohortMember.leftOn)))
    .where(and(isNotNull(s.session.liveStartedAt), isNull(s.session.liveEndedAt), gt(s.session.liveStartedAt, new Date(now.getTime() - LIVE_MAX_MS))))
    .orderBy(desc(s.session.liveStartedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** A coach's groups with their next and live sessions, for the volunteer Hub. */
export async function coachSessions(actor: Actor, now = new Date()) {
  if (!actor.coachCohortIds.length) return [];
  const groups = await db
    .select({ id: s.cohort.id, name: s.cohort.name, school: s.school.name, status: s.cohort.status })
    .from(s.cohort)
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(and(inArray(s.cohort.id, actor.coachCohortIds), isNull(s.cohort.deletedAt)))
    .orderBy(asc(s.cohort.name));
  const sessions = await db
    .select({ id: s.session.id, cohortId: s.session.cohortId, startsAt: s.session.startsAt, durationMinutes: s.session.durationMinutes, status: s.session.status, liveStartedAt: s.session.liveStartedAt, liveEndedAt: s.session.liveEndedAt })
    .from(s.session)
    .where(and(inArray(s.session.cohortId, actor.coachCohortIds), sql`${s.session.status} <> 'cancelled'`, gt(s.session.startsAt, new Date(now.getTime() - 6 * 60 * 60_000))))
    .orderBy(asc(s.session.startsAt));
  const counts = await db
    .select({ cohortId: s.cohortMember.cohortId, n: sql<number>`count(*)::int` })
    .from(s.cohortMember)
    .where(and(inArray(s.cohortMember.cohortId, actor.coachCohortIds), eq(s.cohortMember.role, "student"), isNull(s.cohortMember.leftOn)))
    .groupBy(s.cohortMember.cohortId);
  return groups.map((g) => {
    const mine = sessions.filter((x) => x.cohortId === g.id);
    const live = mine.find((x) => isLive(x, now)) ?? null;
    const next = mine.find((x) => x.status === "planned" && !x.liveStartedAt && x.startsAt.getTime() + x.durationMinutes * 60_000 + 2 * 60 * 60_000 > now.getTime()) ?? null;
    const canStart = !!next && now.getTime() >= next.startsAt.getTime() - EARLY_MS;
    return { ...g, students: counts.find((c) => c.cohortId === g.id)?.n ?? 0, live: live && { id: live.id, startedAt: live.liveStartedAt! }, next: next && { id: next.id, startsAt: next.startsAt, canStart } };
  });
}

/** Her next planned session (for the student Hub group card). */
export async function nextSessionFor(cohortId: string, now = new Date()) {
  const [n] = await db
    .select({ id: s.session.id, startsAt: s.session.startsAt })
    .from(s.session)
    .where(and(eq(s.session.cohortId, cohortId), eq(s.session.status, "planned"), gt(s.session.startsAt, now)))
    .orderBy(asc(s.session.startsAt))
    .limit(1);
  return n ?? null;
}

/** Live sessions nobody ended within 4 hours are closed by the scheduled job. */
export async function closeStaleSessions(now = new Date()) {
  const stale = await db
    .select({ id: s.session.id, videoRoom: s.session.videoRoom })
    .from(s.session)
    .where(and(isNotNull(s.session.liveStartedAt), isNull(s.session.liveEndedAt), lt(s.session.liveStartedAt, new Date(now.getTime() - LIVE_MAX_MS))));
  for (const x of stale) {
    await db.update(s.session).set({ liveEndedAt: now, status: "held", updatedAt: now }).where(eq(s.session.id, x.id));
    if (x.videoRoom) await videoProvider().deleteRoom({ url: x.videoRoom }).catch(() => undefined);
  }
  return stale.length;
}
