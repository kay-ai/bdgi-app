import {
  boolean,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  unique,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps, tz } from "./_shared";
import {
  caseCategory,
  caseSeverity,
  caseStatus,
  channel,
  dataRequestStatus,
  dataRequestType,
  donationFrequency,
  donationStatus,
  jobStatus,
  messageDirection,
  messageStatus,
  role,
  speechStatus,
  taskStatus,
} from "./enums";
import { person } from "./people";
import { cohort, programme } from "./programmes";
import { school, state } from "./geo";
import { campaign, partner } from "./content";

/* ---------- Messaging (spec/08) ---------- */

export const messageTemplate = pgTable("message_template", {
  id: id(),
  key: text("key").notNull().unique(),
  category: text("category", { enum: ["utility", "authentication", "marketing"] }).notNull(),
  channels: channel("channels").array().notNull(),
  whatsappTemplateName: text("whatsapp_template_name"),
  whatsappStatus: text("whatsapp_status", { enum: ["not_submitted", "pending", "approved", "rejected"] })
    .notNull()
    .default("not_submitted"),
  subjectEn: text("subject_en"),
  subjectYo: text("subject_yo"),
  bodyEn: text("body_en").notNull(),
  bodyYo: text("body_yo"),
  variables: text("variables").array().notNull().default([]),
  smsBodyEn: text("sms_body_en"),
  smsBodyYo: text("sms_body_yo"),
  allowBeforeConsent: boolean("allow_before_consent").notNull().default(false),
  ignoresQuietHours: boolean("ignores_quiet_hours").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(true),
  ...timestamps,
});

export const broadcast = pgTable("broadcast", {
  id: id(),
  title: text("title").notNull(),
  audience: jsonb("audience").notNull(),
  templateKey: text("template_key"),
  bodyEn: text("body_en"),
  bodyYo: text("body_yo"),
  channels: channel("channels").array().notNull(),
  status: text("status", { enum: ["draft", "scheduled", "sending", "sent", "cancelled"] })
    .notNull()
    .default("draft"),
  scheduledFor: tz("scheduled_for"),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => person.id),
  approvedBy: uuid("approved_by").references(() => person.id),
  ...timestamps,
});

export const message = pgTable(
  "message",
  {
    id: id(),
    direction: messageDirection("direction").notNull(),
    personId: uuid("person_id").references(() => person.id),
    toAddress: text("to_address").notNull(), // enc
    channel: channel("channel").notNull(),
    templateKey: text("template_key"),
    variables: jsonb("variables"),
    bodyRendered: text("body_rendered").notNull(), // enc
    status: messageStatus("status").notNull().default("queued"),
    providerId: text("provider_id"),
    error: text("error"),
    broadcastId: uuid("broadcast_id").references(() => broadcast.id),
    eventKey: text("event_key").unique(),
    costMinor: integer("cost_minor"),
    /** Not before this time: quiet hours (spec/08 §2) and retry backoff. Null means now. */
    sendAfter: tz("send_after"),
    /** Failed tries on the current channel (retries at 1, 5 and 30 minutes, then the next channel). */
    attempts: integer("attempts").notNull().default(0),
    sentAt: tz("sent_at"),
    deliveredAt: tz("delivered_at"),
    readAt: tz("read_at"),
    ...timestamps,
  },
  (t) => [index("message_person_created_idx").on(t.personId, t.createdAt.desc()), index("message_status_send_after_idx").on(t.status, t.sendAfter)],
);

export const channelOptOut = pgTable(
  "channel_opt_out",
  {
    id: id(),
    addressHash: text("address_hash").notNull(),
    channel: channel("channel").notNull(),
    optedOutAt: tz("opted_out_at").notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex("channel_opt_out_uq").on(t.addressHash, t.channel)],
);

/* ---------- Safeguarding, audit, privacy (spec/09) ---------- */

export const safeguardingCase = pgTable("safeguarding_case", {
  id: id(),
  reference: text("reference").notNull().unique(),
  reporterPersonId: uuid("reporter_person_id").references(() => person.id),
  reporterName: text("reporter_name"), // enc
  reporterContact: text("reporter_contact"), // enc
  reporterIsAnonymous: boolean("reporter_is_anonymous").notNull().default(false),
  subjectPersonId: uuid("subject_person_id").references(() => person.id),
  aboutPersonId: uuid("about_person_id").references(() => person.id),
  schoolId: uuid("school_id").references(() => school.id),
  cohortId: uuid("cohort_id").references(() => cohort.id),
  category: caseCategory("category").notNull(),
  severity: caseSeverity("severity").notNull(),
  description: text("description").notNull(), // enc
  immediateDanger: boolean("immediate_danger").notNull().default(false),
  status: caseStatus("status").notNull().default("new"),
  ownerId: uuid("owner_id").references(() => person.id),
  outcome: text("outcome"), // enc
  closedAt: tz("closed_at"),
  source: text("source", { enum: ["web_form", "in_app", "staff", "ai_flag", "whatsapp"] }).notNull(),
  ...timestamps,
});

