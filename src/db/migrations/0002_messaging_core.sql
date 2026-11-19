ALTER TABLE "message" ADD COLUMN "send_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "message_status_send_after_idx" ON "message" USING btree ("status","send_after");