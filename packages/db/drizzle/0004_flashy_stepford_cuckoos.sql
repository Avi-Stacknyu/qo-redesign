ALTER TABLE "config_onboarding_questions" ADD COLUMN "enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "config_onboarding_questions" ADD COLUMN "required" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "config_onboarding_questions" ADD COLUMN "show_when" jsonb;--> statement-breakpoint
ALTER TABLE "config_onboarding_questions" ADD COLUMN "group" text;--> statement-breakpoint
ALTER TABLE "config_onboarding_questions" ADD COLUMN "metadata" jsonb;