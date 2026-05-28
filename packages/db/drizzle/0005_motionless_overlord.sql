CREATE TABLE "config_onboarding_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"organization_key" text,
	"organization_name" text,
	"source_type" text NOT NULL,
	"default_profile" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config_onboarding_invite_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"campaign" text NOT NULL,
	"profile_override" text,
	"code_type" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"max_uses" integer,
	"used_count" integer DEFAULT 0,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config_onboarding_profile_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"profile" text NOT NULL,
	"question" text,
	"type" text,
	"description" text,
	"sidebar_title" text,
	"fact_key" text,
	"options" jsonb,
	"order" numeric,
	"enabled" boolean DEFAULT true,
	"required" boolean DEFAULT true,
	"show_when" jsonb,
	"group" text,
	"metadata" jsonb,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config_onboarding_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"industry_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT false,
	"model" text,
	"system_prompt" text,
	"max_ai_questions" numeric,
	"session_timeout_ms" numeric,
	"cache_ttl_ms" numeric,
	"enable_trial_activation" boolean DEFAULT true,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profiler_extraction_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profiler_agent_id" text,
	"source_type" text NOT NULL,
	"source_message_ids" jsonb DEFAULT '[]'::jsonb,
	"model_used" text,
	"provider_used" text,
	"raw_output" jsonb,
	"profile_fields_written" jsonb,
	"profile_fields_skipped" jsonb,
	"memory_nodes_written" jsonb,
	"memory_nodes_skipped" jsonb,
	"schema_proposals" jsonb,
	"attempts" jsonb DEFAULT '[]'::jsonb,
	"extraction_duration_ms" numeric,
	"token_count_input" numeric,
	"token_count_output" numeric,
	"cost_usd" numeric,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiler_model_chain" (
	"id" text PRIMARY KEY NOT NULL,
	"profiler_agent_id" text NOT NULL,
	"model_id" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"temperature" numeric DEFAULT '0.3',
	"max_tokens" integer DEFAULT 2048,
	"timeout_ms" integer DEFAULT 30000,
	"retry_count" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiler_schema_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"extraction_log_id" text,
	"organization_id" text,
	"suggested_key" text NOT NULL,
	"suggested_section" text,
	"label" text,
	"example_values" jsonb,
	"reason" text,
	"confidence" numeric,
	"status" text DEFAULT 'pending' NOT NULL,
	"promoted_to_field" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_onboarding_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"profile" text NOT NULL,
	"campaign" text,
	"invite_code" text,
	"resolution_source" text NOT NULL,
	"source_value" text,
	"locked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"transcript" jsonb,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "config_onboarding_campaigns" ADD CONSTRAINT "fk_onboarding_campaigns_profile" FOREIGN KEY ("default_profile") REFERENCES "public"."config_onboarding_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_onboarding_invite_codes" ADD CONSTRAINT "fk_onboarding_invite_codes_campaign" FOREIGN KEY ("campaign") REFERENCES "public"."config_onboarding_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_onboarding_profile_questions" ADD CONSTRAINT "fk_onboarding_profile_questions_profile" FOREIGN KEY ("profile") REFERENCES "public"."config_onboarding_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_onboarding_profiles" ADD CONSTRAINT "fk_onboarding_profiles_model" FOREIGN KEY ("model") REFERENCES "public"."ai_agent_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_onboarding_profiles" ADD CONSTRAINT "fk_onboarding_profiles_system_prompt" FOREIGN KEY ("system_prompt") REFERENCES "public"."ai_prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiler_extraction_log" ADD CONSTRAINT "fk_extraction_log_profiler_agent" FOREIGN KEY ("profiler_agent_id") REFERENCES "public"."profiler_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiler_model_chain" ADD CONSTRAINT "fk_model_chain_profiler_agent" FOREIGN KEY ("profiler_agent_id") REFERENCES "public"."profiler_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiler_model_chain" ADD CONSTRAINT "fk_model_chain_model" FOREIGN KEY ("model_id") REFERENCES "public"."ai_agent_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiler_schema_proposals" ADD CONSTRAINT "fk_schema_proposals_extraction_log" FOREIGN KEY ("extraction_log_id") REFERENCES "public"."profiler_extraction_log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding_assignments" ADD CONSTRAINT "fk_user_onboarding_assignments_profile" FOREIGN KEY ("profile") REFERENCES "public"."config_onboarding_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_onboarding_campaigns_slug" ON "config_onboarding_campaigns" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_onboarding_invite_codes_code" ON "config_onboarding_invite_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_onboarding_profile_questions_profile_order" ON "config_onboarding_profile_questions" USING btree ("profile" text_ops,"order" numeric_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_onboarding_profiles_key" ON "config_onboarding_profiles" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_onboarding_profiles_status" ON "config_onboarding_profiles" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_extraction_log_user" ON "profiler_extraction_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_extraction_log_created" ON "profiler_extraction_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_extraction_log_source" ON "profiler_extraction_log" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_model_chain_profiler" ON "profiler_model_chain" USING btree ("profiler_agent_id");--> statement-breakpoint
CREATE INDEX "idx_model_chain_priority" ON "profiler_model_chain" USING btree ("profiler_agent_id","priority");--> statement-breakpoint
CREATE INDEX "idx_schema_proposals_user" ON "profiler_schema_proposals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_schema_proposals_status" ON "profiler_schema_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_assignments_user" ON "user_onboarding_assignments" USING btree ("user" text_ops);