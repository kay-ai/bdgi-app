import { boolean, date, index, integer, numeric, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { id, timestamps, tz } from "./_shared";
import { partnershipStatus, schoolLevel, schoolOwnership } from "./enums";
import { person } from "./people";
import { campaign } from "./content";
import { programme } from "./programmes";

export const state = pgTable("state", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  launchedOn: date("launched_on"),
  ...timestamps,
});

export const lga = pgTable(
  "lga",
  {
    id: id(),
    stateId: uuid("state_id")
      .notNull()
      .references(() => state.id),
    name: text("name").notNull(),
    geoCode: text("geo_code").notNull().unique(),
    pupilsPerTeacher: numeric("pupils_per_teacher"),
    publicSchools: integer("public_schools"),
    teachers: integer("teachers"),
    girlsEnrolled: integer("girls_enrolled"),
    outOfSchoolRateGirls: numeric("out_of_school_rate_girls"),
    indicatorsYear: text("indicators_year"),
    indicatorsUpdatedAt: tz("indicators_updated_at"),
    ...timestamps,
  },
  (t) => [index("lga_state_idx").on(t.stateId)],
);

export const school = pgTable(
  "school",
  {
    id: id(),
    edutrackaId: text("edutracka_id").unique(),
    name: text("name").notNull(),
    stateId: uuid("state_id")
      .notNull()
      .references(() => state.id),
    lgaId: uuid("lga_id")
      .notNull()
      .references(() => lga.id),
    town: text("town"),
    ownership: schoolOwnership("ownership").notNull().default("public"),
    level: schoolLevel("level").notNull().default("combined_secondary"),
    enrolmentGirls: integer("enrolment_girls"),
    enrolmentBoys: integer("enrolment_boys"),
    partnershipStatus: partnershipStatus("partnership_status").notNull().default("none"),
    championId: uuid("champion_id").references((): AnyPgColumn => person.id),
    principalName: text("principal_name"),
    contactPhone: text("contact_phone"), // enc
    address: text("address"),
    notes: text("notes"),
    isVerified: boolean("is_verified").notNull().default(true),
    deletedAt: tz("deleted_at"),
    ...timestamps,
  },
  (t) => [index("school_state_lga_idx").on(t.stateId, t.lgaId), index("school_name_idx").on(t.name)],
);

export const schoolAgreement = pgTable("school_agreement", {
  id: id(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => school.id),
  signedByName: text("signed_by_name").notNull(),
  signedByTitle: text("signed_by_title").notNull(),
  signedOn: date("signed_on").notNull(),
  validUntil: date("valid_until"),
  documentKey: text("document_key").notNull(),
  coversConsent: boolean("covers_consent").notNull().default(false),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references((): AnyPgColumn => person.id),
  ...timestamps,
});

export const schoolRequest = pgTable("school_request", {
  id: id(),
  schoolId: uuid("school_id").references(() => school.id),
  schoolNameOther: text("school_name_other"),
  stateId: uuid("state_id")
    .notNull()
    .references(() => state.id),
  lgaId: uuid("lga_id").references(() => lga.id),
  requesterName: text("requester_name").notNull(),
  requesterRole: text("requester_role").notNull(),
  requesterPhone: text("requester_phone").notNull(), // enc
  requesterEmail: text("requester_email"), // enc
  programmeId: uuid("programme_id").references((): AnyPgColumn => programme.id),
  approxStudents: integer("approx_students"),
  preferredTerm: text("preferred_term"),
  message: text("message"),
  status: text("status", { enum: ["new", "contacted", "accepted", "declined"] })
    .notNull()
    .default("new"),
  handledBy: uuid("handled_by").references((): AnyPgColumn => person.id),
  sourceCampaignId: uuid("source_campaign_id").references((): AnyPgColumn => campaign.id),
  ...timestamps,
});
