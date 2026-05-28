/**
 * Model Resolver — Runtime Model Resolution for User-Selected Models
 *
 * Implements the 4-level priority chain for determining which AI model
 * to use for a given LLM/classifier node at runtime:
 *
 *   1. Admin pin (node.config.model_id is set) — highest priority
 *   2. Per-chat override (chats.model_override)
 *   3. Global user preference (user_customization key "model_preference")
 *   4. System default (ai_agent_models.is_system_default = true) — lowest priority
 *
 * Also provides helpers for fetching the system default model and
 * the full list of user-available models for the picker UI.
 */

import type { Database } from '@repo/db/types';
import { aiAgentModels, aiProviders } from '@repo/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import type { ResolvedModel } from '../types/flow';
import type { UserTierContext } from './tier-resolver';
import { isModelAllowed } from './tier-resolver';
import { evaluateTagRule } from './tag-rule-engine';
import { AIModelError, ConfigError } from './errors';
import { createLogger, formatError } from './logger';
import { createTTLCache } from './ttl-cache';

// ============================================================================
// Per-request cache for system default (5 min TTL)
// ============================================================================

const systemDefaultCache = createTTLCache<ResolvedModel>(5 * 60 * 1000);

/**
 * Clear per-request caches. Call at the start of each request alongside
 * clearConfigCache() from model-factory.ts.
 */
export function clearModelResolverCache(): void {
	systemDefaultCache.clear();
}

// ============================================================================
// Core Resolution
// ============================================================================

/**
 * Resolve the model for a flow node using the priority chain.
 *
 * Pure function when all resolved models are pre-loaded. For dynamic models
 * (override/preference not in compiled config), the caller must fetch the
 * model record separately and pass it via `dynamicModels`.
 *
 * @param nodeModelId - Admin-pinned model record ID (from LLMNodeData.model_id), or undefined
 * @param chatOverrideId - Per-chat override record ID (from chats.model_override), or undefined
 * @param userPreferenceId - Global user preference record ID, or undefined
 * @param systemDefault - The system-wide default ResolvedModel (undefined if none configured and no compiled fallback)
 * @param resolvedModels - Models resolved at compile time (from compiled_config.resolved.models)
 * @param dynamicModels - Additional models fetched at runtime for override/preference resolution
 */
export function resolveNodeModel(
	nodeModelId: string | undefined,
	chatOverrideId: string | undefined,
	userPreferenceId: string | undefined,
	systemDefault: ResolvedModel | undefined,
	resolvedModels: Record<string, ResolvedModel>,
	dynamicModels?: Record<string, ResolvedModel>
): ResolvedModel {
	// Priority 1: Admin pin — node has an explicit model_id
	if (nodeModelId) {
		const pinned = resolvedModels[nodeModelId];
		if (pinned) return pinned;
		// Check dynamic models as fallback (shouldn't happen for pinned, but defensive)
		if (dynamicModels?.[nodeModelId]) return dynamicModels[nodeModelId];
		throw new AIModelError(`Pinned model not resolved: ${nodeModelId}`, {
			modelId: nodeModelId,
			code: 'PINNED_MODEL_NOT_RESOLVED'
		});
	}

	const allModels = { ...resolvedModels, ...dynamicModels };

	// Priority 2: Per-chat override
	if (chatOverrideId) {
		const override = allModels[chatOverrideId];
		if (override) return override;
		// Override ID doesn't match any known model — fall through
	}

	// Priority 3: Global user preference
	if (userPreferenceId) {
		const preference = allModels[userPreferenceId];
		if (preference) return preference;
		// Preference ID doesn't match — fall through
	}

	// Priority 4: System default
	if (!systemDefault) {
		throw new AIModelError(
			'No model could be resolved: no admin pin, chat override, user preference, or system default',
			{ code: 'NO_MODEL_RESOLVED' }
		);
	}
	return systemDefault;
}

// ============================================================================
// Database Fetchers
// ============================================================================

/**
 * Map a Drizzle row (model + joined provider) to a ResolvedModel.
 */
function toResolvedModel(row: {
	model: typeof aiAgentModels.$inferSelect;
	provider: typeof aiProviders.$inferSelect | null;
}): ResolvedModel {
	const m = row.model;
	const p = row.provider;
	if (!p?.providerKey) {
		createLogger('ModelResolver').warn('provider_missing_for_model', {
			modelId: m.id,
			modelName: m.displayName,
			providerId: m.provider
		});
	}
	return {
		id: m.id,
		model_id: m.modelId ?? '',
		display_name: m.displayName ?? '',
		provider_id: m.provider ?? '',
		provider_key: p?.providerKey ?? 'unknown',
		pricing_id: m.currentPricing || undefined,
		context_window: m.contextWindow ? Number(m.contextWindow) : undefined,
		max_output_tokens: m.maxOutputTokens ? Number(m.maxOutputTokens) : undefined,
		default_options: (m.defaultOptions as Record<string, unknown>) ?? undefined,
		capabilities: (m.capabilities as Record<string, unknown>) ?? undefined,
		tag_rule: (m.tagRule as any) ?? null
	};
}

