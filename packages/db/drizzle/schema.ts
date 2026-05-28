import {
  pgTable,
  index,
  text,
  timestamp,
  jsonb,
  boolean,
  numeric,
  uniqueIndex,
  type AnyPgColumn,
  foreignKey,
  bigint,
  primaryKey,
  integer,
  pgView
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const analyticalTools = pgTable(
  'analytical_tools',
  {
    category: text(),
    computationType: text('computation_type'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    displayName: text('display_name'),
    icon: text(),
    id: text().primaryKey().notNull(),
    inputSchema: jsonb('input_schema'),
    isActive: boolean('is_active'),
    outputConfig: jsonb('output_config'),
    tagRule: jsonb('tag_rule'),
    toolKey: text('tool_key'),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_analytical_tools_active_category').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.category.asc().nullsLast().op('bool_ops')
    ),
    index('idx_analytical_tools_active_key').using(
      'btree',
      table.isActive.asc().nullsLast().op('bool_ops'),
      table.toolKey.asc().nullsLast().op('text_ops')
    )
  ]
);

export const configDynamicAttributes = pgTable(
  'config_dynamic_attributes',
  {
    allowedUsages: jsonb('allowed_usages'),
    allowedValues: jsonb('allowed_values'),
    attributeKey: text('attribute_key'),
    category: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    dataType: text('data_type'),
    defaultValue: jsonb('default_value'),
    description: text(),
    displayName: text('display_name'),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    isRequiredForAgents: boolean('is_required_for_agents'),
    sourceConfig: jsonb('source_config'),
    sourceType: text('source_type'),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_config_dynamic_attributes_active_cat_name').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.category.asc().nullsLast().op('text_ops'),
      table.displayName.asc().nullsLast().op('text_ops')
    )
  ]
);

export const configFeatureFlags = pgTable(
  'config_feature_flags',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    displayName: text('display_name'),
    flagKey: text('flag_key'),
    id: text().primaryKey().notNull(),
    isEnabled: boolean('is_enabled'),
    tagRule: jsonb('tag_rule'),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_config_feature_flags_enabled').using(
      'btree',
      table.isEnabled.asc().nullsLast().op('bool_ops')
    ),
    index('idx_config_feature_flags_key').using(
      'btree',
      table.flagKey.asc().nullsLast().op('text_ops')
    )
  ]
);

export const configOnboardingQuestions = pgTable(
  'config_onboarding_questions',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    options: jsonb(),
    question: text(),
    type: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    sidebarTitle: text('sidebar_title'),
    factKey: text('fact_key'),
    order: numeric(),
    enabled: boolean().default(true),
    required: boolean().default(true),
    showWhen: jsonb('show_when'),
    group: text(),
    metadata: jsonb()
  },
  (table) => [
    index('idx_config_onboarding_questions_order').using(
      'btree',
      table.order.asc().nullsLast().op('numeric_ops')
    )
  ]
);

export const configProfileSchema = pgTable('config_profile_schema', {
  created: timestamp({ withTimezone: true, mode: 'string' }),
  description: text(),
  id: text().primaryKey().notNull(),
  isActive: boolean('is_active'),
  name: text(),
  schema: jsonb(),
  updated: timestamp({ withTimezone: true, mode: 'string' }),
  version: numeric()
});

export const configTagRulePresets = pgTable(
  'config_tag_rule_presets',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    id: text().primaryKey().notNull(),
    name: text(),
    tagRule: jsonb('tag_rule'),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_config_tag_rule_presets_name').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops')
    )
  ]
);

export const dashboardTemplates = pgTable(
  'dashboard_templates',
  {
    category: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    defaultWidgets: jsonb('default_widgets'),
    description: text(),
    icon: text(),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    name: text(),
    previewImage: text('preview_image'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    tagRule: jsonb('tag_rule')
  },
  (table) => [
    index('idx_dashboard_templates_is_active').using(
      'btree',
      table.isActive.asc().nullsLast().op('bool_ops')
    )
  ]
);

export const dashboardWidgets = pgTable(
  'dashboard_widgets',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    defaultConfig: jsonb('default_config'),
    defaultSize: text('default_size'),
    description: text(),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    name: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    widgetType: text('widget_type'),
    configFields: jsonb('config_fields'),
    icon: text(),
    category: text(),
    baseType: text('base_type'),
    lockedConfig: jsonb('locked_config'),
    tagRule: jsonb('tag_rule')
  },
  (table) => [
    uniqueIndex('idx_dashboard_widgets_type').using(
      'btree',
      table.widgetType.asc().nullsLast().op('text_ops')
    )
  ]
);

export const dataSources = pgTable('data_sources', {
  config: jsonb(),
  created: timestamp({ withTimezone: true, mode: 'string' }),
  description: text(),
  displayName: text('display_name'),
  id: text().primaryKey().notNull(),
  isActive: boolean('is_active'),
  sourceKey: text('source_key'),
  sourceType: text('source_type'),
  tagRule: jsonb('tag_rule'),
  updated: timestamp({ withTimezone: true, mode: 'string' })
});

export const aiAgents = pgTable(
  'ai_agents',
  {
    description: text(),
    id: text().primaryKey().notNull(),
    name: text(),
    status: text(),
    currentFlow: text('current_flow'),
    costMultiplier: numeric('cost_multiplier'),
    isUniversal: boolean('is_universal'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    avatar: text(),
    tagRule: jsonb('tag_rule'),
    profilerAgent: text('profiler_agent'),
    purpose: text()
  },
  (table) => [
    index('idx_ai_agents_current_flow').using(
      'btree',
      table.currentFlow.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_agents_profiler_agent').using(
      'btree',
      table.profilerAgent.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_agents_status_name').using(
      'btree',
      table.status.asc().nullsLast().op('text_ops'),
      table.name.asc().nullsLast().op('text_ops')
    ),
    index('idx_fLk1j2PGEZ').using('btree', table.status.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.currentFlow],
      foreignColumns: [aiAgentFlows.id],
      name: 'fk_ai_agents_current_flow_ai_agent_flows'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.profilerAgent],
      foreignColumns: [profilerAgents.id],
      name: 'fk_ai_agents_profiler_agent_profiler_agents'
    }).onDelete('set null')
  ]
);

