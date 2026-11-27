CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"reported_by" uuid,
	"reported_at" timestamp with time zone,
	"case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_read" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_thread" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"cohort_id" uuid NOT NULL,
	"coach_id" uuid,
	"student_id" uuid,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "live_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "live_ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "started_by" uuid;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "video_room" text;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_sender_id_person_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_reported_by_person_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read" ADD CONSTRAINT "chat_read_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read" ADD CONSTRAINT "chat_read_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_coach_id_person_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_student_id_person_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_thread_idx" ON "chat_message" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_read_uq" ON "chat_read" USING btree ("thread_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_thread_group_uq" ON "chat_thread" USING btree ("cohort_id") WHERE kind = 'group';--> statement-breakpoint
CREATE UNIQUE INDEX "chat_thread_direct_uq" ON "chat_thread" USING btree ("cohort_id","coach_id","student_id") WHERE kind = 'direct';--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_started_by_person_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "message_template" ("id", "key", "category", "channels", "subject_en", "body_en", "variables", "allow_before_consent", "ignores_quiet_hours", "is_system")
VALUES (gen_random_uuid(), 'session.started', 'utility', ARRAY['email','whatsapp','sms']::"channel"[], 'Your BGDI session has started', '{{firstName}}, {{cohortName}} has started with {{coachName}}. Join now: {{link}}', ARRAY['firstName','cohortName','coachName','link'], false, true, true)
ON CONFLICT ("key") DO NOTHING;
