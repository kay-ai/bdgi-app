import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { id, timestamps, tz } from "./_shared";
import { contentStatus } from "./enums";
import { person } from "./people";
import { programme } from "./programmes";

export const contentPage = pgTable("content_page", {
  id: id(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleYo: text("title_yo"),
  seoDescriptionEn: text("seo_description_en"),
  seoDescriptionYo: text("seo_description_yo"),
  ogImageKey: text("og_image_key"),
  blocks: jsonb("blocks").notNull().default([]),
  status: contentStatus("status").notNull().default("draft"),
  publishedAt: tz("published_at"),
  updatedBy: uuid("updated_by").references((): AnyPgColumn => person.id),
  deletedAt: tz("deleted_at"),
  ...timestamps,
});

export const contentVersion = pgTable("content_version", {
  id: id(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => contentPage.id),
  blocks: jsonb("blocks").notNull(),
  savedBy: uuid("saved_by").references((): AnyPgColumn => person.id),
  savedAt: tz("saved_at").notNull().defaultNow(),
  ...timestamps,
});

export const story = pgTable("story", {
  id: id(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleYo: text("title_yo"),
  excerptEn: text("excerpt_en").notNull(),
  excerptYo: text("excerpt_yo"),
  bodyEn: jsonb("body_en").notNull(),
  bodyYo: jsonb("body_yo"),
  coverKey: text("cover_key"),
  coverAlt: text("cover_alt"),
  authorPersonId: uuid("author_person_id").references((): AnyPgColumn => person.id),
  authorName: text("author_name"),
  programmeId: uuid("programme_id").references((): AnyPgColumn => programme.id),
  tags: text("tags").array().notNull().default([]),
  status: contentStatus("status").notNull().default("draft"),
  publishedAt: tz("published_at"),
  featuresChild: boolean("features_child").notNull().default(false),
  consentConfirmedBy: uuid("consent_confirmed_by").references((): AnyPgColumn => person.id),
  deletedAt: tz("deleted_at"),
  ...timestamps,
});

export const event = pgTable("event", {
  id: id(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleYo: text("title_yo"),
  summaryEn: text("summary_en").notNull(),
  bodyEn: jsonb("body_en").notNull().default([]),
  startsAt: tz("starts_at").notNull(),
  endsAt: tz("ends_at"),
  venue: text("venue"),
  isOnline: boolean("is_online").notNull().default(false),
  onlineUrl: text("online_url"),
  coverKey: text("cover_key"),
  programmeId: uuid("programme_id").references((): AnyPgColumn => programme.id),
  registration: text("registration", { enum: ["none", "external_link", "hub_form"] })
    .notNull()
    .default("none"),
  registrationUrl: text("registration_url"),
  capacity: integer("capacity"),
  competitionId: uuid("competition_id"),
  status: contentStatus("status").notNull().default("draft"),
  deletedAt: tz("deleted_at"),
  ...timestamps,
});

export const eventRegistration = pgTable("event_registration", {
  id: id(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => event.id),
  name: text("name").notNull(),
  phone: text("phone"), // enc
  email: text("email"), // enc
  organisation: text("organisation"),
  personId: uuid("person_id").references((): AnyPgColumn => person.id),
  sourceCampaignId: uuid("source_campaign_id").references((): AnyPgColumn => campaign.id),
  ...timestamps,
});

export const teamMember = pgTable("team_member", {
  id: id(),
  personId: uuid("person_id").references((): AnyPgColumn => person.id),
  name: text("name").notNull(),
  titleEn: text("title_en").notNull(),
  titleYo: text("title_yo"),
  bioEn: text("bio_en"),
  photoKey: text("photo_key"),
  group: text("group", { enum: ["leadership", "staff", "board", "advisor"] }).notNull(),
  sort: integer("sort").notNull().default(0),
  linkedinUrl: text("linkedin_url"),
  isVisible: boolean("is_visible").notNull().default(true),
  ...timestamps,
});

export const partner = pgTable("partner", {
  id: id(),
  name: text("name").notNull(),
  logoKey: text("logo_key"),
  url: text("url"),
  kind: text("kind", { enum: ["funder", "corporate", "government", "community", "media"] }).notNull(),
  sort: integer("sort").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(false),
  ...timestamps,
});

export const galleryAlbum = pgTable("gallery_album", {
  id: id(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  date: date("date"),
  programmeId: uuid("programme_id").references((): AnyPgColumn => programme.id),
  coverKey: text("cover_key"),
  status: contentStatus("status").notNull().default("draft"),
  ...timestamps,
});

export const galleryPhoto = pgTable("gallery_photo", {
  id: id(),
  albumId: uuid("album_id")
    .notNull()
    .references(() => galleryAlbum.id),
  key: text("key").notNull(),
  altEn: text("alt_en").notNull(),
  captionEn: text("caption_en"),
  sort: integer("sort").notNull().default(0),
  consentNote: text("consent_note").notNull(),
  ...timestamps,
});

export const faq = pgTable("faq", {
  id: id(),
  questionEn: text("question_en").notNull(),
  questionYo: text("question_yo"),
  answerEn: jsonb("answer_en").notNull(),
  answerYo: jsonb("answer_yo"),
  audience: text("audience", { enum: ["general", "students", "guardians", "volunteers", "schools", "donors"] }).notNull(),
  sort: integer("sort").notNull().default(0),
  status: contentStatus("status").notNull().default("published"),
  ...timestamps,
});

export const pressItem = pgTable("press_item", {
  id: id(),
  title: text("title").notNull(),
  outlet: text("outlet").notNull(),
  url: text("url").notNull(),
  publishedOn: date("published_on").notNull(),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const download = pgTable("download", {
  id: id(),
  titleEn: text("title_en").notNull(),
  fileKey: text("file_key").notNull(),
  kind: text("kind", { enum: ["annual_report", "impact_report", "media_kit", "policy", "other"] }).notNull(),
  year: integer("year"),
  isPublic: boolean("is_public").notNull().default(true),
  ...timestamps,
});

export const contactMessage = pgTable("contact_message", {
  id: id(),
  name: text("name").notNull(),
  email: text("email"), // enc
  phone: text("phone"), // enc
  topic: text("topic", { enum: ["general", "partnership", "media", "volunteering", "school", "other"] }).notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["new", "replied", "closed"] })
    .notNull()
    .default("new"),
  handledBy: uuid("handled_by").references((): AnyPgColumn => person.id),
  ...timestamps,
});

export const newsletterSubscriber = pgTable("newsletter_subscriber", {
  id: id(),
  email: text("email").notNull(), // enc
  emailHash: text("email_hash").notNull().unique(),
  name: text("name"),
  confirmedAt: tz("confirmed_at"),
  unsubscribedAt: tz("unsubscribed_at"),
  confirmTokenHash: text("confirm_token_hash").notNull(),
  ...timestamps,
});

export const redirect = pgTable("redirect", {
  id: id(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  statusCode: integer("status_code").notNull().default(301),
  ...timestamps,
});

export const campaign = pgTable("campaign", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  medium: text("medium", {
    enum: ["instagram", "linkedin", "whatsapp", "webinar", "event", "school_visit", "qr", "other"],
  }).notNull(),
  target: text("target", { enum: ["student", "volunteer", "school", "donate", "any"] }).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references((): AnyPgColumn => person.id),
  clicks: integer("clicks").notNull().default(0),
  ...timestamps,
});

export const mediaAsset = pgTable("media_asset", {
  id: id(),
  key: text("key").notNull().unique(),
  bucket: text("bucket").notNull(),
  mime: text("mime").notNull(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes").notNull(),
  altEn: text("alt_en"),
  uploadedBy: uuid("uploaded_by").references((): AnyPgColumn => person.id),
  processed: boolean("processed").notNull().default(false),
  ...timestamps,
});

export const pageView = pgTable(
  "page_view",
  {
    id: id(),
    path: text("path").notNull(),
    date: date("date").notNull(),
    referrerHost: text("referrer_host"),
    campaignCode: text("campaign_code"),
    count: integer("count").notNull().default(0),
    ...timestamps,
  },
  (t) => [unique("page_view_uq").on(t.path, t.date, t.referrerHost, t.campaignCode).nullsNotDistinct()],
);