export const aiAgentFlows = pgTable(
  'ai_agent_flows',
  {
    isActive: boolean('is_active'),
    agent: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    changeLog: text('change_log'),
    id: text().primaryKey().notNull(),
    flowData: jsonb('flow_data'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    version: numeric(),
    compiledConfig: jsonb('compiled_config'),
    validationStatus: text('validation_status'),
    validationErrors: jsonb('validation_errors')
  },
  (table) => [
    index('idx_521isOEG0d').using('btree', table.agent.asc().nullsLast().op('text_ops')),
    index('idx_7ltrrk4dWU').using('btree', table.isActive.asc().nullsLast().op('bool_ops')),
    index('idx_a3ouc9yUaP').using(
      'btree',
      table.agent.asc().nullsLast().op('text_ops'),
      table.version.asc().nullsLast().op('numeric_ops')
    ),
    index('idx_ai_agent_flows_agent').using('btree', table.agent.asc().nullsLast().op('text_ops')),
    index('idx_ai_agent_flows_agent_is_active').using(
      'btree',
      table.agent.asc().nullsLast().op('text_ops'),
      table.isActive.asc().nullsLast().op('bool_ops')
    ),
    foreignKey({
      columns: [table.agent],
      foreignColumns: [aiAgents.id],
      name: 'fk_ai_agent_flows_agent_ai_agents'
    }).onDelete('cascade')
  ]
);

export const aiSystemUploads = pgTable(
  'ai_system_uploads',
  {
    id: text().primaryKey().notNull(),
    meta: jsonb(),
    name: text(),
    type: text(),
    size: numeric(),
    vectors: jsonb(),
    description: text(),
    path: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_ai_system_uploads_created').using(
      'btree',
      table.created.desc().nullsFirst().op('timestamptz_ops')
    )
  ]
);

export const aiPricingRates = pgTable(
  'ai_pricing_rates',
  {
    cachedInputPricePer1M: numeric('cached_input_price_per_1m'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true, mode: 'string' }),
    effectiveUntil: timestamp('effective_until', { withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    inputPricePer1M: numeric('input_price_per_1m'),
    isActive: boolean('is_active'),
    notes: text(),
    outputPricePer1M: numeric('output_price_per_1m'),
    pricePerCall: numeric('price_per_call'),
    pricePerCharacter: numeric('price_per_character'),
    pricePerImage: numeric('price_per_image'),
    pricePerMinute: numeric('price_per_minute'),
    pricePerSecond: numeric('price_per_second'),
    reasoningPricePer1M: numeric('reasoning_price_per_1m'),
    tier: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_ai_pricing_rates_created').using(
      'btree',
      table.created.desc().nullsFirst().op('timestamptz_ops')
    )
  ]
);

export const aiAgentModels = pgTable(
  'ai_agent_models',
  {
    id: text().primaryKey().notNull(),
    modelId: text('model_id'),
    displayName: text('display_name'),
    description: text(),
    isActive: boolean('is_active'),
    isEnabled: boolean('is_enabled'),
    currentPricing: text('current_pricing'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    provider: text(),
    optionsSchema: jsonb('options_schema'),
    defaultOptions: jsonb('default_options'),
    capabilities: jsonb(),
    contextWindow: numeric('context_window'),
    maxOutputTokens: numeric('max_output_tokens'),
    isSystemDefault: boolean('is_system_default'),
    tagRule: jsonb('tag_rule'),
    configKey: text('config_key'),
    serviceType: text('service_type')
  },
  (table) => [
    index('idx_GCcG9MmEQV').using('btree', table.isEnabled.asc().nullsLast().op('bool_ops')),
    index('idx_GhMQf4iT2O').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.modelId.asc().nullsLast().op('bool_ops')
    ),
    index('idx_QyhDW7n5UB').using('btree', table.provider.asc().nullsLast().op('text_ops')),
    uniqueIndex('idx_ai_agent_models_active_config_key')
      .using('btree', table.configKey.asc().nullsLast().op('text_ops'))
      .where(sql`((config_key <> ''::text) AND (is_active = true))`),
    index('idx_ai_agent_models_active_enabled_name').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.isEnabled.asc().nullsLast().op('text_ops'),
      table.displayName.asc().nullsLast().op('bool_ops')
    ),
    index('idx_ai_agent_models_current_pricing').using(
      'btree',
      table.currentPricing.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_agent_models_model_id_active').using(
      'btree',
      table.modelId.asc().nullsLast().op('text_ops'),
      table.isActive.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_agent_models_provider').using(
      'btree',
      table.provider.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.currentPricing],
      foreignColumns: [aiPricingRates.id],
      name: 'fk_ai_agent_models_current_pricing_ai_pricing_rates'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.provider],
      foreignColumns: [aiProviders.id],
      name: 'fk_ai_agent_models_provider_ai_providers'
    }).onDelete('set null')
  ]
);

export const aiProviders = pgTable(
  'ai_providers',
  {
    baseUrl: text('base_url'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    defaultHeaders: jsonb('default_headers'),
    displayName: text('display_name'),
    docsUrl: text('docs_url'),
    envKeyName: text('env_key_name'),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    logo: text(),
    providerKey: text('provider_key'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    websiteUrl: text('website_url')
  },
  (table) => [
    index('idx_ai_providers_active_name').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.displayName.asc().nullsLast().op('text_ops')
    )
  ]
);

export const aiTools = pgTable(
  'ai_tools',
  {
    category: text(),
    configSchema: jsonb('config_schema'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    currentPricing: text('current_pricing'),
    defaultConfig: jsonb('default_config'),
    description: text(),
    displayName: text('display_name'),
    docsUrl: text('docs_url'),
    icon: text(),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    provider: text(),
    sdkToolName: text('sdk_tool_name'),
    toolKey: text('tool_key'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    toolType: text('tool_type'),
    executionConfig: jsonb('execution_config'),
    isEnabled: boolean('is_enabled')
  },
  (table) => [
    index('idx_ai_tools_active_category_name').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.category.asc().nullsLast().op('bool_ops'),
      table.displayName.asc().nullsLast().op('bool_ops')
    ),
    index('idx_ai_tools_current_pricing').using(
      'btree',
      table.currentPricing.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_tools_is_active_is_enabled').using(
      'btree',
      table.isActive.asc().nullsLast().op('bool_ops'),
      table.isEnabled.asc().nullsLast().op('bool_ops')
    ),
    index('idx_ai_tools_provider').using('btree', table.provider.asc().nullsLast().op('text_ops')),
    index('idx_ai_tools_tool_key_is_active').using(
      'btree',
      table.toolKey.asc().nullsLast().op('bool_ops'),
      table.isActive.asc().nullsLast().op('bool_ops')
    ),
    foreignKey({
      columns: [table.currentPricing],
      foreignColumns: [aiPricingRates.id],
      name: 'fk_ai_tools_current_pricing_ai_pricing_rates'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.provider],
      foreignColumns: [aiProviders.id],
      name: 'fk_ai_tools_provider_ai_providers'
    }).onDelete('set null')
  ]
);

export const profilerAgents = pgTable(
  'profiler_agents',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    id: text().primaryKey().notNull(),
    maxTokens: numeric('max_tokens'),
    model: text(),
    name: text(),
    schema: jsonb(),
    status: text(),
    systemPrompt: text('system_prompt'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    focusSections: jsonb('focus_sections'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    priority: bigint({ mode: 'number' }),
    isGeneralFallback: boolean('is_general_fallback')
  },
  (table) => [
    index('idx_profiler_agents_model').using('btree', table.model.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.model],
      foreignColumns: [aiAgentModels.id],
      name: 'fk_profiler_agents_model_ai_agent_models'
    }).onDelete('set null')
  ]
);

