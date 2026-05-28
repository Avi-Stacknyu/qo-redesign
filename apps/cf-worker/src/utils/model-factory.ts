/**
 * Model Factory - Unified AI Provider Layer
 *
 * Single entry point for ALL AI model instantiation across the codebase.
 * Replaces duplicated provider switch statements in flow-executor.ts,
 * context-manager.ts, and cloudflare-ai.ts.
 *
 * Providers:
 * - cloudflare: via workers-ai-provider (text, embeddings, structured output)
 * - openai: via @ai-sdk/openai
 * - anthropic: via @ai-sdk/anthropic
 * - google: via @ai-sdk/google
 * - xai: via @ai-sdk/xai
 *
 * Intentionally kept wrappers for env.AI.run()-only operations:
 * - transcribeAudio: workers-ai-provider doesn't support experimental_transcribe
 * - documentToMarkdown: CF-specific AI.toMarkdown operation
 */

import { createWorkersAI } from 'workers-ai-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel, EmbeddingModel, RerankingModel } from 'ai';
import { rerank } from 'ai';
import type { Env } from '../types';
import { AIModelError, ConfigError } from './errors';

// ============================================================================
// Core Model Factory
// ============================================================================

/**
 * Get an AI SDK LanguageModel for any supported provider.
 * All AI text/chat/structured-output calls should go through this.
 */
export function getModel(provider: string, modelId: string, env: Env): LanguageModel {
	switch (provider.toLowerCase()) {
		case 'openai':
			if (!env.OPENAI_API_KEY)
				throw new ConfigError('OPENAI_API_KEY not configured', {
					code: 'MISSING_API_KEY',
					configKey: 'OPENAI_API_KEY'
				});
			return createOpenAI({ apiKey: env.OPENAI_API_KEY })(modelId);

		case 'anthropic':
			if (!env.ANTHROPIC_API_KEY)
				throw new ConfigError('ANTHROPIC_API_KEY not configured', {
					code: 'MISSING_API_KEY',
					configKey: 'ANTHROPIC_API_KEY'
				});
			return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(modelId);

		case 'google':
			if (!env.GOOGLE_AI_API_KEY)
				throw new ConfigError('GOOGLE_AI_API_KEY not configured', {
					code: 'MISSING_API_KEY',
					configKey: 'GOOGLE_AI_API_KEY'
				});
			return createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY })(modelId);

		case 'xai':
			if (!env.XAI_API_KEY)
				throw new ConfigError('XAI_API_KEY not configured', {
					code: 'MISSING_API_KEY',
					configKey: 'XAI_API_KEY'
				});
			return createXai({ apiKey: env.XAI_API_KEY })(modelId);

		case 'cloudflare': {
			const workersAI = createWorkersAI({ binding: env.AI });
			return workersAI(modelId as any);
		}

		default:
			throw new AIModelError(`Unsupported AI provider: ${provider}`, {
				provider,
				modelId,
				code: 'UNSUPPORTED_PROVIDER'
			});
	}
}

/**
 * Get an AI SDK EmbeddingModel for any supported provider.
 * Currently only Cloudflare Workers AI is used for embeddings.
 */
export function getEmbeddingModel(provider: string, modelId: string, env: Env): EmbeddingModel {
	switch (provider.toLowerCase()) {
		case 'cloudflare': {
			const workersAI = createWorkersAI({ binding: env.AI });
			return workersAI.textEmbeddingModel(modelId as any);
		}

		case 'openai':
			return createOpenAI({ apiKey: env.OPENAI_API_KEY }).textEmbeddingModel(modelId);

		default:
			throw new AIModelError(`Unsupported embedding provider: ${provider}`, {
				provider,
				modelId,
				code: 'UNSUPPORTED_EMBEDDING_PROVIDER'
			});
	}
}

// ============================================================================
// Config Loading (Drizzle)
// ============================================================================

import type { Database } from '@repo/db/types';
import { aiAgentModels, aiProviders, aiPricingRates } from '@repo/db/schema';
import { eq, and, desc, ne } from 'drizzle-orm';
import { createKeyedTTLCache } from './ttl-cache';

// ============================================================================
// Local Types (replacing PB-generated types)
// ============================================================================

/** Pricing rate — snake_case for backward compat with computeInferenceCost consumers */
export interface PricingRate {
	id: string;
	input_price_per_1m: number;
	output_price_per_1m: number;
	cached_input_price_per_1m: number;
	reasoning_price_per_1m: number;
	price_per_call: number;
	price_per_character: number;
	price_per_image: number;
	price_per_minute: number;
	price_per_second: number;
	effective_from: string;
	effective_until: string;
	is_active: boolean;
	notes: string;
	tier: string;
}

