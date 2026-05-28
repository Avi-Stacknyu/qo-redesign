-- Remove per-agent profiler binding from ai_agents
DROP INDEX IF EXISTS "idx_ai_agents_profiler_agent";--> statement-breakpoint
ALTER TABLE "ai_agents" DROP CONSTRAINT IF EXISTS "fk_ai_agents_profiler_agent_profiler_agents";--> statement-breakpoint
ALTER TABLE "ai_agents" DROP COLUMN IF EXISTS "profiler_agent";--> statement-breakpoint

-- Remove legacy columns from profiler_agents
ALTER TABLE "profiler_agents" DROP COLUMN IF EXISTS "schema";--> statement-breakpoint
ALTER TABLE "profiler_agents" DROP COLUMN IF EXISTS "is_general_fallback";--> statement-breakpoint

-- Add tag_rule column for tag-based profiler matching
ALTER TABLE "profiler_agents" ADD COLUMN "tag_rule" jsonb;