export const users = pgTable(
  'users',
  {
    avatar: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    email: text(),
    emailVisibility: boolean(),
    id: text().primaryKey().notNull(),
    name: text(),
    password: text(),
    tokenKey: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    verified: boolean(),
    role: text(),
    onboardingComplete: boolean('onboarding_complete'),
    acceptPolicies: boolean('accept_policies'),
    accountStatus: text('account_status'),
    trialClaimed: boolean('trial_claimed'),
    plan: text(),
    stripeCustomerId: text('stripe_customer_id')
  },
  (table) => [
    uniqueIndex('idx_email__pb_users_auth_')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`(email <> ''::text)`),
    uniqueIndex('idx_tokenKey__pb_users_auth_').using(
      'btree',
      table.tokenKey.asc().nullsLast().op('text_ops')
    ),
    index('idx_users_account_status').using(
      'btree',
      table.accountStatus.asc().nullsLast().op('text_ops')
    ),
    index('idx_users_plan').using('btree', table.plan.asc().nullsLast().op('text_ops')),
    index('idx_users_role').using('btree', table.role.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.role],
      foreignColumns: [coreRolePermissions.id],
      name: 'fk_users_role_core_role_permissions'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.plan],
      foreignColumns: [planPackages.id],
      name: 'fk_users_plan_plan_packages'
    }).onDelete('set null')
  ]
);

export const aiComposioConnections = pgTable(
  'ai_composio_connections',
  {
    connectedAccount: text('connected_account'),
    connectionId: text('connection_id'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
    scopes: jsonb(),
    status: text(),
    toolkitName: text('toolkit_name'),
    toolkitSlug: text('toolkit_slug'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    useCount: numeric('use_count'),
    user: text()
  },
  (table) => [
    index('idx_ai_composio_connections_connid_user').using(
      'btree',
      table.connectionId.asc().nullsLast().op('text_ops'),
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_composio_connections_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_composio_connections_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_ai_composio_connections_user_users'
    }).onDelete('cascade')
  ]
);

export const chats = pgTable(
  'chats',
  {
    id: text().primaryKey().notNull(),
    meta: jsonb(),
    title: text(),
    source: text(),
    agent: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    index('idx_chats_agent').using('btree', table.agent.asc().nullsLast().op('text_ops')),
    index('idx_chats_agent_source_updated').using(
      'btree',
      table.agent.asc().nullsLast().op('text_ops'),
      table.source.asc().nullsLast().op('timestamptz_ops'),
      table.updated.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_chats_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_chats_user_source_updated').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.source.asc().nullsLast().op('timestamptz_ops'),
      table.updated.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_tRoU9hSo9D').using('btree', table.user.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.agent],
      foreignColumns: [aiAgents.id],
      name: 'fk_chats_agent_ai_agents'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_chats_user_users'
    }).onDelete('cascade')
  ]
);

export const chatFileReferences = pgTable(
  'chat_file_references',
  {
    chat: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    file: text(),
    id: text().primaryKey().notNull(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    index('idx_chat_file_references_chat').using(
      'btree',
      table.chat.asc().nullsLast().op('text_ops')
    ),
    index('idx_chat_file_references_file').using(
      'btree',
      table.file.asc().nullsLast().op('text_ops')
    ),
    index('idx_chat_file_references_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.chat],
      foreignColumns: [chats.id],
      name: 'fk_chat_file_references_chat_chats'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.file],
      foreignColumns: [userUploads.id],
      name: 'fk_chat_file_references_file_user_uploads'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_chat_file_references_user_users'
    }).onDelete('cascade')
  ]
);

export const userUploads = pgTable(
  'user_uploads',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    name: text(),
    path: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    type: text(),
    meta: jsonb(),
    user: text(),
    size: numeric(),
    vectors: jsonb(),
    shareWithAgent: boolean('share_with_agent'),
    shareWithAdmin: boolean('share_with_admin'),
    shareWithManager: boolean('share_with_manager')
  },
  (table) => [
    index('idx_uf2p0zUSom').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_uploads_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_uploads_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    ),
    index('idx_user_uploads_user_share_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.shareWithAgent.asc().nullsLast().op('bool_ops'),
      table.created.desc().nullsFirst().op('bool_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_uploads_user_users'
    }).onDelete('set null')
  ]
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    chat: text(),
    id: text().primaryKey().notNull(),
    meta: jsonb(),
    role: text(),
    message: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_JuAh9wYK8g').using(
      'btree',
      table.chat.asc().nullsLast().op('timestamptz_ops'),
      table.created.asc().nullsLast().op('text_ops')
    ),
    index('idx_chat_messages_chat').using('btree', table.chat.asc().nullsLast().op('text_ops')),
    index('idx_chat_messages_chat_role').using(
      'btree',
      table.chat.asc().nullsLast().op('text_ops'),
      table.role.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.chat],
      foreignColumns: [chats.id],
      name: 'fk_chat_messages_chat_chats'
    }).onDelete('cascade')
  ]
);

export const chatMessagesDebug = pgTable(
  'chat_messages_debug',
  {
    agent: text(),
    assistantResponse: text('assistant_response'),
    chat: text(),
    contextData: jsonb('context_data'),
    costUsd: numeric('cost_usd'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    fullMessagesJson: jsonb('full_messages_json'),
    id: text().primaryKey().notNull(),
    inputTokens: numeric('input_tokens'),
    latencyMs: numeric('latency_ms'),
    modelId: text('model_id'),
    outputTokens: numeric('output_tokens'),
    provider: text(),
    role: text(),
    sequenceNumber: numeric('sequence_number'),
    sourceMessage: text('source_message'),
    systemPrompt: text('system_prompt'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text(),
    userMessage: text('user_message')
  },
  (table) => [
    index('idx_chat_messages_debug_agent').using(
      'btree',
      table.agent.asc().nullsLast().op('text_ops')
    ),
    index('idx_chat_messages_debug_chat').using(
      'btree',
      table.chat.asc().nullsLast().op('text_ops')
    ),
    index('idx_chat_messages_debug_chat_created').using(
      'btree',
      table.chat.asc().nullsLast().op('text_ops'),
      table.created.asc().nullsLast().op('timestamptz_ops')
    ),
    index('idx_chat_messages_debug_source_message').using(
      'btree',
      table.sourceMessage.asc().nullsLast().op('text_ops')
    ),
    index('idx_chat_messages_debug_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_ktmEOYS2LB').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_yZtlyMAMed').using('btree', table.chat.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.agent],
      foreignColumns: [aiAgents.id],
      name: 'fk_chat_messages_debug_agent_ai_agents'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.chat],
      foreignColumns: [chats.id],
      name: 'fk_chat_messages_debug_chat_chats'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.sourceMessage],
      foreignColumns: [chatMessages.id],
      name: 'fk_chat_messages_debug_source_message_chat_messages'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_chat_messages_debug_user_users'
    }).onDelete('set null')
  ]
);