/**
 * Fetch the system default model (is_system_default = true). Cached per-request.
 * Throws if no default is configured.
 */
export async function getSystemDefaultModel(db: Database): Promise<ResolvedModel> {
	const cached = systemDefaultCache.get();
	if (cached) return cached;

	const row = await db.query.aiAgentModels.findFirst({
		where: and(
			eq(aiAgentModels.isSystemDefault, true),
			eq(aiAgentModels.isActive, true),
			eq(aiAgentModels.isEnabled, true),
			or(eq(aiAgentModels.configKey, ''), isNull(aiAgentModels.configKey))
		),
		with: { aiProvider: true }
	});

	if (!row) {
		throw new ConfigError('No system default model configured (is_system_default = true)', {
			configKey: 'ai_agent_models',
			code: 'NO_SYSTEM_DEFAULT_MODEL'
		});
	}

	const result = toResolvedModel({ model: row, provider: row.aiProvider });
	systemDefaultCache.set(result);
	return result;
}

/**
 * Fetch a single model by record ID. Used to resolve dynamic models
 * (chat override / user preference) that aren't in the compiled config.
 */
export async function fetchModelById(db: Database, modelId: string): Promise<ResolvedModel> {
	const row = await db.query.aiAgentModels.findFirst({
		where: eq(aiAgentModels.id, modelId),
		with: { aiProvider: true }
	});

	if (!row) {
		throw new AIModelError(`Failed to fetch model: ${modelId}`, {
			modelId,
			code: 'MODEL_FETCH_FAILED'
		});
	}

	if (!row.isActive || !row.isEnabled) {
		throw new AIModelError(`Model is not active/enabled: ${row.displayName}`, {
			modelId,
			code: 'MODEL_INACTIVE'
		});
	}

	return toResolvedModel({ model: row, provider: row.aiProvider });
}

/**
 * Fetch all active + enabled models for the user-facing model picker.
 * Returns them as ResolvedModel[] grouped-ready (sorted by provider then name).
 * When tierCtx is provided, filters to only tier-allowed models (+ overrides).
 * When userTags is provided, also filters by model tag_rule.
 * Empty allowedModelIds = no restriction (all models returned).
 */
export async function getAvailableModelsForUser(
	db: Database,
	tierCtx?: UserTierContext,
	userTags?: string[]
): Promise<ResolvedModel[]> {
	// Only fetch user-selectable models (config_key = "" excludes infra configs)
	const rows = await db
		.select({ model: aiAgentModels, provider: aiProviders })
		.from(aiAgentModels)
		.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
		.where(
			and(
				eq(aiAgentModels.isActive, true),
				eq(aiAgentModels.isEnabled, true),
				eq(aiAgentModels.configKey, '')
			)
		)
		.orderBy(aiAgentModels.provider, aiAgentModels.displayName);

	const models: ResolvedModel[] = [];
	for (const row of rows) {
		const m = row.model;
		if (
			tierCtx &&
			tierCtx.allowedModelIds.size > 0 &&
			!isModelAllowed(tierCtx, m.id, m.tagRule as import('@repo/shared/types').TagRule | null)
		) {
			continue;
		}
		if (
			userTags &&
			m.tagRule &&
			!evaluateTagRule(m.tagRule as import('@repo/shared/types').TagRule, userTags)
		) {
			continue;
		}
		models.push(toResolvedModel(row));
	}

	return models;
}

/**
 * Build the `dynamicModels` record needed by `resolveNodeModel` for models
 * that aren't in the compiled config's `resolved.models`. Fetches only the
 * IDs that are missing from the compiled set.
 */
export async function fetchDynamicModels(
	db: Database,
	compiledModels: Record<string, ResolvedModel>,
	modelIds: (string | undefined)[]
): Promise<Record<string, ResolvedModel>> {
	const dynamic: Record<string, ResolvedModel> = {};
	const toFetch = new Set<string>();

	for (const id of modelIds) {
		if (id && !compiledModels[id]) {
			toFetch.add(id);
		}
	}

	const fetches = [...toFetch].map(async (id) => {
		try {
			dynamic[id] = await fetchModelById(db, id);
		} catch (err) {
			createLogger('ModelResolver').warn('dynamic_model_fetch_failed', {
				modelId: id,
				...formatError(err)
			});
		}
	});

	await Promise.all(fetches);
	return dynamic;
}
