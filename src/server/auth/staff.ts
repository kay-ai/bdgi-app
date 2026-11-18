import "server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash } from "@/lib/crypto";
import { Forbidden } from "@/server/permissions/assert";
import { can, STAFF_ROLES, type Actor } from "@/server/permissions/can";
import { audit } from "@/server/services/audit";
import { dispatch, queueTemplate } from "@/server/services/messaging";
import { createLinkToken } from "./sign-in";
import { revokeUserSessions } from "./sessions";


export const staffInviteInput = z
  .object({
    firstName: z.string().trim().min(1, "firstName").max(60, "firstName"),
    surname: z.string().trim().min(1, "surname").max(60, "surname"),
    email: z.string().trim().toLowerCase().email("email").max(200, "email"),
    roles: z.array(z.enum(STAFF_ROLES)).min(1, "roles"),
    stateId: z.string().uuid().or(z.literal("")).default(""),
  })
  .refine((v) => !v.roles.includes("state_lead") || !!v.stateId, { path: ["stateId"], message: "stateId" });

export type StaffInviteInput = z.infer<typeof staffInviteInput>;

const ROLE_NAMES: Record<string, string> = {
  state_lead: "state lead",
  programme_manager: "programme manager",
  safeguarding_lead: "safeguarding lead",
  content_editor: "content editor",
  admin: "admin",
};

/**
 * Create (or re-invite) a staff account and email a 72-hour link to set a password (spec/03 §5).
 * `actor` null is only for the bootstrap script, which runs with direct database access.
 */
