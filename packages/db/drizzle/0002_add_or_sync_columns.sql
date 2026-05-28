ALTER TABLE "ai_agent_models" ADD COLUMN "or_model_id" text;--> statement-breakpoint
ALTER TABLE "ai_agent_models" ADD COLUMN "or_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_agent_models" ADD COLUMN "or_raw" jsonb;--> statement-breakpoint
ALTER TABLE "ai_agent_models" ADD COLUMN "sync_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ai_agent_models_or_model_id" ON "ai_agent_models" USING btree ("or_model_id" text_ops) WHERE (or_model_id IS NOT NULL);--> statement-breakpoint
UPDATE "ai_agent_models" SET "sync_status" = 'local_only' WHERE "sync_status" IS NULL;