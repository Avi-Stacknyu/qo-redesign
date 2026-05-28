ALTER TABLE "config_onboarding_profiles" ADD COLUMN "default_tags" jsonb;--> statement-breakpoint
ALTER TABLE "config_onboarding_profiles" ADD COLUMN "visibility" text DEFAULT 'public';