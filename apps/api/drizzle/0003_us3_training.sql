CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"name" text NOT NULL,
	"weeks" integer NOT NULL,
	"source" text NOT NULL,
	"coach_request_id" text,
	"started_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"summary_es" text
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"name" text NOT NULL,
	"program_id" uuid,
	"week_index" integer,
	"day_index" integer,
	"location_id" uuid,
	"notes" text,
	"items" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"exercise_id" text NOT NULL,
	"replaced_from_exercise_id" text,
	"superset_group" text,
	"rest_seconds" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "set_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"weight_kg" real,
	"reps" integer,
	"seconds" integer,
	"meters" real,
	"rir" integer,
	"rpe" real,
	"completed_at" timestamp with time zone NOT NULL,
	"suggested" jsonb
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"routine_id" uuid,
	"location_id" uuid,
	"name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"status" text NOT NULL,
	"notes" text,
	"perceived_effort" integer
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "scheduled_pushes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scheduled_pushes_due_idx" ON "scheduled_pushes" USING btree ("fire_at");