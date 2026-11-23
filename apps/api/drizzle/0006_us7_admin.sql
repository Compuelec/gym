CREATE TABLE "admin_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_model" text DEFAULT 'claude-haiku-5-5' NOT NULL,
	"ai_api_key_ciphertext" text,
	"ai_api_key_iv" text,
	"ai_api_key_tag" text,
	"ai_api_key_last4" text,
	"ai_api_key_updated_at" timestamp with time zone,
	"ai_daily_limit_per_user" integer DEFAULT 20 NOT NULL,
	"ai_monthly_budget_usd" numeric(10, 2) DEFAULT 5 NOT NULL,
	"ai_paused_reason" text,
	"ai_pricing" jsonb,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"messages" jsonb NOT NULL,
	"status" text NOT NULL,
	"result_json" jsonb,
	"validation_errors" jsonb,
	"error_message" text,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