export const configOnboarding = pgTable(
  'config_onboarding',
  {
    cacheTtlMs: numeric('cache_ttl_ms'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    enabled: boolean(),
    id: text().primaryKey().notNull(),
    maxAiQuestions: numeric('max_ai_questions'),
    model: text(),
    sessionTimeoutMs: numeric('session_timeout_ms'),
    systemPrompt: text('system_prompt'),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_config_onboarding_enabled_created').using(
      'btree',
      table.enabled.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('bool_ops')
    ),
    index('idx_config_onboarding_model').using(
      'btree',
      table.model.asc().nullsLast().op('text_ops')
    ),
    index('idx_config_onboarding_system_prompt').using(
      'btree',
      table.systemPrompt.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.model],
      foreignColumns: [aiAgentModels.id],
      name: 'fk_config_onboarding_model_ai_agent_models'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.systemPrompt],
      foreignColumns: [aiPrompts.id],
      name: 'fk_config_onboarding_system_prompt_ai_prompts'
    }).onDelete('set null')
  ]
);

export const aiPrompts = pgTable(
  'ai_prompts',
  {
    category: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    displayName: text('display_name'),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    promptKey: text('prompt_key'),
    promptTemplate: text('prompt_template'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    version: bigint({ mode: 'number' }),
    changeNotes: text('change_notes')
  },
  (table) => [
    index('idx_ai_prompts_active_category_key').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.category.asc().nullsLast().op('bool_ops'),
      table.promptKey.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_prompts_category_display_name').using(
      'btree',
      table.category.asc().nullsLast().op('text_ops'),
      table.displayName.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_prompts_key_active_created').using(
      'btree',
      table.promptKey.asc().nullsLast().op('bool_ops'),
      table.isActive.asc().nullsLast().op('bool_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    )
  ]
);

export const configTagNamespaces = pgTable('config_tag_namespaces', {
  colorClass: text('color_class'),
  created: timestamp({ withTimezone: true, mode: 'string' }),
  description: text(),
  displayName: text('display_name'),
  icon: text(),
  id: text().primaryKey().notNull(),
  isAssignableOnboarding: boolean('is_assignable_onboarding'),
  isUserEditable: boolean('is_user_editable'),
  name: text(),
  sortOrder: numeric('sort_order'),
  updated: timestamp({ withTimezone: true, mode: 'string' })
});

export const configTagCatalog = pgTable(
  'config_tag_catalog',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    id: text().primaryKey().notNull(),
    tag: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    namespace: text()
  },
  (table) => [
    index('idx_config_tag_catalog_namespace').using(
      'btree',
      table.namespace.asc().nullsLast().op('text_ops')
    ),
    index('idx_config_tag_catalog_namespace_tag').using(
      'btree',
      table.namespace.asc().nullsLast().op('text_ops'),
      table.tag.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.namespace],
      foreignColumns: [configTagNamespaces.id],
      name: 'fk_config_tag_catalog_namespace_config_tag_namespaces'
    }).onDelete('set null')
  ]
);

export const planPaymentTransactions = pgTable(
  'plan_payment_transactions',
  {
    amount: numeric(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    currency: text(),
    id: text().primaryKey().notNull(),
    meta: jsonb(),
    notes: text(),
    plan: text(),
    provider: text(),
    providerPaymentId: text('provider_payment_id'),
    status: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    index('idx_2Vm6H14ynz').using('btree', table.plan.asc().nullsLast().op('text_ops')),
    index('idx_AJ5O28kjCz').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.status.asc().nullsLast().op('text_ops')
    ),
    index('idx_EuALTNhOhY').using('btree', table.status.asc().nullsLast().op('text_ops')),
    index('idx_HQ1rzz73qm').using('btree', table.provider.asc().nullsLast().op('text_ops')),
    index('idx_VjIO2SUm4n').using('btree', table.user.asc().nullsLast().op('text_ops')),
    uniqueIndex('idx_m2tzt9FM9l').using(
      'btree',
      table.providerPaymentId.asc().nullsLast().op('text_ops')
    ),
    index('idx_plan_payment_transactions_plan').using(
      'btree',
      table.plan.asc().nullsLast().op('text_ops')
    ),
    index('idx_plan_payment_transactions_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_plan_payment_transactions_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    foreignKey({
      columns: [table.plan],
      foreignColumns: [planPackages.id],
      name: 'fk_plan_payment_transactions_plan_plan_packages'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_plan_payment_transactions_user_users'
    }).onDelete('set null')
  ]
);

export const coreCreditLedger = pgTable(
  'core_credit_ledger',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    creditsChanged: numeric('credits_changed'),
    description: text(),
    id: text().primaryKey().notNull(),
    metadata: jsonb(),
    notes: text(),
    paymentTnx: text('payment_tnx'),
    tokenEntry: text('token_entry'),
    type: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text(),
    balanceBefore: numeric('balance_before'),
    balanceAfter: numeric('balance_after'),
    transactionType: text('transaction_type'),
    pricingRateId: text('pricing_rate_id')
  },
  (table) => [
    index('idx_core_credit_ledger_payment_tnx').using(
      'btree',
      table.paymentTnx.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_credit_ledger_pricing_rate_id').using(
      'btree',
      table.pricingRateId.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_credit_ledger_token_entry').using(
      'btree',
      table.tokenEntry.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_credit_ledger_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_credit_ledger_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_core_credit_ledger_user_type_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.type.asc().nullsLast().op('text_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    ),
    foreignKey({
      columns: [table.paymentTnx],
      foreignColumns: [planPaymentTransactions.id],
      name: 'fk_core_credit_ledger_payment_tnx_plan_payment_transactions'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.tokenEntry],
      foreignColumns: [coreTokenLedger.id],
      name: 'fk_core_credit_ledger_token_entry_core_token_ledger'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_core_credit_ledger_user_users'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.pricingRateId],
      foreignColumns: [aiPricingRates.id],
      name: 'fk_core_credit_ledger_pricing_rate_id_ai_pricing_rates'
    }).onDelete('set null')
  ]
);

