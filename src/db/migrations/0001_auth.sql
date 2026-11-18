CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text,
	"phone_hash" text,
	"email" text,
	"email_hash" text,
	"password_hash" text,
	"is_staff" boolean DEFAULT false NOT NULL,
	"totp_secret" text,
	"totp_enabled_at" timestamp with time zone,
	"backup_codes" jsonb,
	"failed_sign_ins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_phone_hash_unique" UNIQUE("phone_hash"),
	CONSTRAINT "app_user_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
CREATE TABLE "auth_code" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"subject_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"user_id" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" text DEFAULT 'full' NOT NULL,
	"method" text NOT NULL,
	"active_person_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "auth_code" ADD CONSTRAINT "auth_code_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_code_subject_idx" ON "auth_code" USING btree ("purpose","subject_hash");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_session" USING btree ("user_id");