/** Provider config record */
export interface ProviderConfig {
	id: string;
	provider_key: string;
	display_name: string;
	base_url: string;
	docs_url: string;
	env_key_name: string;
	is_active: boolean;
	logo: string;
	default_headers: Record<string, unknown>;
	website_url: string;
}

/**
 * Infra model config — an ai_agent_models record with config_key, expanded with provider + pricing.
 */
export interface InfraModelConfig {
	id: string;
	model_id: string;
	display_name: string;
	description: string;
	is_active: boolean;
	is_enabled: boolean;
	current_pricing: string;
	provider: string;
	options_schema: unknown;
	default_options: unknown;
	capabilities: unknown;
	context_window: number;
	max_output_tokens: number;
	is_system_default: boolean;
	tag_rule: unknown;
	config_key: string;
	service_type: string;
	// Resolved relation data (flat, was expand.provider / expand.current_pricing)
	providerConfig: ProviderConfig | null;
	pricingRate: PricingRate | null;
}

// Per-request cache (5 min TTL)
const configCache = createKeyedTTLCache<InfraModelConfig>(5 * 60 * 1000);
let configCacheSnapshot = new Map<string, InfraModelConfig>();
let configLoaded = false;
let configLoadedAt = 0;
const CONFIG_TTL = 5 * 60 * 1000;

/**
 * Map a Drizzle row (model + joined provider + pricing) to the InfraModelConfig shape.
 * Numeric pricing fields are converted from string to number.
 */
function mapToInfraConfig(row: {
	model: typeof aiAgentModels.$inferSelect;
	provider: typeof aiProviders.$inferSelect | null;
	pricing: typeof aiPricingRates.$inferSelect | null;
}): InfraModelConfig {
	const m = row.model;
	const p = row.provider;
	const pr = row.pricing;

	const providerExpand: ProviderConfig | undefined = p
		? {
				id: p.id,
				provider_key: p.providerKey ?? '',
				display_name: p.displayName ?? '',
				base_url: p.baseUrl ?? '',
				docs_url: p.docsUrl ?? '',
				env_key_name: p.envKeyName ?? '',
				is_active: p.isActive ?? false,
				logo: p.logo ?? '',
				default_headers: (p.defaultHeaders as Record<string, unknown>) ?? {},
				website_url: p.websiteUrl ?? ''
			}
		: undefined;

	const pricingExpand: PricingRate | undefined = pr
		? {
				id: pr.id,
				input_price_per_1m: pr.inputPricePer1M ? Number(pr.inputPricePer1M) : 0,
				output_price_per_1m: pr.outputPricePer1M ? Number(pr.outputPricePer1M) : 0,
				cached_input_price_per_1m: pr.cachedInputPricePer1M ? Number(pr.cachedInputPricePer1M) : 0,
				reasoning_price_per_1m: pr.reasoningPricePer1M ? Number(pr.reasoningPricePer1M) : 0,
				price_per_call: pr.pricePerCall ? Number(pr.pricePerCall) : 0,
				price_per_character: pr.pricePerCharacter ? Number(pr.pricePerCharacter) : 0,
				price_per_image: pr.pricePerImage ? Number(pr.pricePerImage) : 0,
				price_per_minute: pr.pricePerMinute ? Number(pr.pricePerMinute) : 0,
				price_per_second: pr.pricePerSecond ? Number(pr.pricePerSecond) : 0,
				effective_from: pr.effectiveFrom ?? '',
				effective_until: pr.effectiveUntil ?? '',
				is_active: pr.isActive ?? false,
				notes: pr.notes ?? '',
				tier: pr.tier ?? ''
			}
		: undefined;

	return {
		id: m.id,
		model_id: m.modelId ?? '',
		display_name: m.displayName ?? '',
		description: m.description ?? '',
		is_active: m.isActive ?? false,
		is_enabled: m.isEnabled ?? false,
		current_pricing: m.currentPricing ?? '',
		provider: m.provider ?? '',
		options_schema: m.optionsSchema ?? {},
		default_options: m.defaultOptions ?? {},
		capabilities: m.capabilities ?? {},
		context_window: m.contextWindow ? Number(m.contextWindow) : 0,
		max_output_tokens: m.maxOutputTokens ? Number(m.maxOutputTokens) : 0,
		is_system_default: m.isSystemDefault ?? false,
		tag_rule: m.tagRule ?? {},
		config_key: m.configKey ?? '',
		service_type: m.serviceType ?? '',
		providerConfig: providerExpand ?? null,
		pricingRate: pricingExpand ?? null
	};
}

