/**
 * OpenRouter Model Sync Service
 *
 * Fetches the model catalog from OpenRouter's public API and syncs it into
 * our Neon Postgres database. Handles:
 * - Creating new models (disabled by default, admin must enable)
 * - Updating existing synced models (metadata, context window, pricing)
 * - Skipping models with syncStatus='override' (admin-locked)
 * - Marking removed models as 'deprecated'
 * - Versioned pricing rate creation (append-only)
 * - Matching existing unsynced models by provider-native modelId
 *
 * Triggered by:
 * - Daily cron (0 6 * * *)
 * - Manual admin "Sync Now" button via RPC
 */

import { eq, and, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import {
	aiAgentModels,
	aiPricingRates,
	aiProviders,
	aiTools,
	aiAgentModelsSupportedTools
} from '@repo/db/schema';
import type { Database } from '@repo/db/client';
import { createLogger, formatError } from '../utils/logger';

const log = createLogger('model-sync');

// ============================================================================
// OpenRouter API Types
// ============================================================================

/** Shape of a single model from GET /api/v1/models */
export interface OrModel {
	id: string; // "openai/gpt-5.2"
	name: string; // "OpenAI: GPT-5.2"
	created: number;
	description: string;
	context_length: number;
	architecture: {
		modality: string;
		input_modalities: string[];
		output_modalities: string[];
		tokenizer: string;
		instruct_type: string | null;
	};
	pricing: {
		prompt: string;
		completion: string;
		image?: string;
		audio?: string;
		web_search?: string;
		input_cache_read?: string;
		input_cache_write?: string;
		internal_reasoning?: string;
	};
	top_provider: {
		context_length: number | null;
		max_completion_tokens: number | null;
		is_moderated: boolean;
	};
	supported_parameters: string[];
	default_parameters: Record<string, unknown> | null;
	knowledge_cutoff: string | null;
	expiration_date: string | null;
}

interface OrApiResponse {
	data: OrModel[];
}

// ============================================================================
// Provider Mapping
// ============================================================================

/** Maps OR model ID prefix to our aiProviders.providerKey */
const OR_PROVIDER_MAP: Record<string, string> = {
	openai: 'openai',
	anthropic: 'anthropic',
	google: 'google',
	'x-ai': 'xai'
};

const SUPPORTED_PREFIXES = Object.keys(OR_PROVIDER_MAP);

function getProviderKey(orModelId: string): string | null {
	const prefix = orModelId.split('/')[0];
	return OR_PROVIDER_MAP[prefix] ?? null;
}

/** Strip provider prefix to get the native model ID for model-factory */
function stripProviderPrefix(orModelId: string): string {
	const slashIdx = orModelId.indexOf('/');
	return slashIdx >= 0 ? orModelId.slice(slashIdx + 1) : orModelId;
}

// ============================================================================
// Options Schema Generation
// ============================================================================

/**
 * Maps OR parameter names to JSON Schema property definitions.
 * Only includes parameters that our param-mapper knows how to translate.
 * Keys are snake_case — matching param-mapper's STANDARD_PARAM_MAP vocabulary.
 */
const OR_PARAM_SCHEMA: Record<
	string,
	{
		type: string;
		description: string;
		minimum?: number;
		maximum?: number;
		items?: { type: string };
	}
> = {
	temperature: { type: 'number', description: 'Sampling temperature', minimum: 0, maximum: 2 },
	max_tokens: { type: 'integer', description: 'Maximum output tokens', minimum: 1 },
	max_completion_tokens: { type: 'integer', description: 'Maximum completion tokens', minimum: 1 },
	top_p: { type: 'number', description: 'Nucleus sampling threshold', minimum: 0, maximum: 1 },
	top_k: { type: 'integer', description: 'Top-K sampling', minimum: 1 },
	frequency_penalty: {
		type: 'number',
		description: 'Frequency penalty',
		minimum: -2,
		maximum: 2
	},
	presence_penalty: { type: 'number', description: 'Presence penalty', minimum: -2, maximum: 2 },
	repetition_penalty: { type: 'number', description: 'Repetition penalty', minimum: 0 },
	stop: { type: 'array', description: 'Stop sequences', items: { type: 'string' } },
	seed: { type: 'integer', description: 'Random seed for reproducibility' },
	reasoning_effort: { type: 'string', description: 'Reasoning effort level (low/medium/high)' }
};

function generateOptionsSchema(supportedParams: string[]): object {
	const properties: Record<string, object> = {};
	for (const param of supportedParams) {
		if (OR_PARAM_SCHEMA[param]) {
			properties[param] = OR_PARAM_SCHEMA[param];
		}
	}
	return { type: 'object', properties, additionalProperties: false };
}

// ============================================================================
// Default Options Mapping
// ============================================================================

/**
 * Map OR default_parameters to our defaultOptions format.
 * Keys stay snake_case (max_tokens, temperature, top_p) because:
 * 1. optionsSchema properties use snake_case keys
 * 2. SchemaForm stores values with the same keys into provider_options
 * 3. param-mapper's STANDARD_PARAM_MAP handles snake→camelCase at runtime
 */
function mapDefaultOptions(
	defaults: Record<string, unknown> | null
): Record<string, unknown> | null {
	if (!defaults) return null;
	const mapped: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(defaults)) {
		if (value === null || value === undefined) continue;
		mapped[key] = value;
	}
	return Object.keys(mapped).length > 0 ? mapped : null;
}

