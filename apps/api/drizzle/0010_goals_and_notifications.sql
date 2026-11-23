CREATE TABLE "notification_log" (
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"local_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_owner_id_kind_local_date_pk" PRIMARY KEY("owner_id","kind","local_date")
);
--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "target_weight_kg" real;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "target_date" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "activity_level" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "injuries" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "reminder_days" integer[];--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "reminder_time" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "weekly_summary" boolean;--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ADD COLUMN "url" text;