/**
 * Load all active infra model configurations from the database.
 * These are ai_agent_models records that have a config_key set.
 */
export async function loadInfraConfigs(db: Database): Promise<Map<string, InfraModelConfig>> {
	// Return cached entries if still within TTL
	if (configLoaded && Date.now() - configLoadedAt < CONFIG_TTL) {
		// Rebuild map view from keyed cache — callers expect Map<string, InfraModelConfig>
		// This is a lightweight wrapper; the keyed cache is the source of truth.
		return configCacheSnapshot;
	}

	try {
		const rows = await db
			.select({
				model: aiAgentModels,
				provider: aiProviders,
				pricing: aiPricingRates
			})
			.from(aiAgentModels)
			.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
			.leftJoin(aiPricingRates, eq(aiAgentModels.currentPricing, aiPricingRates.id))
			.where(and(ne(aiAgentModels.configKey, ''), eq(aiAgentModels.isActive, true)))
			.orderBy(aiAgentModels.configKey, desc(aiAgentModels.created));

		configCache.clear();
		configCacheSnapshot = new Map();
		for (const row of rows) {
			const config = mapToInfraConfig(row);
			if (config.config_key && !configCacheSnapshot.has(config.config_key)) {
				configCache.set(config.config_key, config);
				configCacheSnapshot.set(config.config_key, config);
			}
			if (!configCacheSnapshot.has(config.model_id)) {
				configCache.set(config.model_id, config);
				configCacheSnapshot.set(config.model_id, config);
			}
		}

		configLoaded = true;
		configLoadedAt = Date.now();
		return configCacheSnapshot;
	} catch {
		throw new ConfigError('Failed to load infra model configuration', {
			configKey: 'ai_agent_models',
			code: 'INFRA_CONFIG_LOAD_FAILED'
		});
	}
}

/**
 * Get a specific infra model config by key. Throws if not found.
 */
export async function getModelConfig(db: Database, configKey: string): Promise<InfraModelConfig> {
	const configs = await loadInfraConfigs(db);
	const config = configs.get(configKey);

	if (!config) {
		throw new ConfigError(`Infra model config not found for key: ${configKey}`, {
			configKey,
			code: 'INFRA_CONFIG_NOT_FOUND'
		});
	}

	return config;
}

/**
 * Get a model config with automatic fallback.
 * Tries `preferredKey` first; falls back to `fallbackKey` if not found.
 */
export async function getModelConfigWithFallback(
	db: Database,
	preferredKey: string,
	fallbackKey = 'llm_model'
): Promise<InfraModelConfig> {
	try {
		return await getModelConfig(db, preferredKey);
	} catch {
		return await getModelConfig(db, fallbackKey);
	}
}

/**
 * Get active pricing for an infra model config
 */
export function getConfigPricing(config: InfraModelConfig): PricingRate | null {
	return config.pricingRate ?? null;
}

/**
 * Get a LanguageModel from an infra config, using the config's provider relation.
 * Eliminates the need to hardcode 'cloudflare' at every callsite.
 */
export function getModelFromConfig(config: InfraModelConfig, env: Env): LanguageModel {
	const providerKey = config.providerConfig?.provider_key;
	if (!providerKey) {
		throw new ConfigError(`No provider configured for infra model: ${config.display_name}`, {
			configKey: config.config_key,
			code: 'NO_PROVIDER_CONFIGURED'
		});
	}
	return getModel(providerKey, config.model_id, env);
}

/**
 * Get an EmbeddingModel from an infra config, using the config's provider relation.
 */
export function getEmbeddingModelFromConfig(config: InfraModelConfig, env: Env): EmbeddingModel {
	const providerKey = config.providerConfig?.provider_key;
	if (!providerKey) {
		throw new ConfigError(`No provider configured for infra model: ${config.display_name}`, {
			configKey: config.config_key,
			code: 'NO_PROVIDER_CONFIGURED'
		});
	}
	return getEmbeddingModel(providerKey, config.model_id, env);
}

/**
 * Clear the config cache (call at start of each request)
 */
export function clearConfigCache(): void {
	configCache.clear();
	configLoaded = false;
	configLoadedAt = 0;
	configCacheSnapshot = new Map();
}

