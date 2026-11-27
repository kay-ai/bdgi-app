import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash } from "@/lib/crypto";
import {
  hashPassword,
  newBackupCodes,
  newCode,
  newLinkToken,
  newTotpSecret,
  normaliseBackupCode,
  otpauthUri,
  passwordProblem,
  sha256,
  verifyPassword,
  verifyTotp,
  type PasswordProblem,
} from "@/lib/auth-crypto";
import { normalisePhone } from "@/lib/phone";
import { homeFor, type Role } from "@/server/permissions/can";
import { audit } from "@/server/services/audit";
import { dispatch, queueTemplate } from "@/server/services/messaging";
import { hit } from "@/server/services/rate-limit";
import { createSession, profilesForUser, revokeUserSessions, type SessionRow, type UserRow } from "./sessions";

const CODE_TTL = 10 * 60_000;
const MAX_CODE_ATTEMPTS = 5;
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const log = (msg: string, extra?: Record<string, string | number | boolean>) =>
  console.info(`[auth] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`);
const anonCtx = (ip?: string | null) => ({ actor: null, locale: "en" as const, ip: ip ?? null });

type Meta = { ip?: string | null; userAgent?: string | null };

/* ---------- Phone and email codes (spec/03 §1.1–1.2) ---------- */

export type Subject = { kind: "phone"; value: string } | { kind: "email"; value: string };

/** Turn what was typed into a canonical subject, or null if it isn't a phone number / email address. */
export function parseSubject(kind: "phone" | "email", raw: string): Subject | null {
  if (kind === "phone") {
    const p = normalisePhone(raw);
    return p ? { kind: "phone", value: p } : null;
  }
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200 ? { kind: "email", value: e } : null;
}

const purposeOf = (s: Subject) => (s.kind === "phone" ? "sign_in_phone" : "sign_in_email") as "sign_in_phone" | "sign_in_email";
const codeHash = (subjectHash: string, code: string) => lookupHash(`${subjectHash}:${code}`);

/**
 * Send a sign-in code. The answer is the same whether or not an account exists (spec/03 §1.1.5);
 * `rate_limited` is the only other outcome.
 */
export async function requestSignInCode(subject: Subject, meta: Meta = {}): Promise<{ ok: true } | { ok: false; code: "rate_limited" }> {
  const subjectHash = lookupHash(subject.value);
  if (meta.ip && !(await hit(`otp-ip:${meta.ip}`, 10, 3600))) return { ok: false, code: "rate_limited" };
  if (!(await hit(`otp-subject:${subjectHash}`, 5, 3600))) return { ok: false, code: "rate_limited" };
  const purpose = purposeOf(subject);

  // Staff sign in with password and 2-step only: no code is sent to a staff email.
  if (subject.kind === "email") {
    const [u] = await db.select({ isStaff: s.appUser.isStaff }).from(s.appUser).where(eq(s.appUser.emailHash, subjectHash));
    if (u?.isStaff) {
      log("code not sent: staff address");
      return { ok: true };
    }
  }

  const code = newCode();
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    // A new code replaces any earlier one.
    await tx
      .update(s.authCode)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(s.authCode.purpose, purpose), eq(s.authCode.subjectHash, subjectHash), isNull(s.authCode.usedAt)));
    const [row] = await tx
      .insert(s.authCode)
      .values({ purpose, subjectHash, codeHash: codeHash(subjectHash, code), expiresAt: new Date(Date.now() + CODE_TTL) })
      .returning({ id: s.authCode.id });

    let channel: "whatsapp" | "sms" | "email" = "email";
    let language: "en" | "yo" = "en";
    if (subject.kind === "phone") {
      const [p] = await tx
        .select({ ch: s.person.preferredChannel, optIn: s.person.whatsappOptIn, lang: s.person.language })
        .from(s.person)
        .where(eq(s.person.phoneHash, subjectHash))
        .limit(1);
      // Preferred channel if known; WhatsApp only with opt-in and a live provider; otherwise SMS.
      const whatsappLive = !!process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_PROVIDER !== "console";
      channel = p?.ch === "whatsapp" && (p.optIn || !whatsappLive) ? "whatsapp" : "sms";
      if (p?.lang === "yo") language = "yo";
    }
    const id = await queueTemplate(
      { templateKey: "auth.otp", to: subject.value, channel, vars: { code }, eventKey: `auth.otp:${row!.id}`, language, storeVars: false },
      tx,
    );
    if (id) ids.push(id);
  });
  await dispatch(ids).catch(() => log("code dispatch failed"));
  return { ok: true };
}

export type CodeResult =
  | { ok: true; token: string; maxAge: number; next: string }
  | { ok: false; code: "invalid" | "expired" | "too_many" | "rate_limited" | "deactivated" };

