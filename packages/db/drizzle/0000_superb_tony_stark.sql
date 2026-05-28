-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "analytical_tools" (
	"category" text,
	"computation_type" text,
	"created" timestamp with time zone,
	"description" text,
	"display_name" text,
	"icon" text,
	"id" text PRIMARY KEY NOT NULL,
	"input_schema" jsonb,
	"is_active" boolean,
	"output_config" jsonb,
	"tag_rule" jsonb,
	"tool_key" text,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config_dynamic_attributes" (
	"allowed_usages" jsonb,
	"allowed_values" jsonb,
	"attribute_key" text,
	"category" text,
	"created" timestamp with time zone,
	"data_type" text,
	"default_value" jsonb,
	"description" text,
	"display_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"is_required_for_agents" boolean,
	"source_config" jsonb,
	"source_type" text,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config_feature_flags" (
	"created" timestamp with time zone,
	"description" text,
	"display_name" text,
	"flag_key" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_enabled" boolean,
	"tag_rule" jsonb,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config_onboarding_questions" (
	"created" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"options" jsonb,
	"question" text,
	"type" text,
	"updated" timestamp with time zone,
	"description" text,
	"sidebar_title" text,
	"fact_key" text,
	"order" numeric
);
--> statement-breakpoint
CREATE TABLE "config_profile_schema" (
	"created" timestamp with time zone,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"name" text,
	"schema" jsonb,
	"updated" timestamp with time zone,
	"version" numeric
);
--> statement-breakpoint
CREATE TABLE "config_tag_rule_presets" (
	"created" timestamp with time zone,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"tag_rule" jsonb,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dashboard_templates" (
	"category" text,
	"created" timestamp with time zone,
	"default_widgets" jsonb,
	"description" text,
	"icon" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"name" text,
	"preview_image" text,
	"updated" timestamp with time zone,
	"tag_rule" jsonb
);
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
	"created" timestamp with time zone,
	"default_config" jsonb,
	"default_size" text,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"name" text,
	"updated" timestamp with time zone,
	"widget_type" text,
	"config_fields" jsonb,
	"icon" text,
	"category" text,
	"base_type" text,
	"locked_config" jsonb,
	"tag_rule" jsonb
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"config" jsonb,
	"created" timestamp with time zone,
	"description" text,
	"display_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"source_key" text,
	"source_type" text,
	"tag_rule" jsonb,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"status" text,
	"current_flow" text,
	"cost_multiplier" numeric,
	"is_universal" boolean,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	"avatar" text,
	"tag_rule" jsonb,
	"profiler_agent" text,
	"purpose" text
);
--> statement-breakpoint
CREATE TABLE "ai_agent_flows" (
	"is_active" boolean,
	"agent" text,
	"created" timestamp with time zone,
	"change_log" text,
	"id" text PRIMARY KEY NOT NULL,
	"flow_data" jsonb,
	"updated" timestamp with time zone,
	"version" numeric,
	"compiled_config" jsonb,
	"validation_status" text,
	"validation_errors" jsonb
);
--> statement-breakpoint
CREATE TABLE "ai_system_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"meta" jsonb,
	"name" text,
	"type" text,
	"size" numeric,
	"vectors" jsonb,
	"description" text,
	"path" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_pricing_rates" (
	"cached_input_price_per_1m" numeric,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"input_price_per_1m" numeric,
	"is_active" boolean,
	"notes" text,
	"output_price_per_1m" numeric,
	"price_per_call" numeric,
	"price_per_character" numeric,
	"price_per_image" numeric,
	"price_per_minute" numeric,
	"price_per_second" numeric,
	"reasoning_price_per_1m" numeric,
	"tier" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_agent_models" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text,
	"display_name" text,
	"description" text,
	"is_active" boolean,
	"is_enabled" boolean,
	"current_pricing" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	"provider" text,
	"options_schema" jsonb,
	"default_options" jsonb,
	"capabilities" jsonb,
	"context_window" numeric,
	"max_output_tokens" numeric,
	"is_system_default" boolean,
	"tag_rule" jsonb,
	"config_key" text,
	"service_type" text
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"base_url" text,
	"created" timestamp with time zone,
	"default_headers" jsonb,
	"display_name" text,
	"docs_url" text,
	"env_key_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"logo" text,
	"provider_key" text,
	"updated" timestamp with time zone,
	"website_url" text
);
--> statement-breakpoint
CREATE TABLE "ai_tools" (
	"category" text,
	"config_schema" jsonb,
	"created" timestamp with time zone,
	"current_pricing" text,
	"default_config" jsonb,
	"description" text,
	"display_name" text,
	"docs_url" text,
	"icon" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"provider" text,
	"sdk_tool_name" text,
	"tool_key" text,
	"updated" timestamp with time zone,
	"tool_type" text,
	"execution_config" jsonb,
	"is_enabled" boolean
);
--> statement-breakpoint
CREATE TABLE "profiler_agents" (
	"created" timestamp with time zone,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"max_tokens" numeric,
	"model" text,
	"name" text,
	"schema" jsonb,
	"status" text,
	"system_prompt" text,
	"updated" timestamp with time zone,
	"focus_sections" jsonb,
	"priority" bigint,
	"is_general_fallback" boolean
);
--> statement-breakpoint
CREATE TABLE "users" (
	"avatar" text,
	"created" timestamp with time zone,
	"email" text,
	"emailVisibility" boolean,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"password" text,
	"tokenKey" text,
	"updated" timestamp with time zone,
	"verified" boolean,
	"role" text,
	"onboarding_complete" boolean,
	"accept_policies" boolean,
	"account_status" text,
	"trial_claimed" boolean,
	"plan" text,
	"stripe_customer_id" text
);
--> statement-breakpoint
CREATE TABLE "ai_composio_connections" (
	"connected_account" text,
	"connection_id" text,
	"created" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"last_used_at" timestamp with time zone,
	"scopes" jsonb,
	"status" text,
	"toolkit_name" text,
	"toolkit_slug" text,
	"updated" timestamp with time zone,
	"use_count" numeric,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"meta" jsonb,
	"title" text,
	"source" text,
	"agent" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "chat_file_references" (
	"chat" text,
	"created" timestamp with time zone,
	"file" text,
	"id" text PRIMARY KEY NOT NULL,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "user_uploads" (
	"created" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"path" text,
	"updated" timestamp with time zone,
	"type" text,
	"meta" jsonb,
	"user" text,
	"size" numeric,
	"vectors" jsonb,
	"share_with_agent" boolean,
	"share_with_admin" boolean,
	"share_with_manager" boolean
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"chat" text,
	"id" text PRIMARY KEY NOT NULL,
	"meta" jsonb,
	"role" text,
	"message" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_messages_debug" (
	"agent" text,
	"assistant_response" text,
	"chat" text,
	"context_data" jsonb,
	"cost_usd" numeric,
	"created" timestamp with time zone,
	"full_messages_json" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"input_tokens" numeric,
	"latency_ms" numeric,
	"model_id" text,
	"output_tokens" numeric,
	"provider" text,
	"role" text,
	"sequence_number" numeric,
	"source_message" text,
	"system_prompt" text,
	"updated" timestamp with time zone,
	"user" text,
	"user_message" text
);
--> statement-breakpoint
CREATE TABLE "config_onboarding" (
	"cache_ttl_ms" numeric,
	"created" timestamp with time zone,
	"enabled" boolean,
	"id" text PRIMARY KEY NOT NULL,
	"max_ai_questions" numeric,
	"model" text,
	"session_timeout_ms" numeric,
	"system_prompt" text,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"category" text,
	"created" timestamp with time zone,
	"description" text,
	"display_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"prompt_key" text,
	"prompt_template" text,
	"updated" timestamp with time zone,
	"version" bigint,
	"change_notes" text
);
--> statement-breakpoint
CREATE TABLE "config_tag_namespaces" (
	"color_class" text,
	"created" timestamp with time zone,
	"description" text,
	"display_name" text,
	"icon" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_assignable_onboarding" boolean,
	"is_user_editable" boolean,
	"name" text,
	"sort_order" numeric,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config_tag_catalog" (
	"created" timestamp with time zone,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"tag" text,
	"updated" timestamp with time zone,
	"namespace" text
);
--> statement-breakpoint
CREATE TABLE "plan_payment_transactions" (
	"amount" numeric,
	"created" timestamp with time zone,
	"currency" text,
	"id" text PRIMARY KEY NOT NULL,
	"meta" jsonb,
	"notes" text,
	"plan" text,
	"provider" text,
	"provider_payment_id" text,
	"status" text,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "core_credit_ledger" (
	"created" timestamp with time zone,
	"credits_changed" numeric,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"notes" text,
	"payment_tnx" text,
	"token_entry" text,
	"type" text,
	"updated" timestamp with time zone,
	"user" text,
	"balance_before" numeric,
	"balance_after" numeric,
	"transaction_type" text,
	"pricing_rate_id" text
);
--> statement-breakpoint
CREATE TABLE "core_token_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text,
	"agent" text,
	"model" text,
	"provider" text,
	"category" text,
	"message_id" text,
	"chunk_index" numeric,
	"direction" text,
	"tokens" numeric,
	"cost_usd" numeric,
	"meta" jsonb,
	"event_time" timestamp with time zone,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	"pricing_rate_id" text,
	"chat" text
);
--> statement-breakpoint
CREATE TABLE "credit_exchange_rates" (
	"changed_by" text,
	"created" timestamp with time zone,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"notes" text,
	"rate" numeric,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_packages" (
	"created" timestamp with time zone,
	"credits" numeric,
	"description" text,
	"highlight" boolean,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"not_included_points" text,
	"points" text,
	"product_id" text,
	"provider" text,
	"subtitle" text,
	"title" text,
	"type" text,
	"updated" timestamp with time zone,
	"is_archived" boolean,
	"is_subscription" boolean,
	"fallback_model" text,
	"stripe_price_id" text,
	"granted_tags" jsonb
);
--> statement-breakpoint
CREATE TABLE "user_bookmarks" (
	"category" text,
	"created" timestamp with time zone,
	"description" text,
	"domain" text,
	"favicon" text,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"title" text,
	"updated" timestamp with time zone,
	"url" text,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "user_chat_suggestions" (
	"agent" text,
	"created" timestamp with time zone,
	"generated_at" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"input_tokens_at_generation" numeric,
	"intent_count_at_generation" numeric,
	"suggestions" jsonb,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "user_customization" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text,
	"user" text,
	"value" jsonb,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"access_count" numeric,
	"created" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"is_default" boolean,
	"last_accessed" timestamp with time zone,
	"profile_color" text,
	"profile_icon" text,
	"profile_name" text,
	"profile_type" text,
	"theme_mode" text,
	"theme_preset" text,
	"updated" timestamp with time zone,
	"user" text,
	"is_pinned" boolean,
	"sort_order" bigint,
	"template_id" text
);
--> statement-breakpoint
CREATE TABLE "user_dashboard_layouts" (
	"created" timestamp with time zone,
	"grid_config" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"layout_name" text,
	"profile" text,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "user_data_sources" (
	"agent_prompt" text,
	"created" timestamp with time zone,
	"created_by" text,
	"data" jsonb,
	"display_name" text,
	"file_ref" text,
	"id" text PRIMARY KEY NOT NULL,
	"input_params" jsonb,
	"is_stale" boolean,
	"source_key" text,
	"tool_key" text,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "user_family_office_members" (
	"created" timestamp with time zone,
	"email" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"parent_id" text,
	"position_x" numeric,
	"position_y" numeric,
	"responsibilities" jsonb,
	"role" text,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"content" text,
	"created" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"include_in_memory" boolean,
	"title" text,
	"updated" timestamp with time zone,
	"user" text,
	"share_with_admin" boolean,
	"share_with_manager" boolean,
	"agent" text,
	"category" text,
	"chat" text,
	"source" text,
	"source_message" text,
	"tags" jsonb,
	"pinned" boolean
);
--> statement-breakpoint
CREATE TABLE "user_profile_summaries" (
	"fact_count_at_generation" numeric,
	"id" text PRIMARY KEY NOT NULL,
	"input_tokens_at_generation" numeric,
	"intent_count_at_generation" numeric,
	"summary_text" text,
	"user" text,
	"generated_at" timestamp with time zone,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_reminders" (
	"created" timestamp with time zone,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"include_in_memory" boolean,
	"notification_minutes_before" numeric,
	"reminder_datetime" text,
	"sent" boolean,
	"title" text,
	"updated" timestamp with time zone,
	"user" text,
	"recurring" text,
	"is_active" boolean,
	"share_with_admin" boolean,
	"share_with_manager" boolean,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "user_tier_overrides" (
	"created" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"granted_by" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"override_type" text,
	"reason" text,
	"target_id" text,
	"updated" timestamp with time zone,
	"user" text
);
--> statement-breakpoint
CREATE TABLE "user_todos" (
	"created" timestamp with time zone,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"include_in_memory" boolean,
	"status" text,
	"task" text,
	"updated" timestamp with time zone,
	"user" text,
	"priority" text,
	"share_with_admin" boolean,
	"share_with_manager" boolean,
	"due_date" timestamp with time zone,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "user_widget_instances" (
	"ai_generation_prompt" text,
	"created" timestamp with time zone,
	"created_by_ai" boolean,
	"custom_config" jsonb,
	"dashboard" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_visible" boolean,
	"position" jsonb,
	"updated" timestamp with time zone,
	"user" text,
	"visual_config" jsonb,
	"widget_title" text,
	"widget_type" text
);
--> statement-breakpoint
CREATE TABLE "core_role_permissions" (
	"create" boolean,
	"created" timestamp with time zone,
	"delete" boolean,
	"entity_type" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"read" boolean,
	"update" boolean,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_agent_flows__knowledge_files" (
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "pk_ai_agent_flows__knowledge_files" PRIMARY KEY("source_id","position")
);
--> statement-breakpoint
CREATE TABLE "ai_agent_models__supported_tools" (
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "pk_ai_agent_models__supported_tools" PRIMARY KEY("source_id","position")
);
--> statement-breakpoint
CREATE TABLE "chat_messages__attachments" (
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "pk_chat_messages__attachments" PRIMARY KEY("source_id","position")
);
--> statement-breakpoint
CREATE TABLE "plan_packages__allowed_models" (
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "pk_plan_packages__allowed_models" PRIMARY KEY("source_id","position")
);
--> statement-breakpoint
CREATE TABLE "plan_packages__allowed_tools" (
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "pk_plan_packages__allowed_tools" PRIMARY KEY("source_id","position")
);
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "fk_ai_agents_current_flow_ai_agent_flows" FOREIGN KEY ("current_flow") REFERENCES "public"."ai_agent_flows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "fk_ai_agents_profiler_agent_profiler_agents" FOREIGN KEY ("profiler_agent") REFERENCES "public"."profiler_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_flows" ADD CONSTRAINT "fk_ai_agent_flows_agent_ai_agents" FOREIGN KEY ("agent") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_models" ADD CONSTRAINT "fk_ai_agent_models_current_pricing_ai_pricing_rates" FOREIGN KEY ("current_pricing") REFERENCES "public"."ai_pricing_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_models" ADD CONSTRAINT "fk_ai_agent_models_provider_ai_providers" FOREIGN KEY ("provider") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tools" ADD CONSTRAINT "fk_ai_tools_current_pricing_ai_pricing_rates" FOREIGN KEY ("current_pricing") REFERENCES "public"."ai_pricing_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tools" ADD CONSTRAINT "fk_ai_tools_provider_ai_providers" FOREIGN KEY ("provider") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiler_agents" ADD CONSTRAINT "fk_profiler_agents_model_ai_agent_models" FOREIGN KEY ("model") REFERENCES "public"."ai_agent_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "fk_users_role_core_role_permissions" FOREIGN KEY ("role") REFERENCES "public"."core_role_permissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "fk_users_plan_plan_packages" FOREIGN KEY ("plan") REFERENCES "public"."plan_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_composio_connections" ADD CONSTRAINT "fk_ai_composio_connections_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "fk_chats_agent_ai_agents" FOREIGN KEY ("agent") REFERENCES "public"."ai_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "fk_chats_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file_references" ADD CONSTRAINT "fk_chat_file_references_chat_chats" FOREIGN KEY ("chat") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file_references" ADD CONSTRAINT "fk_chat_file_references_file_user_uploads" FOREIGN KEY ("file") REFERENCES "public"."user_uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file_references" ADD CONSTRAINT "fk_chat_file_references_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_uploads" ADD CONSTRAINT "fk_user_uploads_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "fk_chat_messages_chat_chats" FOREIGN KEY ("chat") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages_debug" ADD CONSTRAINT "fk_chat_messages_debug_agent_ai_agents" FOREIGN KEY ("agent") REFERENCES "public"."ai_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages_debug" ADD CONSTRAINT "fk_chat_messages_debug_chat_chats" FOREIGN KEY ("chat") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages_debug" ADD CONSTRAINT "fk_chat_messages_debug_source_message_chat_messages" FOREIGN KEY ("source_message") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages_debug" ADD CONSTRAINT "fk_chat_messages_debug_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_onboarding" ADD CONSTRAINT "fk_config_onboarding_model_ai_agent_models" FOREIGN KEY ("model") REFERENCES "public"."ai_agent_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_onboarding" ADD CONSTRAINT "fk_config_onboarding_system_prompt_ai_prompts" FOREIGN KEY ("system_prompt") REFERENCES "public"."ai_prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_tag_catalog" ADD CONSTRAINT "fk_config_tag_catalog_namespace_config_tag_namespaces" FOREIGN KEY ("namespace") REFERENCES "public"."config_tag_namespaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_payment_transactions" ADD CONSTRAINT "fk_plan_payment_transactions_plan_plan_packages" FOREIGN KEY ("plan") REFERENCES "public"."plan_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_payment_transactions" ADD CONSTRAINT "fk_plan_payment_transactions_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_credit_ledger" ADD CONSTRAINT "fk_core_credit_ledger_payment_tnx_plan_payment_transactions" FOREIGN KEY ("payment_tnx") REFERENCES "public"."plan_payment_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_credit_ledger" ADD CONSTRAINT "fk_core_credit_ledger_token_entry_core_token_ledger" FOREIGN KEY ("token_entry") REFERENCES "public"."core_token_ledger"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_credit_ledger" ADD CONSTRAINT "fk_core_credit_ledger_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_credit_ledger" ADD CONSTRAINT "fk_core_credit_ledger_pricing_rate_id_ai_pricing_rates" FOREIGN KEY ("pricing_rate_id") REFERENCES "public"."ai_pricing_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_token_ledger" ADD CONSTRAINT "fk_core_token_ledger_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_token_ledger" ADD CONSTRAINT "fk_core_token_ledger_agent_ai_agents" FOREIGN KEY ("agent") REFERENCES "public"."ai_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_token_ledger" ADD CONSTRAINT "fk_core_token_ledger_pricing_rate_id_ai_pricing_rates" FOREIGN KEY ("pricing_rate_id") REFERENCES "public"."ai_pricing_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_token_ledger" ADD CONSTRAINT "fk_core_token_ledger_chat_chats" FOREIGN KEY ("chat") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_exchange_rates" ADD CONSTRAINT "fk_credit_exchange_rates_changed_by_users" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_packages" ADD CONSTRAINT "fk_plan_packages_fallback_model_ai_agent_models" FOREIGN KEY ("fallback_model") REFERENCES "public"."ai_agent_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "fk_user_bookmarks_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chat_suggestions" ADD CONSTRAINT "fk_user_chat_suggestions_agent_ai_agents" FOREIGN KEY ("agent") REFERENCES "public"."ai_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chat_suggestions" ADD CONSTRAINT "fk_user_chat_suggestions_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_customization" ADD CONSTRAINT "fk_user_customization_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "fk_user_profiles_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_layouts" ADD CONSTRAINT "fk_user_dashboard_layouts_profile_user_profiles" FOREIGN KEY ("profile") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_layouts" ADD CONSTRAINT "fk_user_dashboard_layouts_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_data_sources" ADD CONSTRAINT "fk_user_data_sources_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_family_office_members" ADD CONSTRAINT "fk_user_family_office_members_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "fk_user_notes_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "fk_user_notes_agent_ai_agents" FOREIGN KEY ("agent") REFERENCES "public"."ai_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "fk_user_notes_chat_chats" FOREIGN KEY ("chat") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "fk_user_notes_source_message_chat_messages" FOREIGN KEY ("source_message") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_summaries" ADD CONSTRAINT "fk_user_profile_summaries_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reminders" ADD CONSTRAINT "fk_user_reminders_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tier_overrides" ADD CONSTRAINT "fk_user_tier_overrides_granted_by_users" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tier_overrides" ADD CONSTRAINT "fk_user_tier_overrides_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_todos" ADD CONSTRAINT "fk_user_todos_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_widget_instances" ADD CONSTRAINT "fk_user_widget_instances_dashboard_user_dashboard_layouts" FOREIGN KEY ("dashboard") REFERENCES "public"."user_dashboard_layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_widget_instances" ADD CONSTRAINT "fk_user_widget_instances_user_users" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_flows__knowledge_files" ADD CONSTRAINT "fk_ai_agent_flows__knowledge_files_source" FOREIGN KEY ("source_id") REFERENCES "public"."ai_agent_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_flows__knowledge_files" ADD CONSTRAINT "fk_ai_agent_flows__knowledge_files_target" FOREIGN KEY ("target_id") REFERENCES "public"."ai_system_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_models__supported_tools" ADD CONSTRAINT "fk_ai_agent_models__supported_tools_source" FOREIGN KEY ("source_id") REFERENCES "public"."ai_agent_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_models__supported_tools" ADD CONSTRAINT "fk_ai_agent_models__supported_tools_target" FOREIGN KEY ("target_id") REFERENCES "public"."ai_tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages__attachments" ADD CONSTRAINT "fk_chat_messages__attachments_source" FOREIGN KEY ("source_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages__attachments" ADD CONSTRAINT "fk_chat_messages__attachments_target" FOREIGN KEY ("target_id") REFERENCES "public"."user_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_packages__allowed_models" ADD CONSTRAINT "fk_plan_packages__allowed_models_source" FOREIGN KEY ("source_id") REFERENCES "public"."plan_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_packages__allowed_models" ADD CONSTRAINT "fk_plan_packages__allowed_models_target" FOREIGN KEY ("target_id") REFERENCES "public"."ai_agent_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_packages__allowed_tools" ADD CONSTRAINT "fk_plan_packages__allowed_tools_source" FOREIGN KEY ("source_id") REFERENCES "public"."plan_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_packages__allowed_tools" ADD CONSTRAINT "fk_plan_packages__allowed_tools_target" FOREIGN KEY ("target_id") REFERENCES "public"."ai_tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytical_tools_active_category" ON "analytical_tools" USING btree ("is_active" text_ops,"category" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_analytical_tools_active_key" ON "analytical_tools" USING btree ("is_active" bool_ops,"tool_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_config_dynamic_attributes_active_cat_name" ON "config_dynamic_attributes" USING btree ("is_active" text_ops,"category" text_ops,"display_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_config_feature_flags_enabled" ON "config_feature_flags" USING btree ("is_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_config_feature_flags_key" ON "config_feature_flags" USING btree ("flag_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_config_onboarding_questions_order" ON "config_onboarding_questions" USING btree ("order" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_config_tag_rule_presets_name" ON "config_tag_rule_presets" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_dashboard_templates_is_active" ON "dashboard_templates" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_dashboard_widgets_type" ON "dashboard_widgets" USING btree ("widget_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agents_current_flow" ON "ai_agents" USING btree ("current_flow" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agents_profiler_agent" ON "ai_agents" USING btree ("profiler_agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agents_status_name" ON "ai_agents" USING btree ("status" text_ops,"name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_fLk1j2PGEZ" ON "ai_agents" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_521isOEG0d" ON "ai_agent_flows" USING btree ("agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_7ltrrk4dWU" ON "ai_agent_flows" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_a3ouc9yUaP" ON "ai_agent_flows" USING btree ("agent" text_ops,"version" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_flows_agent" ON "ai_agent_flows" USING btree ("agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_flows_agent_is_active" ON "ai_agent_flows" USING btree ("agent" text_ops,"is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_system_uploads_created" ON "ai_system_uploads" USING btree ("created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_pricing_rates_created" ON "ai_pricing_rates" USING btree ("created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_GCcG9MmEQV" ON "ai_agent_models" USING btree ("is_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_GhMQf4iT2O" ON "ai_agent_models" USING btree ("is_active" text_ops,"model_id" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_QyhDW7n5UB" ON "ai_agent_models" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ai_agent_models_active_config_key" ON "ai_agent_models" USING btree ("config_key" text_ops) WHERE ((config_key <> ''::text) AND (is_active = true));--> statement-breakpoint
CREATE INDEX "idx_ai_agent_models_active_enabled_name" ON "ai_agent_models" USING btree ("is_active" text_ops,"is_enabled" text_ops,"display_name" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_models_current_pricing" ON "ai_agent_models" USING btree ("current_pricing" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_models_model_id_active" ON "ai_agent_models" USING btree ("model_id" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_models_provider" ON "ai_agent_models" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_providers_active_name" ON "ai_providers" USING btree ("is_active" text_ops,"display_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_tools_active_category_name" ON "ai_tools" USING btree ("is_active" text_ops,"category" bool_ops,"display_name" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_tools_current_pricing" ON "ai_tools" USING btree ("current_pricing" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_tools_is_active_is_enabled" ON "ai_tools" USING btree ("is_active" bool_ops,"is_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_tools_provider" ON "ai_tools" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_tools_tool_key_is_active" ON "ai_tools" USING btree ("tool_key" bool_ops,"is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_profiler_agents_model" ON "profiler_agents" USING btree ("model" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email__pb_users_auth_" ON "users" USING btree ("email" text_ops) WHERE (email <> ''::text);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tokenKey__pb_users_auth_" ON "users" USING btree ("tokenKey" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_account_status" ON "users" USING btree ("account_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_plan" ON "users" USING btree ("plan" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_composio_connections_connid_user" ON "ai_composio_connections" USING btree ("connection_id" text_ops,"user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_composio_connections_user" ON "ai_composio_connections" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_composio_connections_user_created" ON "ai_composio_connections" USING btree ("user" timestamptz_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chats_agent" ON "chats" USING btree ("agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chats_agent_source_updated" ON "chats" USING btree ("agent" text_ops,"source" timestamptz_ops,"updated" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_chats_user" ON "chats" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chats_user_source_updated" ON "chats" USING btree ("user" timestamptz_ops,"source" timestamptz_ops,"updated" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_tRoU9hSo9D" ON "chats" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_file_references_chat" ON "chat_file_references" USING btree ("chat" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_file_references_file" ON "chat_file_references" USING btree ("file" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_file_references_user" ON "chat_file_references" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_uf2p0zUSom" ON "user_uploads" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_uploads_user" ON "user_uploads" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_uploads_user_created" ON "user_uploads" USING btree ("user" timestamptz_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_uploads_user_share_created" ON "user_uploads" USING btree ("user" timestamptz_ops,"share_with_agent" bool_ops,"created" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_JuAh9wYK8g" ON "chat_messages" USING btree ("chat" timestamptz_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_chat" ON "chat_messages" USING btree ("chat" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_chat_role" ON "chat_messages" USING btree ("chat" text_ops,"role" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_debug_agent" ON "chat_messages_debug" USING btree ("agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_debug_chat" ON "chat_messages_debug" USING btree ("chat" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_debug_chat_created" ON "chat_messages_debug" USING btree ("chat" text_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_debug_source_message" ON "chat_messages_debug" USING btree ("source_message" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_debug_user" ON "chat_messages_debug" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ktmEOYS2LB" ON "chat_messages_debug" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_yZtlyMAMed" ON "chat_messages_debug" USING btree ("chat" text_ops);--> statement-breakpoint
CREATE INDEX "idx_config_onboarding_enabled_created" ON "config_onboarding" USING btree ("enabled" timestamptz_ops,"created" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_config_onboarding_model" ON "config_onboarding" USING btree ("model" text_ops);--> statement-breakpoint
CREATE INDEX "idx_config_onboarding_system_prompt" ON "config_onboarding" USING btree ("system_prompt" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_prompts_active_category_key" ON "ai_prompts" USING btree ("is_active" text_ops,"category" bool_ops,"prompt_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_prompts_category_display_name" ON "ai_prompts" USING btree ("category" text_ops,"display_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_prompts_key_active_created" ON "ai_prompts" USING btree ("prompt_key" bool_ops,"is_active" bool_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_config_tag_catalog_namespace" ON "config_tag_catalog" USING btree ("namespace" text_ops);--> statement-breakpoint
CREATE INDEX "idx_config_tag_catalog_namespace_tag" ON "config_tag_catalog" USING btree ("namespace" text_ops,"tag" text_ops);--> statement-breakpoint
CREATE INDEX "idx_2Vm6H14ynz" ON "plan_payment_transactions" USING btree ("plan" text_ops);--> statement-breakpoint
CREATE INDEX "idx_AJ5O28kjCz" ON "plan_payment_transactions" USING btree ("user" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_EuALTNhOhY" ON "plan_payment_transactions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_HQ1rzz73qm" ON "plan_payment_transactions" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE INDEX "idx_VjIO2SUm4n" ON "plan_payment_transactions" USING btree ("user" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_m2tzt9FM9l" ON "plan_payment_transactions" USING btree ("provider_payment_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_payment_transactions_plan" ON "plan_payment_transactions" USING btree ("plan" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_payment_transactions_user" ON "plan_payment_transactions" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_payment_transactions_user_created" ON "plan_payment_transactions" USING btree ("user" text_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_core_credit_ledger_payment_tnx" ON "core_credit_ledger" USING btree ("payment_tnx" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_credit_ledger_pricing_rate_id" ON "core_credit_ledger" USING btree ("pricing_rate_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_credit_ledger_token_entry" ON "core_credit_ledger" USING btree ("token_entry" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_credit_ledger_user" ON "core_credit_ledger" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_credit_ledger_user_created" ON "core_credit_ledger" USING btree ("user" text_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_core_credit_ledger_user_type_created" ON "core_credit_ledger" USING btree ("user" timestamptz_ops,"type" text_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_agent" ON "core_token_ledger" USING btree ("agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_chat" ON "core_token_ledger" USING btree ("chat" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_created" ON "core_token_ledger" USING btree ("created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_model" ON "core_token_ledger" USING btree ("model" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_pricing_rate_id" ON "core_token_ledger" USING btree ("pricing_rate_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_provider" ON "core_token_ledger" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_user" ON "core_token_ledger" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_user_category_created" ON "core_token_ledger" USING btree ("user" timestamptz_ops,"category" timestamptz_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_core_token_ledger_user_created" ON "core_token_ledger" USING btree ("user" timestamptz_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_credit_exchange_rates_active_effective" ON "credit_exchange_rates" USING btree ("is_active" timestamptz_ops,"effective_from" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_credit_exchange_rates_changed_by" ON "credit_exchange_rates" USING btree ("changed_by" text_ops);--> statement-breakpoint
CREATE INDEX "idx_DySQB5eL9I" ON "plan_packages" USING btree ("is_active" text_ops,"type" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_packages_fallback_model" ON "plan_packages" USING btree ("fallback_model" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_packages_type_active_archived_created" ON "plan_packages" USING btree ("type" timestamptz_ops,"is_active" timestamptz_ops,"is_archived" timestamptz_ops,"created" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_bookmarks_user" ON "user_bookmarks" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_bookmarks_user_category" ON "user_bookmarks" USING btree ("user" text_ops,"category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_bookmarks_user_created" ON "user_bookmarks" USING btree ("user" text_ops,"created" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_PXDjps94K5" ON "user_chat_suggestions" USING btree ("agent" text_ops,"user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rM4Z4b25C1" ON "user_chat_suggestions" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_chat_suggestions_agent" ON "user_chat_suggestions" USING btree ("agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_chat_suggestions_user" ON "user_chat_suggestions" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_VvOatUSOEt" ON "user_customization" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_customization_user" ON "user_customization" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_customization_user_created" ON "user_customization" USING btree ("user" timestamptz_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_customization_user_updated" ON "user_customization" USING btree ("user" timestamptz_ops,"updated" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_v8bWQZ7nwx" ON "user_customization" USING btree ("key" text_ops,"user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_active" ON "user_profiles" USING btree ("user" bool_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_active_sort" ON "user_profiles" USING btree ("user" text_ops,"is_active" text_ops,"is_default" text_ops,"last_accessed" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_user" ON "user_profiles" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_dashboard_layouts_composite" ON "user_dashboard_layouts" USING btree ("user" bool_ops,"profile" bool_ops,"is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_dashboard_layouts_profile" ON "user_dashboard_layouts" USING btree ("profile" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_dashboard_layouts_user" ON "user_dashboard_layouts" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_data_sources_user" ON "user_data_sources" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_iPt4zJXIA2" ON "user_family_office_members" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_family_office_members_user" ON "user_family_office_members" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_family_office_members_user_created" ON "user_family_office_members" USING btree ("user" text_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_asJNTDh2CQ" ON "user_notes" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_fhRlffouxO" ON "user_notes" USING btree ("include_in_memory" text_ops,"user" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notes_agent" ON "user_notes" USING btree ("agent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notes_chat" ON "user_notes" USING btree ("chat" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notes_source_message" ON "user_notes" USING btree ("source_message" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notes_user" ON "user_notes" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notes_user_created" ON "user_notes" USING btree ("user" timestamptz_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notes_user_pinned_created" ON "user_notes" USING btree ("user" timestamptz_ops,"pinned" bool_ops,"created" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profile_summaries_user" ON "user_profile_summaries" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_1AiWk9bp54" ON "user_reminders" USING btree ("reminder_datetime" text_ops);--> statement-breakpoint
CREATE INDEX "idx_901fImT4CL" ON "user_reminders" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_SoyWmskGrF" ON "user_reminders" USING btree ("user" text_ops,"reminder_datetime" text_ops);--> statement-breakpoint
CREATE INDEX "idx_eTewbL4Gdx" ON "user_reminders" USING btree ("sent" bool_ops,"reminder_datetime" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_reminders_sent_datetime_asc" ON "user_reminders" USING btree ("sent" text_ops,"reminder_datetime" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_reminders_user" ON "user_reminders" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_reminders_user_datetime_desc" ON "user_reminders" USING btree ("user" text_ops,"reminder_datetime" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_reminders_user_sent_datetime" ON "user_reminders" USING btree ("user" text_ops,"sent" text_ops,"reminder_datetime" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_tier_overrides_granted_by" ON "user_tier_overrides" USING btree ("granted_by" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_tier_overrides_user" ON "user_tier_overrides" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_tier_overrides_user_active" ON "user_tier_overrides" USING btree ("user" text_ops,"is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_tier_overrides_user_type" ON "user_tier_overrides" USING btree ("user" text_ops,"override_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_p88iUG66oc" ON "user_todos" USING btree ("include_in_memory" bool_ops,"user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_todos_user" ON "user_todos" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_todos_user_created" ON "user_todos" USING btree ("user" text_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_todos_user_status_created" ON "user_todos" USING btree ("user" text_ops,"status" timestamptz_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_vDxRPFvDrV" ON "user_todos" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_widget_instances_dash_user_created" ON "user_widget_instances" USING btree ("dashboard" timestamptz_ops,"user" timestamptz_ops,"created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_widget_instances_dashboard" ON "user_widget_instances" USING btree ("dashboard" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_widget_instances_user" ON "user_widget_instances" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_5I7djbpnp7" ON "core_role_permissions" USING btree ("entity_type" text_ops,"name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ffHLmhYcuC" ON "core_role_permissions" USING btree ("entity_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_weEPxqlVPw" ON "core_role_permissions" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_flows__knowledge_files_source_id" ON "ai_agent_flows__knowledge_files" USING btree ("source_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_flows__knowledge_files_target_id" ON "ai_agent_flows__knowledge_files" USING btree ("target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_models__supported_tools_source_id" ON "ai_agent_models__supported_tools" USING btree ("source_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_agent_models__supported_tools_target_id" ON "ai_agent_models__supported_tools" USING btree ("target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages__attachments_source_id" ON "chat_messages__attachments" USING btree ("source_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages__attachments_target_id" ON "chat_messages__attachments" USING btree ("target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_packages__allowed_models_source_id" ON "plan_packages__allowed_models" USING btree ("source_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_packages__allowed_models_target_id" ON "plan_packages__allowed_models" USING btree ("target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_packages__allowed_tools_source_id" ON "plan_packages__allowed_tools" USING btree ("source_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_packages__allowed_tools_target_id" ON "plan_packages__allowed_tools" USING btree ("target_id" text_ops);--> statement-breakpoint
CREATE VIEW "public"."user_credit_balance" AS (SELECT row_number() OVER ()::text AS id, "user", balance, lifetime_purchased, lifetime_spent, last_transaction FROM ( SELECT core_credit_ledger."user", sum( CASE WHEN core_credit_ledger.type = 'credit'::text THEN core_credit_ledger.credits_changed ELSE - core_credit_ledger.credits_changed END) AS balance, sum( CASE WHEN core_credit_ledger.type = 'credit'::text AND core_credit_ledger.transaction_type = 'purchase'::text THEN core_credit_ledger.credits_changed ELSE 0::numeric END) AS lifetime_purchased, sum( CASE WHEN core_credit_ledger.type = 'debit'::text AND core_credit_ledger.transaction_type = 'usage'::text THEN core_credit_ledger.credits_changed ELSE 0::numeric END) AS lifetime_spent, max(core_credit_ledger.created) AS last_transaction FROM core_credit_ledger GROUP BY core_credit_ledger."user") balance_rows);--> statement-breakpoint
CREATE VIEW "public"."view_category_usage" AS (SELECT row_number() OVER ()::text AS id, category, day::text AS day, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger.category, core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger.category, (core_token_ledger.created::date)) category_daily);--> statement-breakpoint
CREATE VIEW "public"."view_chat_costs" AS (SELECT row_number() OVER ()::text AS id, chat, "user", total_cost_usd, total_input_tokens, total_output_tokens, total_messages, avg_latency_ms, models_used, first_message_at, last_message_at FROM ( SELECT chat_messages_debug.chat, min(chat_messages_debug."user") AS "user", sum(chat_messages_debug.cost_usd) AS total_cost_usd, sum(chat_messages_debug.input_tokens) AS total_input_tokens, sum(chat_messages_debug.output_tokens) AS total_output_tokens, count(*) AS total_messages, avg(chat_messages_debug.latency_ms) AS avg_latency_ms, string_agg(DISTINCT chat_messages_debug.model_id, ','::text) AS models_used, min(chat_messages_debug.created) AS first_message_at, max(chat_messages_debug.created) AS last_message_at FROM chat_messages_debug WHERE chat_messages_debug.role = 'assistant'::text GROUP BY chat_messages_debug.chat) chat_costs);--> statement-breakpoint
CREATE VIEW "public"."view_daily_usage" AS (SELECT row_number() OVER ()::text AS id, day::text AS day, total_cost FROM ( SELECT core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost FROM core_token_ledger GROUP BY (core_token_ledger.created::date)) daily_usage);--> statement-breakpoint
CREATE VIEW "public"."view_hourly_usage" AS (SELECT row_number() OVER ()::text AS id, to_char(hour_bucket, 'YYYY-MM-DD HH24:00:00'::text) AS hour, EXTRACT(dow FROM hour_bucket)::integer::text AS day_of_week, EXTRACT(hour FROM hour_bucket)::integer AS hour_of_day, total_cost, total_tokens, request_count FROM ( SELECT date_trunc('hour'::text, core_token_ledger.created) AS hour_bucket, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY (date_trunc('hour'::text, core_token_ledger.created))) hourly_usage);--> statement-breakpoint
CREATE VIEW "public"."view_model_daily_usage" AS (SELECT row_number() OVER ()::text AS id, model, provider, day::text AS day, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger.model, core_token_ledger.provider, core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger.model, core_token_ledger.provider, (core_token_ledger.created::date)) model_daily);--> statement-breakpoint
CREATE VIEW "public"."view_model_usage" AS (SELECT row_number() OVER ()::text AS id, model, provider, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger.model, core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger.model, core_token_ledger.provider) model_usage);--> statement-breakpoint
CREATE VIEW "public"."view_provider_usage" AS (SELECT row_number() OVER ()::text AS id, provider, total_cost, total_tokens FROM ( SELECT core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens FROM core_token_ledger GROUP BY core_token_ledger.provider) provider_usage);--> statement-breakpoint
CREATE VIEW "public"."view_top_spenders" AS (SELECT row_number() OVER ()::text AS id, "user", total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user") top_spenders);--> statement-breakpoint
CREATE VIEW "public"."view_user_daily_usage" AS (SELECT row_number() OVER ()::text AS id, "user", day::text AS day, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user", (core_token_ledger.created::date)) user_daily_usage);--> statement-breakpoint
CREATE VIEW "public"."view_user_model_usage" AS (SELECT row_number() OVER ()::text AS id, "user", model, provider, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", core_token_ledger.model, core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user", core_token_ledger.model, core_token_ledger.provider) user_model_usage);--> statement-breakpoint
CREATE VIEW "public"."view_user_provider_usage" AS (SELECT row_number() OVER ()::text AS id, "user", provider, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user", core_token_ledger.provider) user_provider_usage);--> statement-breakpoint
CREATE VIEW "public"."user_cost_stats" AS (SELECT ucb.id, ucb."user", ucb.balance AS current_balance, ucb.lifetime_purchased, ucb.lifetime_spent, COALESCE(ctl.lifetime_cost_usd, 0::numeric) AS lifetime_cost_usd, COALESCE(ctl.total_transactions, 0::bigint) AS total_token_transactions, COALESCE(ctl.total_tokens, 0::numeric) AS total_tokens FROM user_credit_balance ucb LEFT JOIN ( SELECT core_token_ledger."user", sum(core_token_ledger.cost_usd) AS lifetime_cost_usd, count(*) AS total_transactions, sum(core_token_ledger.tokens) AS total_tokens FROM core_token_ledger WHERE core_token_ledger."user" IS NOT NULL AND core_token_ledger."user" <> ''::text GROUP BY core_token_ledger."user") ctl ON ucb."user" = ctl."user");
*/