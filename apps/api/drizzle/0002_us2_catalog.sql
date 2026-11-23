CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"name_es" text NOT NULL,
	"instructions_es" text[] NOT NULL,
	"primary_muscles" text[] NOT NULL,
	"secondary_muscles" text[] NOT NULL,
	"equipment" text[] NOT NULL,
	"level" text NOT NULL,
	"category" text NOT NULL,
	"mechanic" text,
	"force" text,
	"measure" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"exercise_id" text NOT NULL
);