// ============================================================================
// Pricing Mapping
// ============================================================================

const TOKENS_PER_MILLION = 1_000_000;

interface MappedPricing {
	inputPricePer1M: string;
	outputPricePer1M: string;
	cachedInputPricePer1M: string | null;
	reasoningPricePer1M: string | null;
	pricePerImage: string | null;
}

function hasPositivePricingValue(value: string | undefined): boolean {
	if (!value) return false;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0;
}

function getSyncSkipReason(orModel: OrModel): string | null {
	if (orModel.id.includes(':free')) return 'free_variant';
	if (!hasPositivePricingValue(orModel.pricing.prompt)) return 'non_positive_prompt_pricing';
	if (!hasPositivePricingValue(orModel.pricing.completion))
		return 'non_positive_completion_pricing';
	return null;
}

function mapOrPricing(orPricing: OrModel['pricing']): MappedPricing {
	return {
		inputPricePer1M: String(parseFloat(orPricing.prompt) * TOKENS_PER_MILLION),
		outputPricePer1M: String(parseFloat(orPricing.completion) * TOKENS_PER_MILLION),
		cachedInputPricePer1M: orPricing.input_cache_read
			? String(parseFloat(orPricing.input_cache_read) * TOKENS_PER_MILLION)
			: null,
		reasoningPricePer1M: orPricing.internal_reasoning
			? String(parseFloat(orPricing.internal_reasoning) * TOKENS_PER_MILLION)
			: null,
		pricePerImage: orPricing.image ?? null
	};
}

/** Returns true if pricing has changed enough to warrant a new rate record */
function pricingChanged(
	current: {
		inputPricePer1M: string | null;
		outputPricePer1M: string | null;
		cachedInputPricePer1M: string | null;
	} | null,
	mapped: MappedPricing
): boolean {
	if (!current) return true;
	return (
		current.inputPricePer1M !== mapped.inputPricePer1M ||
		current.outputPricePer1M !== mapped.outputPricePer1M ||
		(current.cachedInputPricePer1M ?? null) !== mapped.cachedInputPricePer1M
	);
}

// ============================================================================
// Core Sync Function
// ============================================================================

export interface SyncResult {
	created: number;
	updated: number;
	deprecated: number;
	pricingUpdated: number;
	toolsAssigned: number;
	skipped: number;
	errors: string[];
}

