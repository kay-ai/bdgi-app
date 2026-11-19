import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema as s } from "@/db";
import { decrypt, lookupHash, newNumericCode, newToken } from "@/lib/crypto";
import { assertCan } from "@/server/permissions/assert";
import type { Actor } from "@/server/permissions/can";
import { audit } from "./audit";
import { dispatch, queueTemplate } from "./messaging";

/**
 * Consent follow-up (spec/05 §3): reminders on day 2 and day 6 while still pending, a staff task
 * on day 10, and the link expires on day 14 (staff can reissue it).
 */
export const REMIND_AFTER_DAYS = [2, 6] as const;
export const STALLED_AFTER_DAYS = 10;
export const CONSENT_TTL_DAYS = 14;
const DAY = 86_400_000;
const guardian = alias(s.person, "guardian");

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/**
 * Only hashes of the link and code are stored, so a reminder carries a fresh pair. The old link
 * stops working, the attempt counter resets, and the expiry date stays where it was.
 */
async function freshLink(consentId: string, now: Date, extraSet: Partial<typeof s.consent.$inferInsert> = {}) {
  const token = newToken();
  const code = newNumericCode();
  await db
    .update(s.consent)
    .set({ tokenHash: lookupHash(token), codeHash: lookupHash(code), codeAttempts: 0, updatedAt: now, ...extraSet })
    .where(eq(s.consent.id, consentId));
  return { token, code, link: `${appUrl()}/consent/${token}` };
}

async function alreadyQueued(eventKey: string) {
  const [m] = await db.select({ id: s.message.id }).from(s.message).where(eq(s.message.eventKey, eventKey)).limit(1);
  return !!m;
}

type Pending = {
  consentId: string;
  requestedAt: Date;
  studentId: string;
  studentFirstName: string;
  stateId: string | null;
  guardianId: string;
  guardianPhone: string | null;
  guardianChannel: "whatsapp" | "sms" | "email";
};

async function sendReminder(p: Pending, eventKey: string, now: Date) {
  if (!p.guardianPhone || (await alreadyQueued(eventKey))) return null;
  const { link, code } = await freshLink(p.consentId, now);
  return queueTemplate({
    templateKey: "consent.reminder",
    to: decrypt(p.guardianPhone),
    channel: p.guardianChannel,
    personId: p.guardianId,
    vars: { studentFirstName: p.studentFirstName, link, code },
    eventKey,
    storeVars: false,
    now,
  });
}

/** The daily job `consent.remind`. Safe to run more than once a day: every step is keyed. */
export async function runConsentReminders(now = new Date()) {
  const rows: Pending[] = await db
    .select({
      consentId: s.consent.id,
      requestedAt: s.consent.requestedAt,
      studentId: s.person.id,
      studentFirstName: s.person.firstName,
      stateId: s.person.stateId,
      guardianId: s.consent.guardianId,
      guardianPhone: guardian.phone,
      guardianChannel: guardian.preferredChannel,
    })
    .from(s.consent)
    .innerJoin(s.person, eq(s.person.id, s.consent.studentId))
    .innerJoin(guardian, eq(guardian.id, s.consent.guardianId))
    .where(
      and(
        eq(s.consent.type, "participation"),
        eq(s.consent.method, "guardian_otp"),
        isNull(s.consent.givenAt),
        isNull(s.consent.withdrawnAt),
        gt(s.consent.expiresAt, now),
        eq(s.person.status, "pending_consent"),
      ),
    )
    .then((r) => r.map((x) => ({ ...x, guardianId: x.guardianId! })));

  const ids: string[] = [];
  let stalled = 0;
  for (const p of rows) {
    const days = (now.getTime() - p.requestedAt.getTime()) / DAY;
    // Only the latest reminder that is due: a missed run does not send two at once.
    for (let i = REMIND_AFTER_DAYS.length - 1; i >= 0; i--) {
      if (days >= REMIND_AFTER_DAYS[i]!) {
        const id = await sendReminder(p, `consent.reminder:auto${i + 1}:${p.consentId}:${p.requestedAt.getTime()}`, now);
        if (id) ids.push(id);
        break;
      }
    }
    if (days >= STALLED_AFTER_DAYS) {
      const [t] = await db
        .insert(s.task)
        .values({
          title: `No reply from ${p.studentFirstName}'s guardian`,
          detail: "Call guardian or arrange school route.",
          kind: "consent_stalled",
          entityType: "person",
          entityId: p.studentId,
          stateId: p.stateId,
          dueOn: now.toISOString().slice(0, 10),
          dedupeKey: `consent_stalled:${p.studentId}:${p.requestedAt.getTime()}`,
        })
        .onConflictDoNothing({ target: s.task.dedupeKey })
        .returning({ id: s.task.id });
      if (t) stalled++;
    }
  }
  await dispatch(ids, now).catch((e) => console.error("[consent] reminder dispatch failed", e instanceof Error ? e.message : e));
  return { pending: rows.length, reminded: ids.length, stalled };
}

