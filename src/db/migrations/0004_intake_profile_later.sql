ALTER TABLE "intake_response" ALTER COLUMN "dream_career" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_response" ALTER COLUMN "interests" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "intake_response" ALTER COLUMN "needs" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "intake_response" ALTER COLUMN "has_own_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_response" ALTER COLUMN "device_access" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_response" ALTER COLUMN "completed_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "intake_response" ALTER COLUMN "completed_at" DROP NOT NULL;