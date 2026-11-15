CREATE TYPE "public"."assessment_type" AS ENUM('baseline', 'endline', 'follow_up_6m', 'follow_up_12m');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'excused');--> statement-breakpoint
CREATE TYPE "public"."case_category" AS ENUM('physical', 'emotional', 'sexual', 'neglect', 'online', 'bullying', 'volunteer_conduct', 'data_privacy', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_severity" AS ENUM('low', 'medium', 'high', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('new', 'in_review', 'action_taken', 'referred', 'closed');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('whatsapp', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."class_level" AS ENUM('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3', 'not_in_school');--> statement-breakpoint
CREATE TYPE "public"."cohort_role" AS ENUM('student', 'lead_coach', 'assistant_coach');--> statement-breakpoint
CREATE TYPE "public"."cohort_status" AS ENUM('draft', 'open', 'running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."consent_method" AS ENUM('guardian_otp', 'school_agreement', 'self_adult', 'paper_uploaded');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('participation', 'photo', 'ai_practice', 'stories');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."data_request_status" AS ENUM('received', 'verified', 'in_progress', 'done', 'refused');--> statement-breakpoint
CREATE TYPE "public"."data_request_type" AS ENUM('export', 'erase', 'correct');--> statement-breakpoint
CREATE TYPE "public"."donation_frequency" AS ENUM('one_off', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('initiated', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('female', 'male', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'yo', 'pcm');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."partnership_status" AS ENUM('none', 'requested', 'in_discussion', 'agreement_signed', 'active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('pending_consent', 'pending_review', 'active', 'waitlisted', 'paused', 'declined', 'left', 'anonymised');--> statement-breakpoint
CREATE TYPE "public"."programme_kind" AS ENUM('debate', 'stem', 'education_access', 'advocacy', 'campaign', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'guardian', 'volunteer', 'school_champion', 'state_lead', 'programme_manager', 'safeguarding_lead', 'content_editor', 'admin', 'ekodara_officer');--> statement-breakpoint
CREATE TYPE "public"."school_level" AS ENUM('primary', 'junior_secondary', 'senior_secondary', 'combined_secondary', 'technical');--> statement-breakpoint
CREATE TYPE "public"."school_ownership" AS ENUM('public', 'private', 'mission', 'other');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('planned', 'held', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."speech_status" AS ENUM('uploaded', 'transcribing', 'scoring', 'done', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."volunteer_stage" AS ENUM('applied', 'references_pending', 'interview', 'training', 'active', 'paused', 'declined', 'left');--> statement-breakpoint
CREATE TABLE "consent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid,
	"type" "consent_type" NOT NULL,
	"method" "consent_method" NOT NULL,
	"token_hash" text,
	"code_hash" text,
	"code_attempts" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"given_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"guardian_full_name" text,
	"ip" "inet",
	"user_agent" text,
	"school_agreement_id" uuid,
	"document_key" text,
	"text_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "guardian_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guardian_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"relationship" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_response" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"dream_career" text NOT NULL,
	"interests" text[] NOT NULL,
	"community_dream" text,
	"needs" text[] NOT NULL,
	"needs_other" text,
	"school_subject" text,
	"programme_ids" uuid[] NOT NULL,
	"has_own_phone" boolean NOT NULL,
	"device_access" text NOT NULL,
	"anything_else" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_response_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text,
	"first_name" text NOT NULL,
	"surname" text NOT NULL,
	"preferred_name" text,
	"date_of_birth" text,
	"age_at_signup" integer,
	"gender" "gender" NOT NULL,
	"phone" text,
	"phone_hash" text,
	"email" text,
	"email_hash" text,
	"language" "language" DEFAULT 'en' NOT NULL,
	"preferred_channel" "channel" DEFAULT 'whatsapp' NOT NULL,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"state_id" uuid,
	"lga_id" uuid,
	"school_id" uuid,
	"school_other" text,
	"class_level" "class_level",
	"avatar_key" text DEFAULT 'a01' NOT NULL,
	"status" "person_status" NOT NULL,
	"source_campaign_id" uuid,
	"notes" text,
	"anonymised_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_role" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"state_id" uuid,
	"granted_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lga" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state_id" uuid NOT NULL,
	"name" text NOT NULL,
	"geo_code" text NOT NULL,
	"pupils_per_teacher" numeric,
	"public_schools" integer,
	"teachers" integer,
	"girls_enrolled" integer,
	"out_of_school_rate_girls" numeric,
	"indicators_year" text,
	"indicators_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lga_geo_code_unique" UNIQUE("geo_code")
);
--> statement-breakpoint
CREATE TABLE "school" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edutracka_id" text,
	"name" text NOT NULL,
	"state_id" uuid NOT NULL,
	"lga_id" uuid NOT NULL,
	"town" text,
	"ownership" "school_ownership" DEFAULT 'public' NOT NULL,
	"level" "school_level" DEFAULT 'combined_secondary' NOT NULL,
	"enrolment_girls" integer,
	"enrolment_boys" integer,
	"partnership_status" "partnership_status" DEFAULT 'none' NOT NULL,
	"champion_id" uuid,
	"principal_name" text,
	"contact_phone" text,
	"address" text,
	"notes" text,
	"is_verified" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_edutracka_id_unique" UNIQUE("edutracka_id")
);
--> statement-breakpoint
CREATE TABLE "school_agreement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"signed_by_name" text NOT NULL,
	"signed_by_title" text NOT NULL,
	"signed_on" date NOT NULL,
	"valid_until" date,
	"document_key" text NOT NULL,
	"covers_consent" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid,
	"school_name_other" text,
	"state_id" uuid NOT NULL,
	"lga_id" uuid,
	"requester_name" text NOT NULL,
	"requester_role" text NOT NULL,
	"requester_phone" text NOT NULL,
	"requester_email" text,
	"programme_id" uuid,
	"approx_students" integer,
	"preferred_term" text,
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"handled_by" uuid,
	"source_campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"launched_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "state_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "assessment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"cohort_id" uuid,
	"type" "assessment_type" NOT NULL,
	"self_answers" jsonb,
	"self_score" numeric,
	"rubric_id" uuid,
	"rubric_scores" jsonb,
	"rubric_total" numeric,
	"scored_by" uuid,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_uq" UNIQUE NULLS NOT DISTINCT("person_id","cohort_id","type")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "certificate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pdf_key" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cohort" (
	"id" uuid PRIMARY KEY NOT NULL,
	"programme_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"term" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"meeting_day" smallint,
	"meeting_time" time,
	"venue" text,
	"capacity" integer DEFAULT 30 NOT NULL,
	"status" "cohort_status" DEFAULT 'draft' NOT NULL,
	"ai_coach_enabled" boolean DEFAULT false NOT NULL,
	"is_pilot_group" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cohort_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "cohort_role" NOT NULL,
	"joined_on" date NOT NULL,
	"left_on" date,
	"left_reason" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hours_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"session_id" uuid,
	"date" date NOT NULL,
	"hours" numeric(4, 2) NOT NULL,
	"description" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_plan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"programme_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title_en" text NOT NULL,
	"title_yo" text,
	"objectives" text DEFAULT '' NOT NULL,
	"coach_notes" jsonb,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programme" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" "programme_kind" NOT NULL,
	"name_en" text NOT NULL,
	"name_yo" text,
	"summary_en" text NOT NULL,
	"summary_yo" text,
	"is_enrolling" boolean DEFAULT false NOT NULL,
	"min_age" integer DEFAULT 10 NOT NULL,
	"max_age" integer DEFAULT 18 NOT NULL,
	"default_sessions" integer DEFAULT 8 NOT NULL,
	"rubric_id" uuid,
	"page_id" uuid,
	"accepts_designated_gifts" boolean DEFAULT false NOT NULL,
	"fundraising_target_minor" integer,
	"fundraising_currency" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programme_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rubric" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"criteria" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cohort_id" uuid NOT NULL,
	"lesson_plan_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"venue" text,
	"status" "session_status" DEFAULT 'planned' NOT NULL,
	"cancel_reason" text,
	"notes" text,
	"held_marked_by" uuid,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_coach" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_attempt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_module" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_yo" text,
	"body" jsonb NOT NULL,
	"position" integer NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"kind" text NOT NULL,
	"pass_mark" integer DEFAULT 80 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_module_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "training_question" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"prompt_en" text NOT NULL,
	"prompt_yo" text,
	"options" jsonb NOT NULL,
	"correct_key" text NOT NULL,
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"stage" "volunteer_stage" DEFAULT 'applied' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" "language"[] DEFAULT '{}'::language[] NOT NULL,
	"occupation" text,
	"organisation" text,
	"is_nysc" boolean DEFAULT false NOT NULL,
	"is_alumna" boolean DEFAULT false NOT NULL,
	"availability" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_cohorts" integer DEFAULT 1 NOT NULL,
	"motivation" text NOT NULL,
	"experience" text,
	"can_travel_lgas" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"id_document_key" text,
	"interview_notes" text,
	"interviewed_by" uuid,
	"code_of_conduct_signed_at" timestamp with time zone,
	"code_of_conduct_version" text,
	"training_completed_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"paused_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_profile_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "volunteer_reference" (
	"id" uuid PRIMARY KEY NOT NULL,
	"volunteer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"checked_by" uuid,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"medium" text NOT NULL,
	"target" text NOT NULL,
	"notes" text,
	"created_by" uuid,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contact_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_page" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_yo" text,
	"seo_description_en" text,
	"seo_description_yo" text,
	"og_image_key" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_page_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"blocks" jsonb NOT NULL,
	"saved_by" uuid,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title_en" text NOT NULL,
	"file_key" text NOT NULL,
	"kind" text NOT NULL,
	"year" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_yo" text,
	"summary_en" text NOT NULL,
	"body_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"venue" text,
	"is_online" boolean DEFAULT false NOT NULL,
	"online_url" text,
	"cover_key" text,
	"programme_id" uuid,
	"registration" text DEFAULT 'none' NOT NULL,
	"registration_url" text,
	"capacity" integer,
	"competition_id" uuid,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_registration" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"organisation" text,
	"person_id" uuid,
	"source_campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_en" text NOT NULL,
	"question_yo" text,
	"answer_en" jsonb NOT NULL,
	"answer_yo" jsonb,
	"audience" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_album" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"date" date,
	"programme_id" uuid,
	"cover_key" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_album_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gallery_photo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"album_id" uuid NOT NULL,
	"key" text NOT NULL,
	"alt_en" text NOT NULL,
	"caption_en" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"consent_note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"bucket" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer NOT NULL,
	"alt_en" text,
	"uploaded_by" uuid,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_asset_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriber" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"name" text,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"confirm_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscriber_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
CREATE TABLE "page_view" (
	"id" uuid PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"date" date NOT NULL,
	"referrer_host" text,
	"campaign_code" text,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_view_uq" UNIQUE NULLS NOT DISTINCT("path","date","referrer_host","campaign_code")
);
--> statement-breakpoint
CREATE TABLE "partner" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_key" text,
	"url" text,
	"kind" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "press_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"outlet" text NOT NULL,
	"url" text NOT NULL,
	"published_on" date NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirect" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirect_from_path_unique" UNIQUE("from_path")
);
--> statement-breakpoint
CREATE TABLE "story" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_yo" text,
	"excerpt_en" text NOT NULL,
	"excerpt_yo" text,
	"body_en" jsonb NOT NULL,
	"body_yo" jsonb,
	"cover_key" text,
	"cover_alt" text,
	"author_person_id" uuid,
	"author_name" text,
	"programme_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"features_child" boolean DEFAULT false NOT NULL,
	"consent_confirmed_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid,
	"name" text NOT NULL,
	"title_en" text NOT NULL,
	"title_yo" text,
	"bio_en" text,
	"photo_key" text,
	"group" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"linkedin_url" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_person_id" uuid,
	"actor_role" "role",
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"subject_person_id" uuid,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" "inet",
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_state" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"motion_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_state_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "broadcast" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"audience" jsonb NOT NULL,
	"template_key" text,
	"body_en" text,
	"body_yo" text,
	"channels" "channel"[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_note" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_opt_out" (
	"id" uuid PRIMARY KEY NOT NULL,
	"address_hash" text NOT NULL,
	"channel" "channel" NOT NULL,
	"opted_out_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "data_request_type" NOT NULL,
	"person_id" uuid,
	"requester_name" text NOT NULL,
	"requester_contact" text NOT NULL,
	"relationship" text NOT NULL,
	"status" "data_request_status" DEFAULT 'received' NOT NULL,
	"verified_by" uuid,
	"result_key" text,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supporter_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"frequency" "donation_frequency" NOT NULL,
	"designation_programme_id" uuid,
	"status" "donation_status" DEFAULT 'initiated' NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"provider_fee_minor" integer,
	"paid_at" timestamp with time zone,
	"receipt_code" text,
	"receipt_key" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"message" text,
	"source_campaign_id" uuid,
	"subscription_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donation_reference_unique" UNIQUE("reference"),
	CONSTRAINT "donation_receipt_code_unique" UNIQUE("receipt_code")
);
--> statement-breakpoint
CREATE TABLE "grant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"funder_partner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reporting_due" date[] DEFAULT '{}' NOT NULL,
	"programme_ids" uuid[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_impact" (
	"id" uuid PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"programme_id" uuid NOT NULL,
	"state_id" uuid NOT NULL,
	"students" integer NOT NULL,
	"girls" integer,
	"schools" integer NOT NULL,
	"volunteers" integer DEFAULT 0 NOT NULL,
	"source_note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_snapshot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"state_id" uuid,
	"programme_id" uuid,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "impact_snapshot_uq" UNIQUE NULLS NOT DISTINCT("date","state_id","programme_id")
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"file_key" text NOT NULL,
	"status" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"ok_count" integer DEFAULT 0 NOT NULL,
	"error_rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"dedupe_key" text,
	"run_after" timestamp with time zone,
	"last_error" text,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"direction" "message_direction" NOT NULL,
	"person_id" uuid,
	"to_address" text NOT NULL,
	"channel" "channel" NOT NULL,
	"template_key" text,
	"variables" jsonb,
	"body_rendered" text NOT NULL,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"error" text,
	"broadcast_id" uuid,
	"event_key" text,
	"cost_minor" integer,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "message_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"category" text NOT NULL,
	"channels" "channel"[] NOT NULL,
	"whatsapp_template_name" text,
	"whatsapp_status" text DEFAULT 'not_submitted' NOT NULL,
	"subject_en" text,
	"subject_yo" text,
	"body_en" text NOT NULL,
	"body_yo" text,
	"variables" text[] DEFAULT '{}' NOT NULL,
	"sms_body_en" text,
	"sms_body_yo" text,
	"allow_before_consent" boolean DEFAULT false NOT NULL,
	"ignores_quiet_hours" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_template_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "motion" (
	"id" uuid PRIMARY KEY NOT NULL,
	"text_en" text NOT NULL,
	"text_yo" text,
	"programme_id" uuid,
	"difficulty" text DEFAULT 'starter' NOT NULL,
	"sdg" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"programme_ids" uuid[] DEFAULT '{}' NOT NULL,
	"state_ids" uuid[] DEFAULT '{}' NOT NULL,
	"sections" text[] DEFAULT '{}' NOT NULL,
	"data" jsonb,
	"narrative" jsonb,
	"narrative_status" text DEFAULT 'none' NOT NULL,
	"pdf_key" text,
	"csv_key" text,
	"status" text DEFAULT 'generating' NOT NULL,
	"created_by" uuid NOT NULL,
	"grant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_share" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_share_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "safeguarding_case" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"reporter_person_id" uuid,
	"reporter_name" text,
	"reporter_contact" text,
	"reporter_is_anonymous" boolean DEFAULT false NOT NULL,
	"subject_person_id" uuid,
	"about_person_id" uuid,
	"school_id" uuid,
	"cohort_id" uuid,
	"category" "case_category" NOT NULL,
	"severity" "case_severity" NOT NULL,
	"description" text NOT NULL,
	"immediate_danger" boolean DEFAULT false NOT NULL,
	"status" "case_status" DEFAULT 'new' NOT NULL,
	"owner_id" uuid,
	"outcome" text,
	"closed_at" timestamp with time zone,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safeguarding_case_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speech_attempt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"cohort_id" uuid,
	"motion_id" uuid,
	"side" text NOT NULL,
	"channel" text NOT NULL,
	"audio_key" text,
	"duration_seconds" numeric,
	"transcript" text,
	"words" jsonb,
	"metrics" jsonb,
	"scores" jsonb,
	"feedback" jsonb,
	"overall_stars" integer,
	"status" "speech_status" DEFAULT 'uploaded' NOT NULL,
	"reject_reason" text,
	"model_id" text,
	"prompt_version" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"flagged_for_safeguarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supporter" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"phone" text,
	"country" text,
	"is_organisation" boolean DEFAULT false NOT NULL,
	"wants_updates" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supporter_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"kind" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"assignee_id" uuid,
	"state_id" uuid,
	"due_on" date,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_student_id_person_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_guardian_id_person_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_school_agreement_id_school_agreement_id_fk" FOREIGN KEY ("school_agreement_id") REFERENCES "public"."school_agreement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_guardian_id_person_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_student_id_person_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_response" ADD CONSTRAINT "intake_response_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_lga_id_lga_id_fk" FOREIGN KEY ("lga_id") REFERENCES "public"."lga"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_source_campaign_id_campaign_id_fk" FOREIGN KEY ("source_campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_granted_by_person_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lga" ADD CONSTRAINT "lga_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_lga_id_lga_id_fk" FOREIGN KEY ("lga_id") REFERENCES "public"."lga"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_champion_id_person_id_fk" FOREIGN KEY ("champion_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_agreement" ADD CONSTRAINT "school_agreement_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_agreement" ADD CONSTRAINT "school_agreement_uploaded_by_person_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_request" ADD CONSTRAINT "school_request_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_request" ADD CONSTRAINT "school_request_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_request" ADD CONSTRAINT "school_request_lga_id_lga_id_fk" FOREIGN KEY ("lga_id") REFERENCES "public"."lga"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_request" ADD CONSTRAINT "school_request_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_request" ADD CONSTRAINT "school_request_handled_by_person_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_request" ADD CONSTRAINT "school_request_source_campaign_id_campaign_id_fk" FOREIGN KEY ("source_campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_rubric_id_rubric_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubric"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_scored_by_person_id_fk" FOREIGN KEY ("scored_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_person_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_member" ADD CONSTRAINT "cohort_member_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_member" ADD CONSTRAINT "cohort_member_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hours_entry" ADD CONSTRAINT "hours_entry_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hours_entry" ADD CONSTRAINT "hours_entry_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hours_entry" ADD CONSTRAINT "hours_entry_approved_by_person_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plan" ADD CONSTRAINT "lesson_plan_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_rubric_id_rubric_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubric"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_page_id_content_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."content_page"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_lesson_plan_id_lesson_plan_id_fk" FOREIGN KEY ("lesson_plan_id") REFERENCES "public"."lesson_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_held_marked_by_person_id_fk" FOREIGN KEY ("held_marked_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_coach" ADD CONSTRAINT "session_coach_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_coach" ADD CONSTRAINT "session_coach_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempt" ADD CONSTRAINT "training_attempt_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempt" ADD CONSTRAINT "training_attempt_module_id_training_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_module"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_question" ADD CONSTRAINT "training_question_module_id_training_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_module"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_profile" ADD CONSTRAINT "volunteer_profile_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_profile" ADD CONSTRAINT "volunteer_profile_interviewed_by_person_id_fk" FOREIGN KEY ("interviewed_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_reference" ADD CONSTRAINT "volunteer_reference_volunteer_id_person_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_reference" ADD CONSTRAINT "volunteer_reference_checked_by_person_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_message" ADD CONSTRAINT "contact_message_handled_by_person_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_page" ADD CONSTRAINT "content_page_updated_by_person_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version" ADD CONSTRAINT "content_version_page_id_content_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."content_page"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version" ADD CONSTRAINT "content_version_saved_by_person_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_source_campaign_id_campaign_id_fk" FOREIGN KEY ("source_campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_album" ADD CONSTRAINT "gallery_album_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photo" ADD CONSTRAINT "gallery_photo_album_id_gallery_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."gallery_album"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploaded_by_person_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_author_person_id_person_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_consent_confirmed_by_person_id_fk" FOREIGN KEY ("consent_confirmed_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_person_id_person_id_fk" FOREIGN KEY ("actor_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_state" ADD CONSTRAINT "bot_state_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_state" ADD CONSTRAINT "bot_state_motion_id_motion_id_fk" FOREIGN KEY ("motion_id") REFERENCES "public"."motion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast" ADD CONSTRAINT "broadcast_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast" ADD CONSTRAINT "broadcast_approved_by_person_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_case_id_safeguarding_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."safeguarding_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_author_id_person_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_verified_by_person_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_supporter_id_supporter_id_fk" FOREIGN KEY ("supporter_id") REFERENCES "public"."supporter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_designation_programme_id_programme_id_fk" FOREIGN KEY ("designation_programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_source_campaign_id_campaign_id_fk" FOREIGN KEY ("source_campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grant" ADD CONSTRAINT "grant_funder_partner_id_partner_id_fk" FOREIGN KEY ("funder_partner_id") REFERENCES "public"."partner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_impact" ADD CONSTRAINT "historical_impact_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_impact" ADD CONSTRAINT "historical_impact_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_snapshot" ADD CONSTRAINT "impact_snapshot_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_snapshot" ADD CONSTRAINT "impact_snapshot_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_broadcast_id_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcast"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motion" ADD CONSTRAINT "motion_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_share" ADD CONSTRAINT "report_share_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_share" ADD CONSTRAINT "report_share_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_case" ADD CONSTRAINT "safeguarding_case_reporter_person_id_person_id_fk" FOREIGN KEY ("reporter_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_case" ADD CONSTRAINT "safeguarding_case_subject_person_id_person_id_fk" FOREIGN KEY ("subject_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_case" ADD CONSTRAINT "safeguarding_case_about_person_id_person_id_fk" FOREIGN KEY ("about_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_case" ADD CONSTRAINT "safeguarding_case_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_case" ADD CONSTRAINT "safeguarding_case_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safeguarding_case" ADD CONSTRAINT "safeguarding_case_owner_id_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting" ADD CONSTRAINT "setting_updated_by_person_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_attempt" ADD CONSTRAINT "speech_attempt_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_attempt" ADD CONSTRAINT "speech_attempt_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_attempt" ADD CONSTRAINT "speech_attempt_motion_id_motion_id_fk" FOREIGN KEY ("motion_id") REFERENCES "public"."motion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_person_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_student_type_idx" ON "consent" USING btree ("student_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_link_uq" ON "guardian_link" USING btree ("guardian_id","student_id");--> statement-breakpoint
CREATE INDEX "person_status_idx" ON "person" USING btree ("status");--> statement-breakpoint
CREATE INDEX "person_school_idx" ON "person" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "person_state_lga_idx" ON "person" USING btree ("state_id","lga_id");--> statement-breakpoint
CREATE INDEX "person_phone_hash_idx" ON "person" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX "person_email_hash_idx" ON "person" USING btree ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "person_role_active_uq" ON "person_role" USING btree ("person_id","role","state_id") WHERE "person_role"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "lga_state_idx" ON "lga" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "school_state_lga_idx" ON "school" USING btree ("state_id","lga_id");--> statement-breakpoint
CREATE INDEX "school_name_idx" ON "school" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_uq" ON "attendance" USING btree ("session_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_member_uq" ON "cohort_member" USING btree ("cohort_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hours_session_uq" ON "hours_entry" USING btree ("person_id","session_id") WHERE "hours_entry"."session_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_plan_pos_uq" ON "lesson_plan" USING btree ("programme_id","position");--> statement-breakpoint
CREATE INDEX "session_cohort_starts_idx" ON "session" USING btree ("cohort_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_coach_uq" ON "session_coach" USING btree ("session_id","person_id");--> statement-breakpoint
CREATE INDEX "audit_subject_idx" ON "audit_event" USING btree ("subject_person_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_event" USING btree ("actor_person_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "channel_opt_out_uq" ON "channel_opt_out" USING btree ("address_hash","channel");--> statement-breakpoint
CREATE INDEX "message_person_created_idx" ON "message" USING btree ("person_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "speech_person_created_idx" ON "speech_attempt" USING btree ("person_id","created_at" DESC NULLS LAST);