export const coreTokenLedger = pgTable(
  'core_token_ledger',
  {
    id: text().primaryKey().notNull(),
    user: text(),
    agent: text(),
    model: text(),
    provider: text(),
    category: text(),
    messageId: text('message_id'),
    chunkIndex: numeric('chunk_index'),
    direction: text(),
    tokens: numeric(),
    costUsd: numeric('cost_usd'),
    meta: jsonb(),
    eventTime: timestamp('event_time', { withTimezone: true, mode: 'string' }),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    pricingRateId: text('pricing_rate_id'),
    chat: text()
  },
  (table) => [
    index('idx_core_token_ledger_agent').using(
      'btree',
      table.agent.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_token_ledger_chat').using('btree', table.chat.asc().nullsLast().op('text_ops')),
    index('idx_core_token_ledger_created').using(
      'btree',
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_core_token_ledger_model').using(
      'btree',
      table.model.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_token_ledger_pricing_rate_id').using(
      'btree',
      table.pricingRateId.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_token_ledger_provider').using(
      'btree',
      table.provider.asc().nullsLast().op('text_ops')
    ),
    index('idx_core_token_ledger_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_core_token_ledger_user_category_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.category.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    ),
    index('idx_core_token_ledger_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_core_token_ledger_user_users'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.agent],
      foreignColumns: [aiAgents.id],
      name: 'fk_core_token_ledger_agent_ai_agents'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.pricingRateId],
      foreignColumns: [aiPricingRates.id],
      name: 'fk_core_token_ledger_pricing_rate_id_ai_pricing_rates'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.chat],
      foreignColumns: [chats.id],
      name: 'fk_core_token_ledger_chat_chats'
    }).onDelete('set null')
  ]
);

export const creditExchangeRates = pgTable(
  'credit_exchange_rates',
  {
    changedBy: text('changed_by'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    effectiveFrom: timestamp('effective_from', { withTimezone: true, mode: 'string' }),
    effectiveUntil: timestamp('effective_until', { withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    notes: text(),
    rate: numeric(),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_credit_exchange_rates_active_effective').using(
      'btree',
      table.isActive.asc().nullsLast().op('timestamptz_ops'),
      table.effectiveFrom.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_credit_exchange_rates_changed_by').using(
      'btree',
      table.changedBy.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.changedBy],
      foreignColumns: [users.id],
      name: 'fk_credit_exchange_rates_changed_by_users'
    }).onDelete('set null')
  ]
);

export const planPackages = pgTable(
  'plan_packages',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    credits: numeric(),
    description: text(),
    highlight: boolean(),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    notIncludedPoints: text('not_included_points'),
    points: text(),
    productId: text('product_id'),
    provider: text(),
    subtitle: text(),
    title: text(),
    type: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    isArchived: boolean('is_archived'),
    isSubscription: boolean('is_subscription'),
    fallbackModel: text('fallback_model'),
    stripePriceId: text('stripe_price_id'),
    grantedTags: jsonb('granted_tags')
  },
  (table) => [
    index('idx_DySQB5eL9I').using(
      'btree',
      table.isActive.asc().nullsLast().op('text_ops'),
      table.type.asc().nullsLast().op('bool_ops')
    ),
    index('idx_plan_packages_fallback_model').using(
      'btree',
      table.fallbackModel.asc().nullsLast().op('text_ops')
    ),
    index('idx_plan_packages_type_active_archived_created').using(
      'btree',
      table.type.asc().nullsLast().op('timestamptz_ops'),
      table.isActive.asc().nullsLast().op('timestamptz_ops'),
      table.isArchived.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('bool_ops')
    ),
    foreignKey({
      columns: [table.fallbackModel],
      foreignColumns: [aiAgentModels.id],
      name: 'fk_plan_packages_fallback_model_ai_agent_models'
    }).onDelete('set null')
  ]
);

export const userBookmarks = pgTable(
  'user_bookmarks',
  {
    category: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    domain: text(),
    favicon: text(),
    id: text().primaryKey().notNull(),
    image: text(),
    title: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    url: text(),
    user: text()
  },
  (table) => [
    index('idx_user_bookmarks_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_bookmarks_user_category').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.category.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_bookmarks_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_bookmarks_user_users'
    }).onDelete('cascade')
  ]
);

export const userChatSuggestions = pgTable(
  'user_chat_suggestions',
  {
    agent: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    inputTokensAtGeneration: numeric('input_tokens_at_generation'),
    intentCountAtGeneration: numeric('intent_count_at_generation'),
    suggestions: jsonb(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    uniqueIndex('idx_PXDjps94K5').using(
      'btree',
      table.agent.asc().nullsLast().op('text_ops'),
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_rM4Z4b25C1').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_chat_suggestions_agent').using(
      'btree',
      table.agent.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_chat_suggestions_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.agent],
      foreignColumns: [aiAgents.id],
      name: 'fk_user_chat_suggestions_agent_ai_agents'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_chat_suggestions_user_users'
    }).onDelete('cascade')
  ]
);

export const userCustomization = pgTable(
  'user_customization',
  {
    id: text().primaryKey().notNull(),
    key: text(),
    user: text(),
    value: jsonb(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_VvOatUSOEt').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_customization_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_customization_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_user_customization_user_updated').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.updated.desc().nullsFirst().op('timestamptz_ops')
    ),
    uniqueIndex('idx_v8bWQZ7nwx').using(
      'btree',
      table.key.asc().nullsLast().op('text_ops'),
      table.user.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_customization_user_users'
    }).onDelete('cascade')
  ]
);

export const userProfiles = pgTable(
  'user_profiles',
  {
    accessCount: numeric('access_count'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    isDefault: boolean('is_default'),
    lastAccessed: timestamp('last_accessed', { withTimezone: true, mode: 'string' }),
    profileColor: text('profile_color'),
    profileIcon: text('profile_icon'),
    profileName: text('profile_name'),
    profileType: text('profile_type'),
    themeMode: text('theme_mode'),
    themePreset: text('theme_preset'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text(),
    isPinned: boolean('is_pinned'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    sortOrder: bigint('sort_order', { mode: 'number' }),
    templateId: text('template_id')
  },
  (table) => [
    index('idx_user_profiles_active').using(
      'btree',
      table.user.asc().nullsLast().op('bool_ops'),
      table.isActive.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_profiles_active_sort').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.isActive.asc().nullsLast().op('text_ops'),
      table.isDefault.desc().nullsFirst().op('text_ops'),
      table.lastAccessed.desc().nullsFirst().op('bool_ops')
    ),
    index('idx_user_profiles_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_profiles_user_users'
    }).onDelete('cascade')
  ]
);

export const userDashboardLayouts = pgTable(
  'user_dashboard_layouts',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    gridConfig: jsonb('grid_config'),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    layoutName: text('layout_name'),
    profile: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    index('idx_user_dashboard_layouts_composite').using(
      'btree',
      table.user.asc().nullsLast().op('bool_ops'),
      table.profile.asc().nullsLast().op('bool_ops'),
      table.isActive.asc().nullsLast().op('bool_ops')
    ),
    index('idx_user_dashboard_layouts_profile').using(
      'btree',
      table.profile.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_dashboard_layouts_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.profile],
      foreignColumns: [userProfiles.id],
      name: 'fk_user_dashboard_layouts_profile_user_profiles'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_dashboard_layouts_user_users'
    }).onDelete('cascade')
  ]
);