export async function syncModelsToDb(db: Database): Promise<SyncResult> {
	const result: SyncResult = {
		created: 0,
		updated: 0,
		deprecated: 0,
		pricingUpdated: 0,
		toolsAssigned: 0,
		skipped: 0,
		errors: []
	};

	// 1. Fetch OpenRouter models
	const orModels = await fetchOpenRouterModels();
	log.info('or_models_fetched', { total: orModels.length });

	// 1b. Load tool assignment context for auto-assigning tools to new models
	const toolCtx = await loadToolAssignmentContext(db);

	// 2. Filter to our 4 supported providers
	const supportedModels = orModels.filter((m) => {
		const prefix = m.id.split('/')[0];
		return SUPPORTED_PREFIXES.includes(prefix);
	});

	// 3. Filter out models with non-positive OR pricing before they can hit billing
	const paidModels: OrModel[] = [];
	for (const model of supportedModels) {
		const skipReason = getSyncSkipReason(model);
		if (skipReason) {
			result.skipped++;
			log.warn('or_model_skipped', {
				orModelId: model.id,
				reason: skipReason,
				prompt: model.pricing.prompt,
				completion: model.pricing.completion
			});
			continue;
		}
		paidModels.push(model);
	}
	log.info('or_models_filtered', {
		supported: supportedModels.length,
		paid: paidModels.length
	});

	// 4. Load existing provider records (to map providerKey → provider ID)
	const providers = await db.select().from(aiProviders).where(eq(aiProviders.isActive, true));
	const providerByKey = new Map(providers.map((p) => [p.providerKey, p]));

	// 5. Load existing synced models
	const existingModels = await db
		.select()
		.from(aiAgentModels)
		.where(isNotNull(aiAgentModels.orModelId));
	const existingByOrId = new Map(existingModels.map((m) => [m.orModelId, m]));

	// 6. Load current pricing rates for comparison
	const pricingIds = existingModels.filter((m) => m.currentPricing).map((m) => m.currentPricing!);
	const currentRates =
		pricingIds.length > 0
			? await db.select().from(aiPricingRates).where(inArray(aiPricingRates.id, pricingIds))
			: [];
	const rateById = new Map(currentRates.map((r) => [r.id, r]));

	// 7. Process each OR model
	const seenOrIds = new Set<string>();
	const now = new Date().toISOString();

	for (const orModel of paidModels) {
		seenOrIds.add(orModel.id);
		const providerKey = getProviderKey(orModel.id);
		if (!providerKey) continue;

		const provider = providerByKey.get(providerKey);
		if (!provider) {
			result.errors.push(`Provider not found for key: ${providerKey} (model: ${orModel.id})`);
			continue;
		}

		try {
			const existing = existingByOrId.get(orModel.id);
			const mappedPricing = mapOrPricing(orModel.pricing);
			const optionsSchema = generateOptionsSchema(orModel.supported_parameters);
			const defaultOptions = mapDefaultOptions(orModel.default_parameters);
			const capabilities = {
				modality: orModel.architecture.modality,
				inputModalities: orModel.architecture.input_modalities,
				outputModalities: orModel.architecture.output_modalities,
				tokenizer: orModel.architecture.tokenizer,
				supportedParameters: orModel.supported_parameters
			};

			if (existing) {
				await processExistingModel(
					db,
					existing,
					orModel,
					providerKey,
					mappedPricing,
					optionsSchema,
					defaultOptions,
					capabilities,
					rateById,
					toolCtx,
					now,
					result
				);
			} else {
				await processNewModel(
					db,
					orModel,
					provider.id,
					providerKey,
					mappedPricing,
					optionsSchema,
					defaultOptions,
					capabilities,
					rateById,
					toolCtx,
					now,
					result
				);
			}
		} catch (e) {
			result.errors.push(`Error processing ${orModel.id}: ${formatError(e)}`);
			log.error('model_sync_error', { orModelId: orModel.id, error: formatError(e) });
		}
	}

	// 8. Mark deprecated models (synced models no longer in OR response)
	for (const existing of existingModels) {
		if (
			existing.orModelId &&
			existing.syncStatus === 'synced' &&
			!seenOrIds.has(existing.orModelId)
		) {
			await db
				.update(aiAgentModels)
				.set({ syncStatus: 'deprecated', updated: now })
				.where(eq(aiAgentModels.id, existing.id));
			result.deprecated++;
		}
	}

	log.info('model_sync_complete', {
		created: result.created,
		updated: result.updated,
		deprecated: result.deprecated,
		pricingUpdated: result.pricingUpdated,
		toolsAssigned: result.toolsAssigned,
		skipped: result.skipped,
		errors: result.errors.length
	});

	return result;
}

// ============================================================================
// Process Existing Model (Update)
// ============================================================================