export const caseNote = pgTable("case_note", {
  id: id(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => safeguardingCase.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => person.id),
  body: text("body").notNull(), // enc
  kind: text("kind", { enum: ["note", "action", "referral", "contact"] }).notNull(),
  ...timestamps,
});

export const auditEvent = pgTable(
  "audit_event",
  {
    id: id(),
    actorPersonId: uuid("actor_person_id").references(() => person.id),
    actorRole: role("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    subjectPersonId: uuid("subject_person_id"),
    meta: jsonb("meta").notNull().default({}),
    ip: inet("ip"),
    at: tz("at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_subject_idx").on(t.subjectPersonId, t.at.desc()),
    index("audit_actor_idx").on(t.actorPersonId, t.at.desc()),
  ],
);

export const dataRequest = pgTable("data_request", {
  id: id(),
  type: dataRequestType("type").notNull(),
  personId: uuid("person_id").references(() => person.id),
  requesterName: text("requester_name").notNull(), // enc
  requesterContact: text("requester_contact").notNull(), // enc
  relationship: text("relationship").notNull(),
  status: dataRequestStatus("status").notNull().default("received"),
  verifiedBy: uuid("verified_by").references(() => person.id),
  resultKey: text("result_key"),
  completedAt: tz("completed_at"),
  notes: text("notes"),
  ...timestamps,
});

/* ---------- Impact and reports (spec/10) ---------- */

export const impactSnapshot = pgTable(
  "impact_snapshot",
  {
    id: id(),
    date: date("date").notNull(),
    stateId: uuid("state_id").references(() => state.id),
    programmeId: uuid("programme_id").references(() => programme.id),
    metrics: jsonb("metrics").notNull(),
    ...timestamps,
  },
  (t) => [unique("impact_snapshot_uq").on(t.date, t.stateId, t.programmeId).nullsNotDistinct()],
);

export const historicalImpact = pgTable("historical_impact", {
  id: id(),
  year: integer("year").notNull(),
  programmeId: uuid("programme_id")
    .notNull()
    .references(() => programme.id),
  stateId: uuid("state_id")
    .notNull()
    .references(() => state.id),
  students: integer("students").notNull(),
  girls: integer("girls"),
  schools: integer("schools").notNull(),
  volunteers: integer("volunteers").notNull().default(0),
  sourceNote: text("source_note").notNull(),
  ...timestamps,
});

export const report = pgTable("report", {
  id: id(),
  title: text("title").notNull(),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  programmeIds: uuid("programme_ids").array().notNull().default([]),
  stateIds: uuid("state_ids").array().notNull().default([]),
  sections: text("sections").array().notNull().default([]),
  data: jsonb("data"),
  narrative: jsonb("narrative"),
  narrativeStatus: text("narrative_status", { enum: ["none", "drafting", "draft", "edited"] })
    .notNull()
    .default("none"),
  pdfKey: text("pdf_key"),
  csvKey: text("csv_key"),
  status: text("status", { enum: ["generating", "ready", "failed"] })
    .notNull()
    .default("generating"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => person.id),
  grantId: uuid("grant_id"),
  ...timestamps,
});

export const reportShare = pgTable("report_share", {
  id: id(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => report.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: tz("expires_at").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => person.id),
  viewCount: integer("view_count").notNull().default(0),
  ...timestamps,
});

/* ---------- Donations (spec/11) ---------- */

export const supporter = pgTable("supporter", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(), // enc
  emailHash: text("email_hash").notNull().unique(),
  phone: text("phone"), // enc
  country: text("country"),
  isOrganisation: boolean("is_organisation").notNull().default(false),
  wantsUpdates: boolean("wants_updates").notNull().default(false),
  notes: text("notes"),
  ...timestamps,
});

