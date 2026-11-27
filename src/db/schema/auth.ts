import { boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tz } from "./_shared";

/**
 * Sign-in accounts, built in the app (spec/03, M3; DECISIONS.md D-013). A `user` is a way of
 * signing in (a phone number, an email, a staff password); `person` rows point at it with
 * `person.user_id`. One phone can therefore act as a guardian and their children.
 */
export const appUser = pgTable(
  "app_user",
  {
    id: id(),
    phone: text("phone"), // enc, E.164
    phoneHash: text("phone_hash").unique(),
    email: text("email"), // enc
    emailHash: text("email_hash").unique(),
    /** scrypt, "s1$N$r$p$salt$hash" (staff only). */
    passwordHash: text("password_hash"),
    isStaff: boolean("is_staff").notNull().default(false),
    totpSecret: text("totp_secret"), // enc, base32
    totpEnabledAt: tz("totp_enabled_at"),
    /** Hashes of unused backup codes. */
    backupCodes: jsonb("backup_codes").$type<string[]>(),
    failedSignIns: integer("failed_sign_ins").notNull().default(0),
    lockedUntil: tz("locked_until"),
    deactivatedAt: tz("deactivated_at"),
    lastSignInAt: tz("last_sign_in_at"),
    ...timestamps,
  },
);

/**
 * A signed-in browser. The cookie holds a random token; only its SHA-256 is stored. `stage` is
 * `password` between a staff password and the 2-step code, and `full` once signed in.
 */
export const authSession = pgTable(
  "auth_session",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    stage: text("stage", { enum: ["password", "full"] }).notNull().default("full"),
    method: text("method", { enum: ["phone", "email", "google", "staff"] }).notNull(),
    activePersonId: uuid("active_person_id"),
    expiresAt: tz("expires_at").notNull(),
    lastSeenAt: tz("last_seen_at").notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("auth_session_user_idx").on(t.userId)],
);

/**
 * One-time secrets: 6-digit sign-in codes (phone or email) and link tokens (staff invite,
 * password reset). Only hashes are stored. `subject_hash` is the lookup hash of the phone or email
 * for codes, or of the token for links.
 */
export const authCode = pgTable(
  "auth_code",
  {
    id: id(),
    purpose: text("purpose", { enum: ["sign_in_phone", "sign_in_email", "staff_invite", "password_reset"] }).notNull(),
    subjectHash: text("subject_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    userId: uuid("user_id").references(() => appUser.id, { onDelete: "cascade" }),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: tz("expires_at").notNull(),
    usedAt: tz("used_at"),
    ...timestamps,
  },
  (t) => [index("auth_code_subject_idx").on(t.purpose, t.subjectHash)],
);
