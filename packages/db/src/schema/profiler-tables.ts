import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  numeric,
  integer,
  index,
  foreignKey
} from 'drizzle-orm/pg-core';
import { profilerAgents, aiAgentModels } from './tables';

export const profilerExtractionLog = pgTable(
  'profiler_extraction_log',
  {
    id: text().primaryKey().notNull(),
    userId: text('user_id').notNull(),
    profilerAgentId: text('profiler_agent_id'),
    sourceType: text('source_type').notNull(),
    sourceMessageIds: jsonb('source_message_ids').$type<string[]>().default([]),
    modelUsed: text('model_used'),
    providerUsed: text('provider_used'),
    rawOutput: jsonb('raw_output'),
    profileFieldsWritten: jsonb('profile_fields_written'),
    profileFieldsSkipped: jsonb('profile_fields_skipped'),
    memoryNodesWritten: jsonb('memory_nodes_written'),
    memoryNodesSkipped: jsonb('memory_nodes_skipped'),
    schemaProposals: jsonb('schema_proposals'),
    attempts: jsonb('attempts').$type<unknown[]>().default([]),
    extractionDurationMs: numeric('extraction_duration_ms'),
    tokenCountInput: numeric('token_count_input'),
    tokenCountOutput: numeric('token_count_output'),
    costUsd: numeric('cost_usd'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow()
  },
  (table) => [
    index('idx_extraction_log_user').using('btree', table.userId),
    index('idx_extraction_log_created').using('btree', table.createdAt),
    index('idx_extraction_log_source').using('btree', table.sourceType),
    foreignKey({
      columns: [table.profilerAgentId],
      foreignColumns: [profilerAgents.id],
      name: 'fk_extraction_log_profiler_agent'
    }).onDelete('set null')
  ]
);

export const profilerModelChain = pgTable(
  'profiler_model_chain',
  {
    id: text().primaryKey().notNull(),
    profilerAgentId: text('profiler_agent_id').notNull(),
    modelId: text('model_id').notNull(),
    priority: integer().notNull().default(0),
    temperature: numeric().default('0.3'),
    maxTokens: integer('max_tokens').default(2048),
    timeoutMs: integer('timeout_ms').default(30000),
    retryCount: integer('retry_count').default(1),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow()
  },
  (table) => [
    index('idx_model_chain_profiler').using('btree', table.profilerAgentId),
    index('idx_model_chain_priority').using('btree', table.profilerAgentId, table.priority),
    foreignKey({
      columns: [table.profilerAgentId],
      foreignColumns: [profilerAgents.id],
      name: 'fk_model_chain_profiler_agent'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.modelId],
      foreignColumns: [aiAgentModels.id],
      name: 'fk_model_chain_model'
    }).onDelete('cascade')
  ]
);

export const profilerSchemaProposals = pgTable(
  'profiler_schema_proposals',
  {
    id: text().primaryKey().notNull(),
    userId: text('user_id').notNull(),
    extractionLogId: text('extraction_log_id'),
    organizationId: text('organization_id'),
    suggestedKey: text('suggested_key').notNull(),
    suggestedSection: text('suggested_section'),
    label: text(),
    exampleValues: jsonb('example_values'),
    reason: text(),
    confidence: numeric(),
    status: text().notNull().default('pending'),
    promotedToField: text('promoted_to_field'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow()
  },
  (table) => [
    index('idx_schema_proposals_user').using('btree', table.userId),
    index('idx_schema_proposals_status').using('btree', table.status),
    foreignKey({
      columns: [table.extractionLogId],
      foreignColumns: [profilerExtractionLog.id],
      name: 'fk_schema_proposals_extraction_log'
    }).onDelete('set null')
  ]
);