export async function inviteStaff(actor: Actor | null, input: StaffInviteInput, opts: { ip?: string | null; bootstrap?: boolean } = {}) {
  if (!opts.bootstrap && !can(actor, "user.manage")) throw new Forbidden("user.manage");
  if (input.roles.includes("safeguarding_lead")) {
    const holders = await db
      .select({ id: s.personRole.id })
      .from(s.personRole)
      .where(and(eq(s.personRole.role, "safeguarding_lead"), isNull(s.personRole.revokedAt)));
    if (holders.length >= 3) return { ok: false as const, code: "safeguarding_full" };
  }
  const emailHash = lookupHash(input.email);
  const ctx = { actor, locale: "en" as const, ip: opts.ip ?? null };

  const { userId, personId } = await db.transaction(async (tx) => {
    let [user] = await tx.select().from(s.appUser).where(eq(s.appUser.emailHash, emailHash));
    if (user && !user.isStaff) {
      // An email that was used for code sign-in becomes a staff account; its old sessions end.
      await tx.delete(s.authSession).where(eq(s.authSession.userId, user.id));
    }
    if (!user) {
      [user] = await tx.insert(s.appUser).values({ email: encrypt(input.email), emailHash, isStaff: true }).returning();
    } else {
      await tx.update(s.appUser).set({ isStaff: true, deactivatedAt: null, updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
    }
    let [person] = await tx.select({ id: s.person.id }).from(s.person).where(eq(s.person.userId, user!.id)).limit(1);
    if (!person) {
      [person] = await tx
        .insert(s.person)
        .values({
          userId: user!.id,
          firstName: input.firstName,
          surname: encrypt(input.surname),
          gender: "prefer_not_to_say",
          email: encrypt(input.email),
          emailHash,
          preferredChannel: "email",
          status: "active",
          stateId: input.stateId || null,
        })
        .returning({ id: s.person.id });
    }
    for (const role of input.roles) {
      await tx
        .insert(s.personRole)
        .values({ personId: person!.id, role, stateId: role === "state_lead" ? input.stateId || null : null, grantedBy: actor?.personId ?? null })
        .onConflictDoNothing();
      await audit(tx, ctx, { action: "role.grant", entityType: "person", entityId: person!.id, subjectPersonId: person!.id, meta: { role } });
    }
    await audit(tx, ctx, { action: "user.invite", entityType: "app_user", entityId: user!.id, subjectPersonId: person!.id });
    return { userId: user!.id, personId: person!.id };
  });

  const { link } = await createLinkToken(userId, "staff_invite");
  const id = await queueTemplate({
    templateKey: "staff.invite",
    to: input.email,
    channel: "email",
    vars: { roles: input.roles.map((r) => ROLE_NAMES[r]).join(", "), link },
    eventKey: `staff.invite:${userId}:${Date.now()}`,
    storeVars: false,
  });
  if (id) await dispatch([id]).catch(() => console.info("[auth] invite dispatch failed"));

  // If the safeguarding role was granted, tell the current safeguarding leads (spec/03 §4.1 note).
  if (input.roles.includes("safeguarding_lead") && !opts.bootstrap) await notifySafeguardingLeads(personId);
  return { ok: true as const, userId, personId, link };
}

async function notifySafeguardingLeads(newPersonId: string) {
  const leads = await db
    .select({ email: s.person.email })
    .from(s.personRole)
    .innerJoin(s.person, eq(s.person.id, s.personRole.personId))
    .where(and(eq(s.personRole.role, "safeguarding_lead"), isNull(s.personRole.revokedAt), ne(s.person.id, newPersonId)));
  const ids: string[] = [];
  for (const l of leads) {
    const to = decrypt(l.email);
    if (!to) continue;
    const id = await queueTemplate({
      templateKey: "staff.safeguarding_granted",
      to,
      channel: "email",
      vars: {},
      eventKey: `staff.safeguarding_granted:${newPersonId}:${lookupHash(to)}`,
    });
    if (id) ids.push(id);
  }
  await dispatch(ids).catch(() => undefined);
}

/** Deactivate: sessions end and roles are revoked; the person record stays (spec/03 §5). */
export async function deactivateStaff(actor: Actor, userId: string, ip?: string | null) {
  if (!can(actor, "user.manage")) throw new Forbidden("user.manage");
  if (userId === actor.userId) return { ok: false as const, code: "self" };
  const persons = await db.select({ id: s.person.id }).from(s.person).where(eq(s.person.userId, userId));
  const personIds = persons.map((p) => p.id);
  // At least one admin must always exist.
  const admins = await db
    .select({ personId: s.personRole.personId })
    .from(s.personRole)
    .where(and(eq(s.personRole.role, "admin"), isNull(s.personRole.revokedAt)));
  if (admins.length && admins.every((a) => personIds.includes(a.personId))) return { ok: false as const, code: "last_admin" };

  await db.transaction(async (tx) => {
    await tx.update(s.appUser).set({ deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(s.appUser.id, userId));
    if (personIds.length) {
      await tx
        .update(s.personRole)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(inArray(s.personRole.personId, personIds), isNull(s.personRole.revokedAt)));
    }
    await audit(tx, { actor, locale: "en", ip: ip ?? null }, { action: "user.deactivate", entityType: "app_user", entityId: userId });
  });
  await revokeUserSessions(userId);
  return { ok: true as const };
}

export async function listStaff(actor: Actor) {
  if (!can(actor, "user.manage")) throw new Forbidden("user.manage");
  const rows = await db
    .select({
      userId: s.appUser.id,
      email: s.appUser.email,
      totpEnabledAt: s.appUser.totpEnabledAt,
      hasPassword: s.appUser.passwordHash,
      deactivatedAt: s.appUser.deactivatedAt,
      lastSignInAt: s.appUser.lastSignInAt,
      personId: s.person.id,
      firstName: s.person.firstName,
      surname: s.person.surname,
    })
    .from(s.appUser)
    // person.user_id is text (it predates app_user), so compare as text.
    .innerJoin(s.person, sql`${s.person.userId} = ${s.appUser.id}::text`)
    .where(eq(s.appUser.isStaff, true));
  const roles = rows.length
    ? await db
        .select({ personId: s.personRole.personId, role: s.personRole.role, stateName: s.state.name })
        .from(s.personRole)
        .leftJoin(s.state, eq(s.state.id, s.personRole.stateId))
        .where(and(inArray(s.personRole.personId, rows.map((r) => r.personId)), isNull(s.personRole.revokedAt)))
    : [];
  return rows
    .map((r) => ({
      userId: r.userId,
      name: `${r.firstName} ${decrypt(r.surname) ?? ""}`.trim(),
      email: decrypt(r.email) ?? "",
      status: r.deactivatedAt ? ("deactivated" as const) : !r.hasPassword ? ("invited" as const) : !r.totpEnabledAt ? ("no_2fa" as const) : ("active" as const),
      lastSignInAt: r.lastSignInAt,
      roles: roles.filter((x) => x.personId === r.personId).map((x) => (x.stateName ? `${x.role} (${x.stateName})` : x.role)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listStates() {
  return db.select({ id: s.state.id, name: s.state.name }).from(s.state).where(eq(s.state.isActive, true)).orderBy(s.state.name);
}