/** Check a sign-in code, find or create the user, open a session and decide where to go next. */
export async function verifySignInCode(subject: Subject, code: string, meta: Meta = {}): Promise<CodeResult> {
  if (meta.ip && !(await hit(`otp-verify-ip:${meta.ip}`, 30, 3600))) return { ok: false, code: "rate_limited" };
  const subjectHash = lookupHash(subject.value);
  const purpose = purposeOf(subject);
  const [row] = await db
    .select()
    .from(s.authCode)
    .where(and(eq(s.authCode.purpose, purpose), eq(s.authCode.subjectHash, subjectHash), isNull(s.authCode.usedAt)))
    .orderBy(desc(s.authCode.createdAt))
    .limit(1);
  if (!row) return { ok: false, code: "expired" };
  if (row.expiresAt < new Date()) return { ok: false, code: "expired" };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, code: "too_many" };

  const good = /^\d{6}$/.test(code) && codeHash(subjectHash, code) === row.codeHash;
  if (!good) {
    const attempts = row.attempts + 1;
    await db
      .update(s.authCode)
      .set({ attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { usedAt: new Date() } : {}), updatedAt: new Date() })
      .where(eq(s.authCode.id, row.id));
    return { ok: false, code: attempts >= MAX_CODE_ATTEMPTS ? "too_many" : "invalid" };
  }
  // Single use, even if two requests race.
  const [used] = await db
    .update(s.authCode)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(s.authCode.id, row.id), isNull(s.authCode.usedAt)))
    .returning({ id: s.authCode.id });
  if (!used) return { ok: false, code: "expired" };

  return openSession(subject, subject.kind, meta);
}

/**
 * The shared end of every Hub sign-in (a code, or Google): find or create the user for this phone
 * or email, open a session and decide where to go next. Staff never sign in this way.
 */
