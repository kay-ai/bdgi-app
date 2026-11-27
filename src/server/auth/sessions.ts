import "server-only";
import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { newSessionToken, sha256 } from "@/lib/auth-crypto";
import { loadActor } from "@/server/permissions/scope";
import { STAFF_ROLES, type Actor } from "@/server/permissions/can";

export const SESSION_COOKIE = "bgdi_session";

/**
 * Hub sessions (a phone or email code, or Google) remember the browser for a year, counted from
 * the last visit; staff 12 hours; the gap between password and 2-step 10 minutes.
 */
export const SESSION_TTL = { code: 365 * 86_400, staff: 12 * 3_600, password: 10 * 60 } as const;

export type SessionMethod = "phone" | "email" | "google" | "staff";

export async function createSession(input: {
  userId: string;
  method: SessionMethod;
  stage: "password" | "full";
  ip?: string | null;
  userAgent?: string | null;
  activePersonId?: string | null;
}) {
  const token = newSessionToken();
  const ttl = input.stage === "password" ? SESSION_TTL.password : input.method === "staff" ? SESSION_TTL.staff : SESSION_TTL.code;
  const expiresAt = new Date(Date.now() + ttl * 1000);
  await db.insert(s.authSession).values({
    tokenHash: sha256(token),
    userId: input.userId,
    method: input.method,
    stage: input.stage,
    activePersonId: input.activePersonId ?? null,
    expiresAt,
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
  });
  return { token, expiresAt, maxAge: ttl };
}

export type SessionRow = typeof s.authSession.$inferSelect;
export type UserRow = typeof s.appUser.$inferSelect;

/** The session for a cookie value, with its user; null when missing, expired or deactivated. */
export async function readSession(token: string | null | undefined): Promise<{ session: SessionRow; user: UserRow } | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [row] = await db
    .select({ session: s.authSession, user: s.appUser })
    .from(s.authSession)
    .innerJoin(s.appUser, eq(s.appUser.id, s.authSession.userId))
    .where(and(eq(s.authSession.tokenHash, sha256(token)), gt(s.authSession.expiresAt, new Date())));
  if (!row || row.user.deactivatedAt) return null;
  // Touch at most once a minute. A full Hub session also moves its end date on, so it lasts a
  // year from the last visit (the middleware renews the cookie to match).
  if (Date.now() - row.session.lastSeenAt.getTime() > 60_000) {
    const slide = row.session.method !== "staff" && row.session.stage === "full";
    await db
      .update(s.authSession)
      .set({ lastSeenAt: new Date(), ...(slide ? { expiresAt: new Date(Date.now() + SESSION_TTL.code * 1000) } : {}) })
      .where(eq(s.authSession.id, row.session.id));
  }
  return row;
}

export async function revokeSession(token: string | null | undefined) {
  if (!token) return;
  await db.delete(s.authSession).where(eq(s.authSession.tokenHash, sha256(token)));
}

export async function revokeUserSessions(userId: string) {
  await db.delete(s.authSession).where(eq(s.authSession.userId, userId));
}

export async function purgeExpiredSessions() {
  await db.delete(s.authSession).where(lt(s.authSession.expiresAt, new Date()));
}

/* ---------- Profiles: who can this sign-in act as? (spec/03 §1.1 step 4) ---------- */

export type Profile = { personId: string; firstName: string; avatarKey: string; roles: string[] };

/**
 * People this user may act as: persons linked to the user, plus the children of any guardian among
 * them (a child often uses a parent's phone). On first sign-in, persons with the same phone or
 * email hash are linked to the user.
 */
export async function profilesForUser(userId: string): Promise<Profile[]> {
  const [user] = await db.select().from(s.appUser).where(eq(s.appUser.id, userId));
  if (!user) return [];
  const match = [
    user.phoneHash ? eq(s.person.phoneHash, user.phoneHash) : undefined,
    user.emailHash ? eq(s.person.emailHash, user.emailHash) : undefined,
  ].filter(Boolean);
  if (match.length) {
    await db
      .update(s.person)
      .set({ userId, updatedAt: new Date() })
      .where(and(isNull(s.person.userId), isNull(s.person.deletedAt), or(...match)));
  }
  const own = await db
    .select({ id: s.person.id })
    .from(s.person)
    .where(and(eq(s.person.userId, userId), isNull(s.person.deletedAt)));
  const ownIds = own.map((p) => p.id);
  const children = ownIds.length
    ? await db.select({ id: s.guardianLink.studentId }).from(s.guardianLink).where(inArray(s.guardianLink.guardianId, ownIds))
    : [];
  const ids = [...new Set([...ownIds, ...children.map((c) => c.id)])];
  if (!ids.length) return [];
  const [people, roles] = await Promise.all([
    db
      .select({ id: s.person.id, firstName: s.person.firstName, avatarKey: s.person.avatarKey, createdAt: s.person.createdAt })
      .from(s.person)
      .where(and(inArray(s.person.id, ids), isNull(s.person.deletedAt))),
    db
      .select({ personId: s.personRole.personId, role: s.personRole.role })
      .from(s.personRole)
      .where(and(inArray(s.personRole.personId, ids), isNull(s.personRole.revokedAt))),
  ]);
  // The account holder first, then children by age of record.
  people.sort((a, b) => Number(ownIds.includes(b.id)) - Number(ownIds.includes(a.id)) || a.createdAt.getTime() - b.createdAt.getTime());
  return people.map((p) => ({
    personId: p.id,
    firstName: p.firstName,
    avatarKey: p.avatarKey,
    roles: roles.filter((r) => r.personId === p.id).map((r) => r.role),
  }));
}

export async function setActivePerson(sessionId: string, userId: string, personId: string): Promise<boolean> {
  const allowed = (await profilesForUser(userId)).some((p) => p.personId === personId);
  if (!allowed) return false;
  await db.update(s.authSession).set({ activePersonId: personId, updatedAt: new Date() }).where(eq(s.authSession.id, sessionId));
  return true;
}

/**
 * The Actor for a session (spec/03 §2). Staff roles only count in a staff session (password and
 * 2-step); a phone or email code never grants them, even if the same person holds them.
 */
export async function actorForSession(row: { session: SessionRow; user: UserRow } | null): Promise<Actor | null> {
  if (!row || row.session.stage !== "full" || !row.session.activePersonId) return null;
  const actor = await loadActor(row.user.id, row.session.activePersonId);
  if (!actor) return null;
  if (row.session.method !== "staff" || !row.user.isStaff || !row.user.totpEnabledAt) {
    actor.roles = actor.roles.filter((r) => !(STAFF_ROLES as readonly string[]).includes(r.role));
  }
  return actor;
}
