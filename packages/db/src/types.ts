/**
 * Drizzle row types ($inferSelect) and enum constants for all tables
 * referenced by consumer apps (admin, cf-worker, web).
 *
 * Prefer importing from '@repo/db/types'. The package root also re-exports
 * the database client, which browser bundles should not touch.
 */
export type { Database } from './client';

import type {
  aiAgentModels,
  aiPricingRates,
  aiPrompts,
  aiAgents,
  aiProviders,
  aiSystemUploads,
  aiTools,
  analyticalTools,
  chatMessages,
  chats,
  configFeatureFlags,
  configTagCatalog,
  configTagNamespaces,
  coreCreditLedger,
  coreRolePermissions,
  dashboardWidgets,
  planPackages,
  planPaymentTransactions,
  users
} from './schema/tables';

// ── Row Types ($inferSelect) ─────────────────────────────────────────────────

export type AiAgentModelRow = typeof aiAgentModels.$inferSelect;
export type AiPricingRateRow = typeof aiPricingRates.$inferSelect;
export type AiPromptRow = typeof aiPrompts.$inferSelect;
export type AnalyticalToolRow = typeof analyticalTools.$inferSelect;
export type AiAgentRow = typeof aiAgents.$inferSelect;
export type AiProviderRow = typeof aiProviders.$inferSelect;
export type AiSystemUploadRow = typeof aiSystemUploads.$inferSelect;
export type AiToolRow = typeof aiTools.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type ChatRow = typeof chats.$inferSelect;
export type ConfigFeatureFlagRow = typeof configFeatureFlags.$inferSelect;
export type ConfigTagCatalogRow = typeof configTagCatalog.$inferSelect;
export type ConfigTagNamespaceRow = typeof configTagNamespaces.$inferSelect;
export type CoreCreditLedgerRow = typeof coreCreditLedger.$inferSelect;
export type CoreRolePermissionRow = typeof coreRolePermissions.$inferSelect;
export type DashboardWidgetRow = typeof dashboardWidgets.$inferSelect;
export type PlanPackageRow = typeof planPackages.$inferSelect;
export type PlanPaymentTransactionRow = typeof planPaymentTransactions.$inferSelect;
export type UserRow = typeof users.$inferSelect;

// ── Enum Constants ───────────────────────────────────────────────────────────
// Replace PB *Options enums with const objects + string union types.
// The DB schema uses plain text() columns — no pgEnum — so these are
// application-level constants only.

export const CreditLedgerType = { credit: 'credit', debit: 'debit' } as const;
export type CreditLedgerType = (typeof CreditLedgerType)[keyof typeof CreditLedgerType];

export const CreditLedgerTransactionType = {
  purchase: 'purchase',
  usage: 'usage',
  refund: 'refund',
  bonus: 'bonus',
  adjustment: 'adjustment'
} as const;
export type CreditLedgerTransactionType =
  (typeof CreditLedgerTransactionType)[keyof typeof CreditLedgerTransactionType];

export const PaymentProvider = { stripe: 'stripe', admin: 'admin' } as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  completed: 'completed',
  pending: 'pending',
  failed: 'failed',
  refunded: 'refunded'
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const AiAgentModelServiceType = {
  generation: 'generation',
  embedding: 'embedding',
  transcription: 'transcription',
  extraction: 'extraction',
  reranking: 'reranking'
} as const;
export type AiAgentModelServiceType =
  (typeof AiAgentModelServiceType)[keyof typeof AiAgentModelServiceType];

export const AiAgentModelSyncStatus = {
  synced: 'synced',
  override: 'override',
  deprecated: 'deprecated',
  local_only: 'local_only'
} as const;
export type AiAgentModelSyncStatus =
  (typeof AiAgentModelSyncStatus)[keyof typeof AiAgentModelSyncStatus];

export const AiToolCategory = {
  search: 'search',
  code: 'code',
  files: 'files',
  memory: 'memory',
  notes: 'notes'
} as const;
export type AiToolCategory = (typeof AiToolCategory)[keyof typeof AiToolCategory];

export const AiToolType = { builtin: 'builtin', sdk: 'sdk' } as const;
export type AiToolType = (typeof AiToolType)[keyof typeof AiToolType];

export const AnalyticalToolCategory = {
  analyzer: 'analyzer',
  calculator: 'calculator',
  forecaster: 'forecaster',
  optimizer: 'optimizer'
} as const;
export type AnalyticalToolCategory =
  (typeof AnalyticalToolCategory)[keyof typeof AnalyticalToolCategory];

export const DashboardWidgetDefaultSize = { sm: 'sm', md: 'md', lg: 'lg' } as const;
export type DashboardWidgetDefaultSize =
  (typeof DashboardWidgetDefaultSize)[keyof typeof DashboardWidgetDefaultSize];

export const ProfilerAgentStatus = { active: 'active', inactive: 'inactive' } as const;
export type ProfilerAgentStatus = (typeof ProfilerAgentStatus)[keyof typeof ProfilerAgentStatus];

export const UserTierOverrideType = { model: 'model', tool: 'tool', feature: 'feature' } as const;
export type UserTierOverrideType = (typeof UserTierOverrideType)[keyof typeof UserTierOverrideType];