export const userDataSources = pgTable(
  'user_data_sources',
  {
    agentPrompt: text('agent_prompt'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    createdBy: text('created_by'),
    data: jsonb(),
    displayName: text('display_name'),
    fileRef: text('file_ref'),
    id: text().primaryKey().notNull(),
    inputParams: jsonb('input_params'),
    isStale: boolean('is_stale'),
    sourceKey: text('source_key'),
    toolKey: text('tool_key'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    index('idx_user_data_sources_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_data_sources_user_users'
    }).onDelete('set null')
  ]
);

export const userFamilyOfficeMembers = pgTable(
  'user_family_office_members',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    email: text(),
    id: text().primaryKey().notNull(),
    name: text(),
    parentId: text('parent_id'),
    positionX: numeric('position_x'),
    positionY: numeric('position_y'),
    responsibilities: jsonb(),
    role: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    index('idx_iPt4zJXIA2').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_family_office_members_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_family_office_members_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_family_office_members_user_users'
    }).onDelete('cascade')
  ]
);

export const userNotes = pgTable(
  'user_notes',
  {
    content: text(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    id: text().primaryKey().notNull(),
    includeInMemory: boolean('include_in_memory'),
    title: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text(),
    shareWithAdmin: boolean('share_with_admin'),
    shareWithManager: boolean('share_with_manager'),
    agent: text(),
    category: text(),
    chat: text(),
    source: text(),
    sourceMessage: text('source_message'),
    tags: jsonb(),
    pinned: boolean()
  },
  (table) => [
    index('idx_asJNTDh2CQ').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_fhRlffouxO').using(
      'btree',
      table.includeInMemory.asc().nullsLast().op('text_ops'),
      table.user.asc().nullsLast().op('bool_ops')
    ),
    index('idx_user_notes_agent').using('btree', table.agent.asc().nullsLast().op('text_ops')),
    index('idx_user_notes_chat').using('btree', table.chat.asc().nullsLast().op('text_ops')),
    index('idx_user_notes_source_message').using(
      'btree',
      table.sourceMessage.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_notes_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_notes_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_user_notes_user_pinned_created').using(
      'btree',
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.pinned.desc().nullsFirst().op('bool_ops'),
      table.created.desc().nullsFirst().op('text_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_notes_user_users'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.agent],
      foreignColumns: [aiAgents.id],
      name: 'fk_user_notes_agent_ai_agents'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.chat],
      foreignColumns: [chats.id],
      name: 'fk_user_notes_chat_chats'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.sourceMessage],
      foreignColumns: [chatMessages.id],
      name: 'fk_user_notes_source_message_chat_messages'
    }).onDelete('set null')
  ]
);

export const userProfileSummaries = pgTable(
  'user_profile_summaries',
  {
    factCountAtGeneration: numeric('fact_count_at_generation'),
    id: text().primaryKey().notNull(),
    inputTokensAtGeneration: numeric('input_tokens_at_generation'),
    intentCountAtGeneration: numeric('intent_count_at_generation'),
    summaryText: text('summary_text'),
    user: text(),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'string' }),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_user_profile_summaries_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_profile_summaries_user_users'
    }).onDelete('cascade')
  ]
);

export const userReminders = pgTable(
  'user_reminders',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    id: text().primaryKey().notNull(),
    includeInMemory: boolean('include_in_memory'),
    notificationMinutesBefore: numeric('notification_minutes_before'),
    reminderDatetime: text('reminder_datetime'),
    sent: boolean(),
    title: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text(),
    recurring: text(),
    isActive: boolean('is_active'),
    shareWithAdmin: boolean('share_with_admin'),
    shareWithManager: boolean('share_with_manager'),
    category: text()
  },
  (table) => [
    index('idx_1AiWk9bp54').using('btree', table.reminderDatetime.asc().nullsLast().op('text_ops')),
    index('idx_901fImT4CL').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_SoyWmskGrF').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.reminderDatetime.asc().nullsLast().op('text_ops')
    ),
    index('idx_eTewbL4Gdx').using(
      'btree',
      table.sent.asc().nullsLast().op('bool_ops'),
      table.reminderDatetime.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_reminders_sent_datetime_asc').using(
      'btree',
      table.sent.asc().nullsLast().op('text_ops'),
      table.reminderDatetime.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_reminders_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_reminders_user_datetime_desc').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.reminderDatetime.desc().nullsFirst().op('text_ops')
    ),
    index('idx_user_reminders_user_sent_datetime').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.sent.asc().nullsLast().op('text_ops'),
      table.reminderDatetime.asc().nullsLast().op('bool_ops')
    ),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_reminders_user_users'
    }).onDelete('cascade')
  ]
);

export const userTierOverrides = pgTable(
  'user_tier_overrides',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    grantedBy: text('granted_by'),
    id: text().primaryKey().notNull(),
    isActive: boolean('is_active'),
    overrideType: text('override_type'),
    reason: text(),
    targetId: text('target_id'),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text()
  },
  (table) => [
    index('idx_user_tier_overrides_granted_by').using(
      'btree',
      table.grantedBy.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_tier_overrides_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_tier_overrides_user_active').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.isActive.asc().nullsLast().op('bool_ops')
    ),
    index('idx_user_tier_overrides_user_type').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.overrideType.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.grantedBy],
      foreignColumns: [users.id],
      name: 'fk_user_tier_overrides_granted_by_users'
    }).onDelete('set null'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_tier_overrides_user_users'
    }).onDelete('cascade')
  ]
);

export const userTodos = pgTable(
  'user_todos',
  {
    created: timestamp({ withTimezone: true, mode: 'string' }),
    description: text(),
    id: text().primaryKey().notNull(),
    includeInMemory: boolean('include_in_memory'),
    status: text(),
    task: text(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text(),
    priority: text(),
    shareWithAdmin: boolean('share_with_admin'),
    shareWithManager: boolean('share_with_manager'),
    dueDate: timestamp('due_date', { withTimezone: true, mode: 'string' }),
    category: text()
  },
  (table) => [
    index('idx_p88iUG66oc').using(
      'btree',
      table.includeInMemory.asc().nullsLast().op('bool_ops'),
      table.user.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_todos_user').using('btree', table.user.asc().nullsLast().op('text_ops')),
    index('idx_user_todos_user_created').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_user_todos_user_status_created').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops'),
      table.status.asc().nullsLast().op('timestamptz_ops'),
      table.created.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_vDxRPFvDrV').using('btree', table.user.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_todos_user_users'
    }).onDelete('cascade')
  ]
);