async function processExistingModel(
	db: Database,
	existing: typeof aiAgentModels.$inferSelect,
	orModel: OrModel,
	providerKey: string,
	mappedPricing: MappedPricing,
	optionsSchema: object,
	defaultOptions: Record<string, unknown> | null,
	capabilities: object,
	rateById: Map<string, typeof aiPricingRates.$inferSelect>,
	toolCtx: ToolAssignmentContext,
	now: string,
	result: SyncResult
): Promise<void> {
	// Skip override-locked models (still update orRaw/orSyncedAt for reference)
	if (existing.syncStatus === 'override') {
		result.skipped++;
		await db
			.update(aiAgentModels)
			.set({ orRaw: orModel, orSyncedAt: now })
			.where(eq(aiAgentModels.id, existing.id));
		return;
	}

	// Check if pricing changed → create new versioned pricing rate
	const currentRate = existing.currentPricing
		? (rateById.get(existing.currentPricing) ?? null)
		: null;
	let newPricingId = existing.currentPricing;
	if (pricingChanged(currentRate, mappedPricing)) {
		newPricingId = await createPricingRate(db, mappedPricing, now);
		result.pricingUpdated++;
	}

	await db
		.update(aiAgentModels)
		.set({
			displayName: orModel.name,
			description: orModel.description,
			contextWindow: String(orModel.context_length),
			maxOutputTokens: orModel.top_provider.max_completion_tokens
				? String(orModel.top_provider.max_completion_tokens)
				: null,
			optionsSchema,
			defaultOptions,
			capabilities,
			currentPricing: newPricingId,
			orRaw: orModel,
			orSyncedAt: now,
			syncStatus: 'synced',
			updated: now
		})
		.where(eq(aiAgentModels.id, existing.id));

	// Ensure tools are assigned (idempotent — skips if already has tools)
	result.toolsAssigned += await assignDefaultTools(db, existing.id, providerKey, toolCtx);

	result.updated++;
}

// ============================================================================
// Process New Model (Create or Match Existing)
// ============================================================================

async function processNewModel(
	db: Database,
	orModel: OrModel,
	providerId: string,
	providerKey: string,
	mappedPricing: MappedPricing,
	optionsSchema: object,
	defaultOptions: Record<string, unknown> | null,
	capabilities: object,
	rateById: Map<string, typeof aiPricingRates.$inferSelect>,
	toolCtx: ToolAssignmentContext,
	now: string,
	result: SyncResult
): Promise<void> {
	const nativeModelId = stripProviderPrefix(orModel.id);

	// Try to match existing unsynced model by provider-native modelId
	// Exclude configKey models (infra models like embedding, transcription, etc.)
	const match = await db.query.aiAgentModels.findFirst({
		where: and(
			eq(aiAgentModels.modelId, nativeModelId),
			isNull(aiAgentModels.orModelId),
			eq(aiAgentModels.configKey, '')
		)
	});

	if (match) {
		// Link existing record to OR
		const currentRate = match.currentPricing ? (rateById.get(match.currentPricing) ?? null) : null;
		let newPricingId = match.currentPricing;
		if (pricingChanged(currentRate, mappedPricing)) {
			newPricingId = await createPricingRate(db, mappedPricing, now);
			result.pricingUpdated++;
		}

		await db
			.update(aiAgentModels)
			.set({
				orModelId: orModel.id,
				displayName: orModel.name,
				description: orModel.description,
				contextWindow: String(orModel.context_length),
				maxOutputTokens: orModel.top_provider.max_completion_tokens
					? String(orModel.top_provider.max_completion_tokens)
					: null,
				optionsSchema,
				defaultOptions,
				capabilities,
				currentPricing: newPricingId,
				orRaw: orModel,
				orSyncedAt: now,
				syncStatus: 'synced',
				updated: now
			})
			.where(eq(aiAgentModels.id, match.id));

		result.updated++;
		// Ensure tools are assigned (idempotent — skips if already has tools)
		result.toolsAssigned += await assignDefaultTools(db, match.id, providerKey, toolCtx);
	} else {
		// Brand new model
		const pricingId = await createPricingRate(db, mappedPricing, now);
		result.pricingUpdated++;

		const newModelId = generateId();

		await db.insert(aiAgentModels).values({
			id: newModelId,
			modelId: nativeModelId,
			displayName: orModel.name,
			description: orModel.description,
			isActive: true,
			isEnabled: false, // Admin must enable
			currentPricing: pricingId,
			provider: providerId,
			optionsSchema,
			defaultOptions,
			capabilities,
			contextWindow: String(orModel.context_length),
			maxOutputTokens: orModel.top_provider.max_completion_tokens
				? String(orModel.top_provider.max_completion_tokens)
				: null,
			configKey: '',
			serviceType: 'generation',
			orModelId: orModel.id,
			orRaw: orModel,
			orSyncedAt: now,
			syncStatus: 'synced',
			tagRule: null,
			isSystemDefault: false,
			created: now,
			updated: now
		});

		result.created++;
		// Assign default tools to brand new model
		result.toolsAssigned += await assignDefaultTools(db, newModelId, providerKey, toolCtx);
	}
}

