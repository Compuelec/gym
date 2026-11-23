CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_version" bigint DEFAULT nextval('sync_version_seq') NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"weight_kg" real,
	"body_fat_pct" real,
	"waist_cm" real,
	"chest_cm" real,
	"arm_cm" real,
	"thigh_cm" real,
	"notes" text
);