export const userWidgetInstances = pgTable(
  'user_widget_instances',
  {
    aiGenerationPrompt: text('ai_generation_prompt'),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    createdByAi: boolean('created_by_ai'),
    customConfig: jsonb('custom_config'),
    dashboard: text(),
    id: text().primaryKey().notNull(),
    isVisible: boolean('is_visible'),
    position: jsonb(),
    updated: timestamp({ withTimezone: true, mode: 'string' }),
    user: text(),
    visualConfig: jsonb('visual_config'),
    widgetTitle: text('widget_title'),
    widgetType: text('widget_type')
  },
  (table) => [
    index('idx_user_widget_instances_dash_user_created').using(
      'btree',
      table.dashboard.asc().nullsLast().op('timestamptz_ops'),
      table.user.asc().nullsLast().op('timestamptz_ops'),
      table.created.asc().nullsLast().op('timestamptz_ops')
    ),
    index('idx_user_widget_instances_dashboard').using(
      'btree',
      table.dashboard.asc().nullsLast().op('text_ops')
    ),
    index('idx_user_widget_instances_user').using(
      'btree',
      table.user.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.dashboard],
      foreignColumns: [userDashboardLayouts.id],
      name: 'fk_user_widget_instances_dashboard_user_dashboard_layouts'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.user],
      foreignColumns: [users.id],
      name: 'fk_user_widget_instances_user_users'
    }).onDelete('cascade')
  ]
);

export const coreRolePermissions = pgTable(
  'core_role_permissions',
  {
    create: boolean(),
    created: timestamp({ withTimezone: true, mode: 'string' }),
    delete: boolean(),
    entityType: text('entity_type'),
    id: text().primaryKey().notNull(),
    name: text(),
    read: boolean(),
    update: boolean(),
    updated: timestamp({ withTimezone: true, mode: 'string' })
  },
  (table) => [
    index('idx_5I7djbpnp7').using(
      'btree',
      table.entityType.asc().nullsLast().op('text_ops'),
      table.name.asc().nullsLast().op('text_ops')
    ),
    index('idx_ffHLmhYcuC').using('btree', table.entityType.asc().nullsLast().op('text_ops')),
    index('idx_weEPxqlVPw').using('btree', table.name.asc().nullsLast().op('text_ops'))
  ]
);

export const aiAgentFlowsKnowledgeFiles = pgTable(
  'ai_agent_flows__knowledge_files',
  {
    sourceId: text('source_id').notNull(),
    targetId: text('target_id').notNull(),
    position: integer().notNull()
  },
  (table) => [
    index('idx_ai_agent_flows__knowledge_files_source_id').using(
      'btree',
      table.sourceId.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_agent_flows__knowledge_files_target_id').using(
      'btree',
      table.targetId.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.sourceId],
      foreignColumns: [aiAgentFlows.id],
      name: 'fk_ai_agent_flows__knowledge_files_source'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [aiSystemUploads.id],
      name: 'fk_ai_agent_flows__knowledge_files_target'
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.sourceId, table.position],
      name: 'pk_ai_agent_flows__knowledge_files'
    })
  ]
);

export const aiAgentModelsSupportedTools = pgTable(
  'ai_agent_models__supported_tools',
  {
    sourceId: text('source_id').notNull(),
    targetId: text('target_id').notNull(),
    position: integer().notNull()
  },
  (table) => [
    index('idx_ai_agent_models__supported_tools_source_id').using(
      'btree',
      table.sourceId.asc().nullsLast().op('text_ops')
    ),
    index('idx_ai_agent_models__supported_tools_target_id').using(
      'btree',
      table.targetId.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.sourceId],
      foreignColumns: [aiAgentModels.id],
      name: 'fk_ai_agent_models__supported_tools_source'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [aiTools.id],
      name: 'fk_ai_agent_models__supported_tools_target'
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.sourceId, table.position],
      name: 'pk_ai_agent_models__supported_tools'
    })
  ]
);

export const chatMessagesAttachments = pgTable(
  'chat_messages__attachments',
  {
    sourceId: text('source_id').notNull(),
    targetId: text('target_id').notNull(),
    position: integer().notNull()
  },
  (table) => [
    index('idx_chat_messages__attachments_source_id').using(
      'btree',
      table.sourceId.asc().nullsLast().op('text_ops')
    ),
    index('idx_chat_messages__attachments_target_id').using(
      'btree',
      table.targetId.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.sourceId],
      foreignColumns: [chatMessages.id],
      name: 'fk_chat_messages__attachments_source'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [userUploads.id],
      name: 'fk_chat_messages__attachments_target'
    }).onDelete('cascade'),
    primaryKey({ columns: [table.sourceId, table.position], name: 'pk_chat_messages__attachments' })
  ]
);

export const planPackagesAllowedModels = pgTable(
  'plan_packages__allowed_models',
  {
    sourceId: text('source_id').notNull(),
    targetId: text('target_id').notNull(),
    position: integer().notNull()
  },
  (table) => [
    index('idx_plan_packages__allowed_models_source_id').using(
      'btree',
      table.sourceId.asc().nullsLast().op('text_ops')
    ),
    index('idx_plan_packages__allowed_models_target_id').using(
      'btree',
      table.targetId.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.sourceId],
      foreignColumns: [planPackages.id],
      name: 'fk_plan_packages__allowed_models_source'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [aiAgentModels.id],
      name: 'fk_plan_packages__allowed_models_target'
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.sourceId, table.position],
      name: 'pk_plan_packages__allowed_models'
    })
  ]
);