// ============================================================================
// Tool Auto-Assignment
// ============================================================================

interface ToolAssignmentContext {
	builtinToolIds: string[];
	sdkToolsByProvider: Map<string, string[]>; // providerKey → tool IDs
}

/**
 * Load tool assignment context once per sync run.
 * Returns builtin tool IDs (assigned to all models) and
 * SDK tool IDs grouped by provider (assigned to matching-provider models only).
 */
async function loadToolAssignmentContext(db: Database): Promise<ToolAssignmentContext> {
	const tools = await db
		.select({ id: aiTools.id, toolType: aiTools.toolType, provider: aiTools.provider })
		.from(aiTools)
		.where(eq(aiTools.isActive, true));

	// Load providers for SDK tools
	const providerIds = [...new Set(tools.filter((t) => t.provider).map((t) => t.provider!))];
	const providers =
		providerIds.length > 0
			? await db.select().from(aiProviders).where(inArray(aiProviders.id, providerIds))
			: [];
	const providerKeyById = new Map(providers.map((p) => [p.id, p.providerKey]));

	const builtinToolIds: string[] = [];
	const sdkToolsByProvider = new Map<string, string[]>();

	for (const tool of tools) {
		if (tool.toolType === 'builtin') {
			builtinToolIds.push(tool.id);
		} else if (tool.toolType === 'sdk' && tool.provider) {
			const provKey = providerKeyById.get(tool.provider);
			if (provKey) {
				const arr = sdkToolsByProvider.get(provKey) ?? [];
				arr.push(tool.id);
				sdkToolsByProvider.set(provKey, arr);
			}
		}
	}

	return { builtinToolIds, sdkToolsByProvider };
}

/**
 * Assign default tools to a model. Inserts builtin tools for all models,
 * plus provider-specific SDK tools for matching providers.
 * Skips if model already has any tool assignments (idempotent).
 */
async function assignDefaultTools(
	db: Database,
	modelId: string,
	providerKey: string,
	toolCtx: ToolAssignmentContext
): Promise<number> {
	// Check if model already has tools assigned
	const existing = await db.query.aiAgentModelsSupportedTools.findFirst({
		where: eq(aiAgentModelsSupportedTools.sourceId, modelId),
		columns: { sourceId: true }
	});

	if (existing) return 0; // Already has tools, skip

	const toolIds = [
		...toolCtx.builtinToolIds,
		...(toolCtx.sdkToolsByProvider.get(providerKey) ?? [])
	];

	if (toolIds.length === 0) return 0;

	await db.insert(aiAgentModelsSupportedTools).values(
		toolIds.map((toolId, i) => ({
			sourceId: modelId,
			targetId: toolId,
			position: i + 1
		}))
	);

	return toolIds.length;
}

// ============================================================================
// Helpers
// ============================================================================

async function createPricingRate(
	db: Database,
	pricing: MappedPricing,
	now: string
): Promise<string> {
	const id = generateId();
	await db.insert(aiPricingRates).values({
		id,
		inputPricePer1M: pricing.inputPricePer1M,
		outputPricePer1M: pricing.outputPricePer1M,
		cachedInputPricePer1M: pricing.cachedInputPricePer1M,
		reasoningPricePer1M: pricing.reasoningPricePer1M,
		pricePerImage: pricing.pricePerImage,
		effectiveFrom: now,
		isActive: true,
		notes: `Auto-synced from OpenRouter at ${now}`,
		created: now,
		updated: now
	});
	return id;
}

async function fetchOpenRouterModels(): Promise<OrModel[]> {
	const response = await fetch('https://openrouter.ai/api/v1/models');
	if (!response.ok) {
		throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
	}
	const data = (await response.json()) as OrApiResponse;
	return data.data;
}
