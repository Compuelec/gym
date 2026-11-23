CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"created_by" text,
	"email" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_email" text,
	"used_by" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"name" text NOT NULL,
	"equipment" text[] NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"goal" text NOT NULL,
	"level" text NOT NULL,
	"days_per_week" integer NOT NULL,
	"session_minutes" integer NOT NULL,
	"units" text NOT NULL,
	"bodyweight_kg" real,
	"birth_year" integer,
	"sex" text,
	"medical_ack_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "invitations_used_email_idx" ON "invitations" USING btree ("used_email");