export const planPackagesAllowedTools = pgTable(
  'plan_packages__allowed_tools',
  {
    sourceId: text('source_id').notNull(),
    targetId: text('target_id').notNull(),
    position: integer().notNull()
  },
  (table) => [
    index('idx_plan_packages__allowed_tools_source_id').using(
      'btree',
      table.sourceId.asc().nullsLast().op('text_ops')
    ),
    index('idx_plan_packages__allowed_tools_target_id').using(
      'btree',
      table.targetId.asc().nullsLast().op('text_ops')
    ),
    foreignKey({
      columns: [table.sourceId],
      foreignColumns: [planPackages.id],
      name: 'fk_plan_packages__allowed_tools_source'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [aiTools.id],
      name: 'fk_plan_packages__allowed_tools_target'
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.sourceId, table.position],
      name: 'pk_plan_packages__allowed_tools'
    })
  ]
);
export const userCreditBalance = pgView('user_credit_balance', {
  id: text(),
  user: text(),
  balance: numeric(),
  lifetimePurchased: numeric('lifetime_purchased'),
  lifetimeSpent: numeric('lifetime_spent'),
  lastTransaction: timestamp('last_transaction', { withTimezone: true, mode: 'string' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, "user", balance, lifetime_purchased, lifetime_spent, last_transaction FROM ( SELECT core_credit_ledger."user", sum( CASE WHEN core_credit_ledger.type = 'credit'::text THEN core_credit_ledger.credits_changed ELSE - core_credit_ledger.credits_changed END) AS balance, sum( CASE WHEN core_credit_ledger.type = 'credit'::text AND core_credit_ledger.transaction_type = 'purchase'::text THEN core_credit_ledger.credits_changed ELSE 0::numeric END) AS lifetime_purchased, sum( CASE WHEN core_credit_ledger.type = 'debit'::text AND core_credit_ledger.transaction_type = 'usage'::text THEN core_credit_ledger.credits_changed ELSE 0::numeric END) AS lifetime_spent, max(core_credit_ledger.created) AS last_transaction FROM core_credit_ledger GROUP BY core_credit_ledger."user") balance_rows`
);

export const viewCategoryUsage = pgView('view_category_usage', {
  id: text(),
  category: text(),
  day: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, category, day::text AS day, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger.category, core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger.category, (core_token_ledger.created::date)) category_daily`
);

export const viewChatCosts = pgView('view_chat_costs', {
  id: text(),
  chat: text(),
  user: text(),
  totalCostUsd: numeric('total_cost_usd'),
  totalInputTokens: numeric('total_input_tokens'),
  totalOutputTokens: numeric('total_output_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  totalMessages: bigint('total_messages', { mode: 'number' }),
  avgLatencyMs: numeric('avg_latency_ms'),
  modelsUsed: text('models_used'),
  firstMessageAt: timestamp('first_message_at', { withTimezone: true, mode: 'string' }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'string' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, chat, "user", total_cost_usd, total_input_tokens, total_output_tokens, total_messages, avg_latency_ms, models_used, first_message_at, last_message_at FROM ( SELECT chat_messages_debug.chat, min(chat_messages_debug."user") AS "user", sum(chat_messages_debug.cost_usd) AS total_cost_usd, sum(chat_messages_debug.input_tokens) AS total_input_tokens, sum(chat_messages_debug.output_tokens) AS total_output_tokens, count(*) AS total_messages, avg(chat_messages_debug.latency_ms) AS avg_latency_ms, string_agg(DISTINCT chat_messages_debug.model_id, ','::text) AS models_used, min(chat_messages_debug.created) AS first_message_at, max(chat_messages_debug.created) AS last_message_at FROM chat_messages_debug WHERE chat_messages_debug.role = 'assistant'::text GROUP BY chat_messages_debug.chat) chat_costs`
);

export const viewDailyUsage = pgView('view_daily_usage', {
  id: text(),
  day: text(),
  totalCost: numeric('total_cost')
}).as(
  sql`SELECT row_number() OVER ()::text AS id, day::text AS day, total_cost FROM ( SELECT core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost FROM core_token_ledger GROUP BY (core_token_ledger.created::date)) daily_usage`
);

export const viewHourlyUsage = pgView('view_hourly_usage', {
  id: text(),
  hour: text(),
  dayOfWeek: text('day_of_week'),
  hourOfDay: integer('hour_of_day'),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, to_char(hour_bucket, 'YYYY-MM-DD HH24:00:00'::text) AS hour, EXTRACT(dow FROM hour_bucket)::integer::text AS day_of_week, EXTRACT(hour FROM hour_bucket)::integer AS hour_of_day, total_cost, total_tokens, request_count FROM ( SELECT date_trunc('hour'::text, core_token_ledger.created) AS hour_bucket, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY (date_trunc('hour'::text, core_token_ledger.created))) hourly_usage`
);

export const viewModelDailyUsage = pgView('view_model_daily_usage', {
  id: text(),
  model: text(),
  provider: text(),
  day: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, model, provider, day::text AS day, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger.model, core_token_ledger.provider, core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger.model, core_token_ledger.provider, (core_token_ledger.created::date)) model_daily`
);

export const viewModelUsage = pgView('view_model_usage', {
  id: text(),
  model: text(),
  provider: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, model, provider, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger.model, core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger.model, core_token_ledger.provider) model_usage`
);

export const viewProviderUsage = pgView('view_provider_usage', {
  id: text(),
  provider: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens')
}).as(
  sql`SELECT row_number() OVER ()::text AS id, provider, total_cost, total_tokens FROM ( SELECT core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens FROM core_token_ledger GROUP BY core_token_ledger.provider) provider_usage`
);

export const viewTopSpenders = pgView('view_top_spenders', {
  id: text(),
  user: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, "user", total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user") top_spenders`
);

export const viewUserDailyUsage = pgView('view_user_daily_usage', {
  id: text(),
  user: text(),
  day: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, "user", day::text AS day, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", core_token_ledger.created::date AS day, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user", (core_token_ledger.created::date)) user_daily_usage`
);

export const viewUserModelUsage = pgView('view_user_model_usage', {
  id: text(),
  user: text(),
  model: text(),
  provider: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, "user", model, provider, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", core_token_ledger.model, core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user", core_token_ledger.model, core_token_ledger.provider) user_model_usage`
);

export const viewUserProviderUsage = pgView('view_user_provider_usage', {
  id: text(),
  user: text(),
  provider: text(),
  totalCost: numeric('total_cost'),
  totalTokens: numeric('total_tokens'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestCount: bigint('request_count', { mode: 'number' })
}).as(
  sql`SELECT row_number() OVER ()::text AS id, "user", provider, total_cost, total_tokens, request_count FROM ( SELECT core_token_ledger."user", core_token_ledger.provider, sum(core_token_ledger.cost_usd) AS total_cost, sum(core_token_ledger.tokens) AS total_tokens, count(*) AS request_count FROM core_token_ledger GROUP BY core_token_ledger."user", core_token_ledger.provider) user_provider_usage`
);

export const userCostStats = pgView('user_cost_stats', {
  id: text(),
  user: text(),
  currentBalance: numeric('current_balance'),
  lifetimePurchased: numeric('lifetime_purchased'),
  lifetimeSpent: numeric('lifetime_spent'),
  lifetimeCostUsd: numeric('lifetime_cost_usd'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  totalTokenTransactions: bigint('total_token_transactions', { mode: 'number' }),
  totalTokens: numeric('total_tokens')
}).as(
  sql`SELECT ucb.id, ucb."user", ucb.balance AS current_balance, ucb.lifetime_purchased, ucb.lifetime_spent, COALESCE(ctl.lifetime_cost_usd, 0::numeric) AS lifetime_cost_usd, COALESCE(ctl.total_transactions, 0::bigint) AS total_token_transactions, COALESCE(ctl.total_tokens, 0::numeric) AS total_tokens FROM user_credit_balance ucb LEFT JOIN ( SELECT core_token_ledger."user", sum(core_token_ledger.cost_usd) AS lifetime_cost_usd, count(*) AS total_transactions, sum(core_token_ledger.tokens) AS total_tokens FROM core_token_ledger WHERE core_token_ledger."user" IS NOT NULL AND core_token_ledger."user" <> ''::text GROUP BY core_token_ledger."user") ctl ON ucb."user" = ctl."user"`
);