export const donation = pgTable("donation", {
  id: id(),
  supporterId: uuid("supporter_id")
    .notNull()
    .references(() => supporter.id),
  reference: text("reference").notNull().unique(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency", { enum: ["NGN", "USD"] }).notNull(),
  frequency: donationFrequency("frequency").notNull(),
  designationProgrammeId: uuid("designation_programme_id").references(() => programme.id),
  status: donationStatus("status").notNull().default("initiated"),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference"),
  providerFeeMinor: integer("provider_fee_minor"),
  paidAt: tz("paid_at"),
  receiptCode: text("receipt_code").unique(),
  receiptKey: text("receipt_key"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  message: text("message"),
  sourceCampaignId: uuid("source_campaign_id").references(() => campaign.id),
  subscriptionCode: text("subscription_code"),
  ...timestamps,
});

export const grant = pgTable("grant", {
  id: id(),
  funderPartnerId: uuid("funder_partner_id")
    .notNull()
    .references(() => partner.id),
  title: text("title").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  reportingDue: date("reporting_due").array().notNull().default([]),
  programmeIds: uuid("programme_ids").array().notNull().default([]),
  notes: text("notes"),
  ...timestamps,
});

/* ---------- AI speech coach (spec/12, P2) ---------- */

export const motion = pgTable("motion", {
  id: id(),
  textEn: text("text_en").notNull(),
  textYo: text("text_yo"),
  programmeId: uuid("programme_id").references(() => programme.id),
  difficulty: text("difficulty", { enum: ["starter", "intermediate", "advanced"] })
    .notNull()
    .default("starter"),
  sdg: integer("sdg"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const speechAttempt = pgTable(
  "speech_attempt",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    cohortId: uuid("cohort_id").references(() => cohort.id),
    motionId: uuid("motion_id").references(() => motion.id),
    side: text("side", { enum: ["for", "against", "open"] }).notNull(),
    channel: text("channel", { enum: ["web", "whatsapp"] }).notNull(),
    /** placement: the first "let's hear you" speech; lesson: a drill inside a lesson; free: open practice. */
    kind: text("kind", { enum: ["placement", "lesson", "free"] }).notNull().default("free"),
    lessonKey: text("lesson_key"),
    audioKey: text("audio_key"),
    durationSeconds: numeric("duration_seconds"),
    transcript: text("transcript"), // enc
    words: jsonb("words"),
    metrics: jsonb("metrics"),
    scores: jsonb("scores"),
    feedback: jsonb("feedback"),
    overallStars: integer("overall_stars"),
    status: speechStatus("status").notNull().default("uploaded"),
    rejectReason: text("reject_reason"),
    modelId: text("model_id"),
    promptVersion: text("prompt_version"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    flaggedForSafeguarding: boolean("flagged_for_safeguarding").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("speech_person_created_idx").on(t.personId, t.createdAt.desc())],
);

/** How strong each student is at each coaching skill (1.0–5.0), updated after every scored speech. */
export const coachSkill = pgTable(
  "coach_skill",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    skillKey: text("skill_key").notNull(),
    rating: numeric("rating", { precision: 3, scale: 2 }).notNull(),
    assessments: integer("assessments").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("coach_skill_uq").on(t.personId, t.skillKey)],
);

/** A student's progress through each lesson of the coaching path. */
export const coachLesson = pgTable(
  "coach_lesson",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id),
    lessonKey: text("lesson_key").notNull(),
    status: text("status", { enum: ["started", "passed"] }).notNull().default("started"),
    attempts: integer("attempts").notNull().default(0),
    bestScore: integer("best_score"),
    passedAt: tz("passed_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("coach_lesson_uq").on(t.personId, t.lessonKey)],
);

export const botState = pgTable("bot_state", {
  id: id(),
  personId: uuid("person_id")
    .notNull()
    .unique()
    .references(() => person.id),
  motionId: uuid("motion_id").references(() => motion.id),
  expiresAt: tz("expires_at").notNull(),
  ...timestamps,
});

/* ---------- System ---------- */

export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => person.id),
  ...timestamps,
});

export const job = pgTable("job", {
  id: id(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  status: jobStatus("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  dedupeKey: text("dedupe_key").unique(),
  runAfter: tz("run_after"),
  lastError: text("last_error"),
  finishedAt: tz("finished_at"),
  ...timestamps,
});

export const task = pgTable("task", {
  id: id(),
  title: text("title").notNull(),
  detail: text("detail"),
  kind: text("kind", {
    enum: [
      "reference_check",
      "consent_stalled",
      "waitlist_ready",
      "no_attendance",
      "hours_approval",
      "case_follow_up",
      "template_rejected",
      "intake_review",
      "manual",
    ],
  }).notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  assigneeId: uuid("assignee_id").references(() => person.id),
  stateId: uuid("state_id").references(() => state.id),
  dueOn: date("due_on"),
  status: taskStatus("status").notNull().default("open"),
  dedupeKey: text("dedupe_key").unique(),
  ...timestamps,
});

export const rateLimit = pgTable(
  "rate_limit",
  {
    key: text("key").notNull(),
    windowStart: tz("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const importBatch = pgTable("import_batch", {
  id: id(),
  kind: text("kind", { enum: ["people", "schools", "historical"] }).notNull(),
  fileKey: text("file_key").notNull(),
  status: text("status").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  okCount: integer("ok_count").notNull().default(0),
  errorRows: jsonb("error_rows").notNull().default([]),
  createdBy: uuid("created_by").references(() => person.id),
  ...timestamps,
});