/** Staff: send a new link and code, valid another 14 days (spec/05 §3 "staff can reissue"). */
export async function reissueConsent(actor: Actor | null, studentId: string, opts: { ip?: string | null; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const [row] = await db
    .select({
      consentId: s.consent.id,
      stateId: s.person.stateId,
      schoolId: s.person.schoolId,
      studentFirstName: s.person.firstName,
      status: s.person.status,
      guardianId: guardian.id,
      guardianFirstName: guardian.firstName,
      guardianPhone: guardian.phone,
      guardianChannel: guardian.preferredChannel,
    })
    .from(s.consent)
    .innerJoin(s.person, eq(s.person.id, s.consent.studentId))
    .innerJoin(guardian, eq(guardian.id, s.consent.guardianId))
    .where(and(eq(s.consent.studentId, studentId), eq(s.consent.type, "participation"), isNull(s.consent.givenAt), isNull(s.consent.withdrawnAt)))
    .limit(1);
  const ctx = assertCan(actor, "intake.review", {
    ip: opts.ip,
    resource: row ? { personId: studentId, stateId: row.stateId, schoolId: row.schoolId } : undefined,
  });
  if (!row || row.status !== "pending_consent") return { ok: false as const, code: "not_pending" as const };
  if (!row.guardianPhone) return { ok: false as const, code: "no_phone" as const };

  const { link, code } = await freshLink(row.consentId, now, { requestedAt: now, expiresAt: new Date(now.getTime() + CONSENT_TTL_DAYS * DAY) });
  const [settingRow] = await db.select({ value: s.setting.value }).from(s.setting).where(eq(s.setting.key, "org_phone"));
  const [intakeSchool] = row.schoolId ? await db.select({ name: s.school.name }).from(s.school).where(eq(s.school.id, row.schoolId)) : [];
  const id = await queueTemplate({
    templateKey: "consent.request",
    to: decrypt(row.guardianPhone),
    channel: row.guardianChannel,
    personId: row.guardianId,
    vars: {
      guardianName: row.guardianFirstName,
      studentFirstName: row.studentFirstName,
      schoolName: intakeSchool?.name ?? "",
      link,
      code,
      orgPhone: String(settingRow?.value ?? ""),
    },
    eventKey: `consent.request:${studentId}:reissue:${now.getTime()}`,
    storeVars: false,
    now,
  });
  // A reissued request starts the reminder schedule again; the old stalled task is closed.
  await db
    .update(s.task)
    .set({ status: "done", updatedAt: now })
    .where(and(eq(s.task.kind, "consent_stalled"), eq(s.task.entityId, studentId), eq(s.task.status, "open")));
  await audit(db, ctx, { action: "consent.reissue", entityType: "consent", entityId: row.consentId, subjectPersonId: studentId });
  if (id) await dispatch([id], now);
  return { ok: true as const };
}
