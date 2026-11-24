CREATE TABLE "coach_review" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"verdict" text NOT NULL,
	"reason" text,
	"note" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_review" ADD CONSTRAINT "coach_review_attempt_id_speech_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."speech_attempt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_review" ADD CONSTRAINT "coach_review_reviewer_id_person_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_review" ADD CONSTRAINT "coach_review_resolved_by_person_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_review_uq" ON "coach_review" USING btree ("attempt_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "coach_review_open_idx" ON "coach_review" USING btree ("verdict","resolved_at");