export async function openSession(
  subject: Subject,
  method: "phone" | "email" | "google",
  meta: Meta = {},
): Promise<{ ok: true; token: string; maxAge: number; next: string } | { ok: false; code: "invalid" | "deactivated" }> {
  const user = await findOrCreateUser(subject, lookupHash(subject.value));
  if (user.deactivatedAt) return { ok: false, code: "deactivated" };
  if (user.isStaff) return { ok: false, code: "invalid" }; // staff use /staff/sign-in

  const profiles = await profilesForUser(user.id);
  const only = profiles.length === 1 ? profiles[0]! : null;
  const session = await createSession({
    userId: user.id,
    method,
    stage: "full",
    activePersonId: only?.personId ?? null,
    ...meta,
  });
  await db.update(s.appUser).set({ lastSignInAt: new Date(), updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
  if (only) await audit(db, { actor: null, locale: "en", ip: meta.ip }, { action: "auth.sign_in", entityType: "person", entityId: only.personId, meta: { method } });
  return { ok: true, token: session.token, maxAge: session.maxAge, next: nextAfterSignIn(profiles) };
}

/** none → /join · one → that role's home · several → the profile chooser (spec/03 §1.1.4). */
export function nextAfterSignIn(profiles: { roles: string[] }[]): string {
  if (profiles.length === 0) return "/join";
  if (profiles.length > 1) return "/sign-in/who";
  return homeFor(profiles[0]!.roles as Role[]);
}

async function findOrCreateUser(subject: Subject, subjectHash: string): Promise<UserRow> {
  const col = subject.kind === "phone" ? s.appUser.phoneHash : s.appUser.emailHash;
  const [existing] = await db.select().from(s.appUser).where(eq(col, subjectHash));
  if (existing) return existing;
  const [created] = await db
    .insert(s.appUser)
    .values(
      subject.kind === "phone"
        ? { phone: encrypt(subject.value), phoneHash: subjectHash }
        : { email: encrypt(subject.value), emailHash: subjectHash },
    )
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(s.appUser).where(eq(col, subjectHash));
  return again!;
}

/* ---------- Staff: password, then 2-step (spec/03 §1.3) ---------- */

export type StaffResult =
  | { ok: true; token: string; maxAge: number; next: string }
  | { ok: false; code: "invalid" | "locked" | "rate_limited" };

async function recordFailure(user: UserRow, ip?: string | null) {
  const failed = user.failedSignIns + 1;
  if (failed >= LOCK_AFTER) {
    const until = new Date(Date.now() + LOCK_MINUTES * 60_000);
    await db.update(s.appUser).set({ failedSignIns: 0, lockedUntil: until, updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
    await audit(db, anonCtx(ip), { action: "auth.locked", entityType: "app_user", entityId: user.id });
    const email = decrypt(user.email);
    if (email) {
      const id = await queueTemplate({
        templateKey: "staff.locked",
        to: email,
        channel: "email",
        vars: { minutes: LOCK_MINUTES, link: `${appUrl()}/staff/forgot-password` },
        eventKey: `staff.locked:${user.id}:${until.getTime()}`,
      });
      if (id) await dispatch([id]).catch(() => log("lock notice dispatch failed"));
    }
    return;
  }
  await db.update(s.appUser).set({ failedSignIns: failed, updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
}

const isLocked = (u: UserRow) => !!u.lockedUntil && u.lockedUntil > new Date();

/** Email + password. Opens a short "password" session that only the 2-step step can complete. */
export async function staffPasswordSignIn(emailRaw: string, password: string, meta: Meta = {}): Promise<StaffResult> {
  if (meta.ip && !(await hit(`staff-ip:${meta.ip}`, 30, 3600))) return { ok: false, code: "rate_limited" };
  const email = emailRaw.trim().toLowerCase();
  const [user] = await db.select().from(s.appUser).where(eq(s.appUser.emailHash, lookupHash(email)));
  const usable = user && user.isStaff && !user.deactivatedAt;
  if (usable && isLocked(user)) {
    await verifyPassword(password, null); // same time either way
    return { ok: false, code: "locked" };
  }
  const good = await verifyPassword(password, usable ? user.passwordHash : null);
  if (!usable || !good) {
    if (usable) await recordFailure(user, meta.ip);
    return { ok: false, code: "invalid" };
  }
  await db.update(s.appUser).set({ failedSignIns: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
  const session = await createSession({ userId: user.id, method: "staff", stage: "password", ...meta });
  return { ok: true, token: session.token, maxAge: session.maxAge, next: user.totpEnabledAt ? "/staff/two-factor" : "/staff/two-factor/setup" };
}

/** Complete a staff sign-in with a 2-step code or a backup code. */
export async function staffSecondStep(
  row: { session: SessionRow; user: UserRow },
  codeRaw: string,
  meta: Meta = {},
): Promise<{ ok: true; next: string; maxAge: number } | { ok: false; code: "invalid" | "locked" | "expired" }> {
  const { session, user } = row;
  if (session.stage !== "password" || session.method !== "staff" || !user.totpEnabledAt || !user.totpSecret) return { ok: false, code: "expired" };
  if (isLocked(user)) return { ok: false, code: "locked" };
  const code = codeRaw.trim();
  let good = verifyTotp(decrypt(user.totpSecret), code.replace(/\s/g, ""));
  let usedBackup = false;
  if (!good && normaliseBackupCode(code).length === 8) {
    const h = sha256(normaliseBackupCode(code));
    const left = user.backupCodes ?? [];
    if (left.includes(h)) {
      good = true;
      usedBackup = true;
      await db.update(s.appUser).set({ backupCodes: left.filter((x) => x !== h), updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
    }
  }
  if (!good) {
    await recordFailure(user, meta.ip);
    return { ok: false, code: "invalid" };
  }
  return completeStaffSession(session, user, meta, usedBackup);
}

async function completeStaffSession(session: SessionRow, user: UserRow, meta: Meta, usedBackup = false) {
  const profiles = await profilesForUser(user.id);
  const personId = profiles[0]?.personId ?? null;
  const maxAge = 12 * 3_600;
  await db
    .update(s.authSession)
    .set({ stage: "full", activePersonId: personId, expiresAt: new Date(Date.now() + maxAge * 1000), updatedAt: new Date() })
    .where(eq(s.authSession.id, session.id));
  await db.update(s.appUser).set({ failedSignIns: 0, lastSignInAt: new Date(), updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
  if (personId) {
    await audit(db, anonCtx(meta.ip), { action: "auth.sign_in", entityType: "person", entityId: personId, meta: { method: "staff", backupCode: usedBackup } });
  }
  return { ok: true as const, next: "/console", maxAge };
}

/** First staff sign-in: make (or reuse) a pending secret and return what the setup page shows. */
export async function beginTotpSetup(row: { session: SessionRow; user: UserRow }) {
  const { session, user } = row;
  if (session.stage !== "password" || session.method !== "staff" || user.totpEnabledAt) return null;
  let secret = user.totpSecret ? decrypt(user.totpSecret) : null;
  if (!secret) {
    secret = newTotpSecret();
    await db.update(s.appUser).set({ totpSecret: encrypt(secret), updatedAt: new Date() }).where(eq(s.appUser.id, user.id));
  }
  const account = decrypt(user.email) ?? "staff";
  return { secret, uri: otpauthUri(secret, account) };
}

/** Confirm the first code from the app; turn 2-step on and hand back ten backup codes, shown once. */
export async function finishTotpSetup(
  row: { session: SessionRow; user: UserRow },
  code: string,
  meta: Meta = {},
): Promise<{ ok: true; backupCodes: string[]; maxAge: number } | { ok: false; code: "invalid" | "expired" }> {
  const { session, user } = row;
  if (session.stage !== "password" || session.method !== "staff" || user.totpEnabledAt || !user.totpSecret) return { ok: false, code: "expired" };
  if (!verifyTotp(decrypt(user.totpSecret), code.replace(/\s/g, ""))) return { ok: false, code: "invalid" };
  const codes = newBackupCodes();
  await db
    .update(s.appUser)
    .set({ totpEnabledAt: new Date(), backupCodes: codes.map((c) => sha256(normaliseBackupCode(c))), updatedAt: new Date() })
    .where(eq(s.appUser.id, user.id));
  const done = await completeStaffSession(session, { ...user, totpEnabledAt: new Date() }, meta);
  await audit(db, anonCtx(meta.ip), { action: "auth.two_factor_enabled", entityType: "app_user", entityId: user.id });
  return { ok: true, backupCodes: codes, maxAge: done.maxAge };
}

/* ---------- Links: staff invitation and password reset ---------- */

const LINK_TTL = { staff_invite: 72 * 3_600_000, password_reset: 30 * 60_000 } as const;

export async function createLinkToken(userId: string, purpose: "staff_invite" | "password_reset") {
  const token = newLinkToken();
  await db
    .update(s.authCode)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(s.authCode.userId, userId), eq(s.authCode.purpose, purpose), isNull(s.authCode.usedAt)));
  await db.insert(s.authCode).values({
    purpose,
    userId,
    subjectHash: sha256(token),
    codeHash: "-",
    expiresAt: new Date(Date.now() + LINK_TTL[purpose]),
  });
  return { token, link: `${appUrl()}/staff/set-password?token=${token}` };
}

/** Check a link without using it (to show the form or "this link has expired"). */
export async function peekLinkToken(token: string) {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select({ purpose: s.authCode.purpose, userId: s.authCode.userId })
    .from(s.authCode)
    .where(and(eq(s.authCode.subjectHash, sha256(token)), isNull(s.authCode.usedAt), gt(s.authCode.expiresAt, new Date())));
  return row && (row.purpose === "staff_invite" || row.purpose === "password_reset") ? row : null;
}

/** Set a password from an invite or reset link. Signs out every session of that user. */
export async function setPasswordWithToken(
  token: string,
  password: string,
  meta: Meta = {},
): Promise<{ ok: true } | { ok: false; code: "expired" | PasswordProblem }> {
  const link = await peekLinkToken(token);
  if (!link?.userId) return { ok: false, code: "expired" };
  const [user] = await db.select().from(s.appUser).where(eq(s.appUser.id, link.userId));
  if (!user || user.deactivatedAt) return { ok: false, code: "expired" };
  const [p] = await db.select({ firstName: s.person.firstName }).from(s.person).where(eq(s.person.userId, user.id)).limit(1);
  const email = decrypt(user.email) ?? "";
  const problem = passwordProblem(password, [p?.firstName ?? "", email.split("@")[0] ?? ""]);
  if (problem) return { ok: false, code: problem };
  const [used] = await db
    .update(s.authCode)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(s.authCode.subjectHash, sha256(token)), isNull(s.authCode.usedAt)))
    .returning({ id: s.authCode.id });
  if (!used) return { ok: false, code: "expired" };
  await db
    .update(s.appUser)
    .set({ passwordHash: await hashPassword(password), failedSignIns: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(s.appUser.id, user.id));
  await revokeUserSessions(user.id);
  await audit(db, anonCtx(meta.ip), { action: link.purpose === "staff_invite" ? "auth.invite_accepted" : "auth.password_reset", entityType: "app_user", entityId: user.id });
  return { ok: true };
}

/** "Forgot password": always the same answer; a link is emailed only to an active staff account. */
export async function requestPasswordReset(emailRaw: string, meta: Meta = {}) {
  const email = emailRaw.trim().toLowerCase();
  if (meta.ip && !(await hit(`reset-ip:${meta.ip}`, 10, 3600))) return;
  if (!(await hit(`reset:${lookupHash(email)}`, 3, 3600))) return;
  const [user] = await db.select().from(s.appUser).where(eq(s.appUser.emailHash, lookupHash(email)));
  if (!user || !user.isStaff || user.deactivatedAt || !user.passwordHash) return;
  const { link } = await createLinkToken(user.id, "password_reset");
  const id = await queueTemplate({
    templateKey: "staff.password_reset",
    to: email,
    channel: "email",
    vars: { link },
    eventKey: `staff.password_reset:${user.id}:${Date.now()}`,
    storeVars: false,
  });
  if (id) await dispatch([id]).catch(() => log("reset dispatch failed"));
}
