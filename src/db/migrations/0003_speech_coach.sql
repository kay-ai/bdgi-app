CREATE TABLE "coach_lesson" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"lesson_key" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"best_score" integer,
	"passed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_skill" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"skill_key" text NOT NULL,
	"rating" numeric(3, 2) NOT NULL,
	"assessments" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speech_attempt" ADD COLUMN "kind" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "speech_attempt" ADD COLUMN "lesson_key" text;--> statement-breakpoint
ALTER TABLE "coach_lesson" ADD CONSTRAINT "coach_lesson_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_skill" ADD CONSTRAINT "coach_skill_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_lesson_uq" ON "coach_lesson" USING btree ("person_id","lesson_key");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_skill_uq" ON "coach_skill" USING btree ("person_id","skill_key");