// ============================================================================
// Reranking (via AI SDK)
// ============================================================================

/**
 * Get an AI SDK RerankingModel for any supported provider.
 * Currently Cloudflare Workers AI is the only backend with reranking.
 */
export function getRerankingModel(provider: string, modelId: string, env: Env): RerankingModel {
	switch (provider.toLowerCase()) {
		case 'cloudflare': {
			const workersAI = createWorkersAI({ binding: env.AI });
			return workersAI.reranking(modelId as any);
		}

		default:
			throw new AIModelError(`Unsupported reranking provider: ${provider}`, {
				provider,
				modelId,
				code: 'UNSUPPORTED_RERANKING_PROVIDER'
			});
	}
}

/**
 * Rerank documents using AI SDK's provider-agnostic rerank() function.
 * Returns results sorted by relevance score.
 */
export async function rerankDocuments(
	env: Env,
	db: Database,
	query: string,
	contexts: Array<{ text: string }>,
	topK = 5,
	configKey = 'reranking_model'
): Promise<{
	results: Array<{ id: number; score: number }>;
	modelId: string;
	config: InfraModelConfig;
}> {
	const config = await getModelConfig(db, configKey);
	const providerKey = config.providerConfig?.provider_key ?? 'cloudflare';
	const model = getRerankingModel(providerKey, config.model_id, env);

	const { ranking } = await rerank({
		model,
		query,
		documents: contexts.map((c) => c.text),
		topN: topK
	});

	const results = ranking.map((r) => ({
		id: r.originalIndex,
		score: r.score ?? 0
	}));

	return { results, modelId: config.model_id, config };
}

/**
 * Transcribe audio using Cloudflare Whisper.
 * workers-ai-provider doesn't support experimental_transcribe yet.
 */
export async function transcribeAudio(
	env: { AI: Ai },
	db: Database,
	audioInput: string | number[],
	configKey = 'transcription_model'
): Promise<{
	text: string;
	vtt?: string;
	words?: Array<{ word: string; start: number; end: number }>;
	durationSeconds?: number;
	modelId: string;
	config: InfraModelConfig;
}> {
	const config = await getModelConfig(db, configKey);
	const modelId = config.model_id;
	const isTurboModel = modelId.includes('whisper-large-v3-turbo');

	let inputPayload: { audio: string | number[] };

	if (isTurboModel) {
		if (typeof audioInput === 'string') {
			inputPayload = { audio: audioInput };
		} else {
			const uint8 = new Uint8Array(audioInput);
			let binary = '';
			for (let i = 0; i < uint8.length; i++) {
				binary += String.fromCharCode(uint8[i]);
			}
			inputPayload = { audio: btoa(binary) };
		}
	} else {
		if (typeof audioInput === 'string') {
			const binaryString = atob(audioInput);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			inputPayload = { audio: Array.from(bytes) };
		} else {
			inputPayload = { audio: audioInput };
		}
	}

	const response = (await env.AI.run(modelId as any, inputPayload)) as {
		text?: string;
		vtt?: string;
		word_count?: number;
		words?: Array<{ word: string; start: number; end: number }>;
		transcription_info?: {
			language?: string;
			language_probability?: number;
			duration?: number;
			duration_after_vad?: number;
		};
		segments?: Array<{
			start: number;
			end: number;
			text: string;
			words?: Array<{ word: string; start: number; end: number }>;
		}>;
	};

	let words: Array<{ word: string; start: number; end: number }> | undefined;
	if (response.words) {
		words = response.words;
	} else if (response.segments) {
		words = response.segments.flatMap((seg) => seg.words || []);
	}

	return {
		text: response.text || '',
		vtt: response.vtt,
		words,
		durationSeconds: response.transcription_info?.duration,
		modelId: config.model_id,
		config
	};
}

/**
 * Convert document to markdown using CF-specific AI.toMarkdown.
 * CF returns ConversionResponse: { name, mimeType, format, tokens, data }
 * We surface the `tokens` field so callers can use real cost data.
 */
export async function documentToMarkdown(
	env: { AI: Ai },
	files: Array<{ name: string; blob: Blob }>
): Promise<Array<{ name: string; content: string; tokens: number; metadata?: unknown }>> {
	const response = await (env.AI as any).toMarkdown(files);
	const items = Array.isArray(response) ? response : [];

	return items.map((item: any) => ({
		name: item.name,
		content: item.data || '',
		tokens: item.tokens ?? 0,
		metadata: item.metadata
	}));
}
