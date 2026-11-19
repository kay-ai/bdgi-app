import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  inet,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { id, timestamps, tz } from "./_shared";
import {
  channel,
  classLevel,
  consentMethod,
  consentType,
  gender,
  language,
  personStatus,
  role,
} from "./enums";
import { lga, school, schoolAgreement, state } from "./geo";
import { campaign } from "./content";

/** One human. `user_id` links to the Better Auth `user` table added in M3. */
export const person = pgTable(
  "person",
  {
    id: id(),
    userId: text("user_id"),
    firstName: text("first_name").notNull(),
    surname: text("surname").notNull(), // enc
    preferredName: text("preferred_name"),
    dateOfBirth: text("date_of_birth"), // enc (ISO date)
    ageAtSignup: integer("age_at_signup"),
    gender: gender("gender").notNull(),
    phone: text("phone"), // enc, E.164
    phoneHash: text("phone_hash"),
    email: text("email"), // enc
    emailHash: text("email_hash"),
    language: language("language").notNull().default("en"),
    preferredChannel: channel("preferred_channel").notNull().default("whatsapp"),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    stateId: uuid("state_id").references(() => state.id),
    lgaId: uuid("lga_id").references(() => lga.id),
    schoolId: uuid("school_id").references((): AnyPgColumn => school.id),
    schoolOther: text("school_other"),
    classLevel: classLevel("class_level"),
    avatarKey: text("avatar_key").notNull().default("a01"),
    status: personStatus("status").notNull(),
    sourceCampaignId: uuid("source_campaign_id").references((): AnyPgColumn => campaign.id),
    notes: text("notes"),
    anonymisedAt: tz("anonymised_at"),
    deletedAt: tz("deleted_at"),
    ...timestamps,
  },
  (t) => [
    index("person_status_idx").on(t.status),
    index("person_school_idx").on(t.schoolId),
    index("person_state_lga_idx").on(t.stateId, t.lgaId),
    index("person_phone_hash_idx").on(t.phoneHash),
    index("person_email_hash_idx").on(t.emailHash),
  ],
);

export const personRole = pgTable(
  "person_role",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    role: role("role").notNull(),
    stateId: uuid("state_id").references(() => state.id),
    grantedBy: uuid("granted_by").references((): AnyPgColumn => person.id),
    revokedAt: tz("revoked_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("person_role_active_uq")
      .on(t.personId, t.role, t.stateId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

export const guardianLink = pgTable(
  "guardian_link",
  {
    id: id(),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => person.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => person.id),
    relationship: text("relationship").notNull(),
    isPrimary: boolean("is_primary").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("guardian_link_uq").on(t.guardianId, t.studentId)],
);

export const consent = pgTable(
  "consent",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => person.id),
    guardianId: uuid("guardian_id").references(() => person.id),
    type: consentType("type").notNull(),
    method: consentMethod("method").notNull(),
    tokenHash: text("token_hash").unique(),
    codeHash: text("code_hash"),
    codeAttempts: integer("code_attempts").notNull().default(0),
    requestedAt: tz("requested_at").notNull().defaultNow(),
    expiresAt: tz("expires_at"),
    givenAt: tz("given_at"),
    withdrawnAt: tz("withdrawn_at"),
    guardianFullName: text("guardian_full_name"), // enc
    ip: inet("ip"),
    userAgent: text("user_agent"),
    schoolAgreementId: uuid("school_agreement_id").references(() => schoolAgreement.id),
    documentKey: text("document_key"),
    textVersion: text("text_version").notNull(),
    ...timestamps,
  },
  (t) => [index("consent_student_type_idx").on(t.studentId, t.type)],
);

export const intakeResponse = pgTable("intake_response", {
  id: id(),
  personId: uuid("person_id")
    .notNull()
    .unique()
    .references(() => person.id),
  // Sign-up asks only for the essentials (D-019); the rest is filled in on the Hub profile.
  dreamCareer: text("dream_career"),
  interests: text("interests").array().notNull().default([]),
  communityDream: text("community_dream"),
  needs: text("needs").array().notNull().default([]),
  needsOther: text("needs_other"),
  schoolSubject: text("school_subject"),
  programmeIds: uuid("programme_ids").array().notNull(),
  hasOwnPhone: boolean("has_own_phone"),
  deviceAccess: text("device_access"),
  anythingElse: text("anything_else"),
  /** When the girl finished her profile; null until then. */
  completedAt: tz("completed_at"),
  ...timestamps,
});
