import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  time,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { id, timestamps, tz } from "./_shared";
import {
  assessmentType,
  attendanceStatus,
  cohortRole,
  cohortStatus,
  contentStatus,
  language,
  programmeKind,
  sessionStatus,
  volunteerStage,
} from "./enums";
import { person } from "./people";
import { school } from "./geo";
import { contentPage } from "./content";

export const rubric = pgTable("rubric", {
  id: id(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  criteria: jsonb("criteria").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const programme = pgTable("programme", {
  id: id(),
  slug: text("slug").notNull().unique(),
  kind: programmeKind("kind").notNull(),
  nameEn: text("name_en").notNull(),
  nameYo: text("name_yo"),
  summaryEn: text("summary_en").notNull(),
  summaryYo: text("summary_yo"),
  isEnrolling: boolean("is_enrolling").notNull().default(false),
  minAge: integer("min_age").notNull().default(10),
  maxAge: integer("max_age").notNull().default(18),
  defaultSessions: integer("default_sessions").notNull().default(8),
  rubricId: uuid("rubric_id").references(() => rubric.id),
  pageId: uuid("page_id").references((): AnyPgColumn => contentPage.id),
  acceptsDesignatedGifts: boolean("accepts_designated_gifts").notNull().default(false),
  fundraisingTargetMinor: integer("fundraising_target_minor"),
  fundraisingCurrency: text("fundraising_currency"),
  sort: integer("sort").notNull().default(0),
  status: contentStatus("status").notNull().default("published"),
  ...timestamps,
});

export const lessonPlan = pgTable(
  "lesson_plan",
  {
    id: id(),
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => programme.id),
    position: integer("position").notNull(),
    titleEn: text("title_en").notNull(),
    titleYo: text("title_yo"),
    objectives: text("objectives").notNull().default(""),
    coachNotes: jsonb("coach_notes"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    ...timestamps,
  },
  (t) => [uniqueIndex("lesson_plan_pos_uq").on(t.programmeId, t.position)],
);

export const cohort = pgTable("cohort", {
  id: id(),
  programmeId: uuid("programme_id")
    .notNull()
    .references(() => programme.id),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => school.id),
  name: text("name").notNull(),
  term: text("term").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  meetingDay: smallint("meeting_day"),
  meetingTime: time("meeting_time"),
  venue: text("venue"),
  capacity: integer("capacity").notNull().default(30),
  status: cohortStatus("status").notNull().default("draft"),
  aiCoachEnabled: boolean("ai_coach_enabled").notNull().default(false),
  isPilotGroup: boolean("is_pilot_group").notNull().default(false),
  closedAt: tz("closed_at"),
  createdBy: uuid("created_by").references(() => person.id),
  deletedAt: tz("deleted_at"),
  ...timestamps,
});

export const cohortMember = pgTable(
  "cohort_member",
  {
    id: id(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohort.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    role: cohortRole("role").notNull(),
    joinedOn: date("joined_on").notNull(),
    leftOn: date("left_on"),
    leftReason: text("left_reason"),
    completed: boolean("completed").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("cohort_member_uq").on(t.cohortId, t.personId)],
);

export const session = pgTable(
  "session",
  {
    id: id(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohort.id),
    lessonPlanId: uuid("lesson_plan_id").references(() => lessonPlan.id),
    startsAt: tz("starts_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    venue: text("venue"),
    status: sessionStatus("status").notNull().default("planned"),
    cancelReason: text("cancel_reason"),
    notes: text("notes"),
    heldMarkedBy: uuid("held_marked_by").references(() => person.id),
    reminderSentAt: tz("reminder_sent_at"),
    ...timestamps,
  },
  (t) => [index("session_cohort_starts_idx").on(t.cohortId, t.startsAt)],
);

export const sessionCoach = pgTable(
  "session_coach",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => session.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    confirmed: boolean("confirmed").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_coach_uq").on(t.sessionId, t.personId)],
);

export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => session.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    status: attendanceStatus("status").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => person.id),
    recordedAt: tz("recorded_at").notNull(),
    clientId: uuid("client_id").notNull().unique(),
    ...timestamps,
  },
  (t) => [uniqueIndex("attendance_uq").on(t.sessionId, t.personId)],
);

export const assessment = pgTable(
  "assessment",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    cohortId: uuid("cohort_id").references(() => cohort.id),
    type: assessmentType("type").notNull(),
    selfAnswers: jsonb("self_answers"),
    selfScore: numeric("self_score"),
    rubricId: uuid("rubric_id").references(() => rubric.id),
    rubricScores: jsonb("rubric_scores"),
    rubricTotal: numeric("rubric_total"),
    scoredBy: uuid("scored_by").references(() => person.id),
    takenAt: tz("taken_at").notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [unique("assessment_uq").on(t.personId, t.cohortId, t.type).nullsNotDistinct()],
);

export const volunteerProfile = pgTable("volunteer_profile", {
  id: id(),
  personId: uuid("person_id")
    .notNull()
    .unique()
    .references(() => person.id),
  stage: volunteerStage("stage").notNull().default("applied"),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  languages: language("languages").array().notNull().default(sql`'{}'::language[]`),
  occupation: text("occupation"),
  organisation: text("organisation"),
  isNysc: boolean("is_nysc").notNull().default(false),
  isAlumna: boolean("is_alumna").notNull().default(false),
  availability: jsonb("availability").notNull().default({}),
  maxCohorts: integer("max_cohorts").notNull().default(1),
  motivation: text("motivation").notNull(),
  experience: text("experience"),
  canTravelLgas: uuid("can_travel_lgas").array().notNull().default(sql`'{}'::uuid[]`),
  idDocumentKey: text("id_document_key"),
  interviewNotes: text("interview_notes"),
  interviewedBy: uuid("interviewed_by").references(() => person.id),
  codeOfConductSignedAt: tz("code_of_conduct_signed_at"),
  codeOfConductVersion: text("code_of_conduct_version"),
  trainingCompletedAt: tz("training_completed_at"),
  activatedAt: tz("activated_at"),
  pausedReason: text("paused_reason"),
  ...timestamps,
});

export const volunteerReference = pgTable("volunteer_reference", {
  id: id(),
  volunteerId: uuid("volunteer_id")
    .notNull()
    .references(() => person.id),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  phone: text("phone").notNull(), // enc
  email: text("email"), // enc
  status: text("status", { enum: ["pending", "contacted", "positive", "concern", "unreachable"] })
    .notNull()
    .default("pending"),
  notes: text("notes"),
  checkedBy: uuid("checked_by").references(() => person.id),
  checkedAt: tz("checked_at"),
  ...timestamps,
});

export const trainingModule = pgTable("training_module", {
  id: id(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleYo: text("title_yo"),
  body: jsonb("body").notNull(),
  position: integer("position").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  kind: text("kind", { enum: ["safeguarding", "coaching", "platform"] }).notNull(),
  passMark: integer("pass_mark").notNull().default(80),
  ...timestamps,
});

export const trainingQuestion = pgTable("training_question", {
  id: id(),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => trainingModule.id),
  position: integer("position").notNull(),
  promptEn: text("prompt_en").notNull(),
  promptYo: text("prompt_yo"),
  options: jsonb("options").notNull(),
  correctKey: text("correct_key").notNull(),
  explanation: text("explanation"),
  ...timestamps,
});

export const trainingAttempt = pgTable("training_attempt", {
  id: id(),
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => trainingModule.id),
  answers: jsonb("answers").notNull(),
  score: integer("score").notNull(),
  passed: boolean("passed").notNull(),
  takenAt: tz("taken_at").notNull().defaultNow(),
  ...timestamps,
});

export const hoursEntry = pgTable(
  "hours_entry",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    sessionId: uuid("session_id").references(() => session.id),
    date: date("date").notNull(),
    hours: numeric("hours", { precision: 4, scale: 2 }).notNull(),
    description: text("description"),
    source: text("source", { enum: ["session", "manual"] }).notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    approvedBy: uuid("approved_by").references(() => person.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("hours_session_uq")
      .on(t.personId, t.sessionId)
      .where(sql`${t.sessionId} is not null`),
  ],
);

export const certificate = pgTable("certificate", {
  id: id(),
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  kind: text("kind", { enum: ["volunteer_service", "cohort_completion", "dream_graduate", "competition"] }).notNull(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  details: jsonb("details").notNull().default({}),
  pdfKey: text("pdf_key"),
  issuedAt: tz("issued_at").notNull().defaultNow(),
  revokedAt: tz("revoked_at"),
  ...timestamps,
});
