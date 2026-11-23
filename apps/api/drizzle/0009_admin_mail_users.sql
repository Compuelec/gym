ALTER TABLE "user" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_host" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_port" integer;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_secure" boolean;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_user" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_password_ciphertext" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_password_iv" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_password_tag" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_from" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "mail_updated_at" timestamp with time zone;