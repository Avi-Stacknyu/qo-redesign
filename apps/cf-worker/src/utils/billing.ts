/**
 * Billing Utility
 *
 * Consolidated billing module merging cost-tracker.ts and pricing.ts.
 * Handles:
 * - Cost calculation from token usage
 * - AI operation tracking with cost events
 * - Token and credit ledger management
 * - Pricing lookups via Drizzle
 */

import type { Env } from '../types';
import type { AICostEvent, FlowCostTracker } from '../types/flow';
import type { Database } from '@repo/db/types';
import {
	aiAgentModels,
	aiTools,
	aiPricingRates,
	creditExchangeRates,
	userCreditBalance,
	coreTokenLedger,
	coreCreditLedger
} from '@repo/db/schema';
import { generateId } from '@repo/db/id';
import { eq, and, desc } from 'drizzle-orm';
// Import from model factory
import {
	type PricingRate,
	getModelConfig,
	getModelFromConfig,
	getEmbeddingModelFromConfig,
	getConfigPricing,
	loadInfraConfigs,
	clearConfigCache,
	transcribeAudio,
	documentToMarkdown
} from './model-factory';
import { embedMany, generateText, Output } from 'ai';
import { z } from 'zod';
import { createLogger, formatError } from './logger';
import { createKeyedTTLCache } from './ttl-cache';

// Re-exports for consumers
export type { FlowCostTracker };
export { loadInfraConfigs, clearConfigCache };

// ============================================================================
// Token Ledger Enums
// ============================================================================

enum CoreTokenLedgerProviderOptions {
	openai = 'openai',
	google = 'google',
	anthropic = 'anthropic',
	xai = 'xai',
	cloudflare = 'cloudflare'
}

enum CoreTokenLedgerCategoryOptions {
	prompt = 'prompt',
	completion = 'completion',
	embedding = 'embedding',
	tool = 'tool',
	vector = 'vector'
}

enum CoreTokenLedgerDirectionOptions {
	debit = 'debit',
	credit = 'credit'
}

// ============================================================================
// Constants
// ============================================================================

const TOKENS_PER_MILLION = 1_000_000;
const DEFAULT_CREDITS_PER_USD = 100;

// ============================================================================
// Types
// ============================================================================

export interface TrackedAIOptions {
	db: Database;
	userId: string;
	agentId?: string;
	messageId?: string;
	costTracker: FlowCostTracker;
	creditsPerUsd?: number;
	/** Identifies the service/process that triggered this AI call (e.g. 'document_conversion', 'chunk_contextualization', 'document_embedding') */
	purpose?: string;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a string looks like a valid record ID.
 * Prevents passing arbitrary strings into relation fields.
 */
function isValidRecordId(id: string | undefined | null): id is string {
	return typeof id === 'string' && id.length === 15 && /^[a-z0-9]+$/.test(id);
}

/**
 * Convert tokens to USD based on price per million
 */
function tokensToUsd(tokens: number, pricePerMillion: number): number {
	return (tokens / TOKENS_PER_MILLION) * pricePerMillion;
}

/**
 * Compute inference cost from AI SDK usage and pricing.
 * Single source of truth — handles input, output, cached, and reasoning tokens.
 * Use this everywhere instead of inline cost formulas.
 */
export function computeInferenceCost(
	pricing: PricingRate | null,
	usage: {
		inputTokens?: number;
		outputTokens?: number;
		cachedTokens?: number;
		reasoningTokens?: number;
	}
): {
	costUsd: number;
	tokens: { input: number; output: number; cached: number; reasoning: number };
} {
	const input = usage.inputTokens ?? 0;
	const output = usage.outputTokens ?? 0;
	const cached = usage.cachedTokens ?? 0;
	const reasoning = usage.reasoningTokens ?? 0;

	if (!pricing) {
		return { costUsd: 0, tokens: { input, output, cached, reasoning } };
	}

	const costUsd =
		tokensToUsd(input, pricing.input_price_per_1m ?? 0) +
		tokensToUsd(output, pricing.output_price_per_1m ?? 0) +
		tokensToUsd(cached, pricing.cached_input_price_per_1m ?? 0) +
		tokensToUsd(reasoning, pricing.reasoning_price_per_1m ?? pricing.output_price_per_1m ?? 0);

	return { costUsd, tokens: { input, output, cached, reasoning } };
}

/**
 * Build metadata for cached/reasoning tokens. Omits keys when zero.
 * Avoids repeating the same conditional spread in every cost-tracking site.
 */
export function extraTokenMeta(tokens: {
	cached: number;
	reasoning: number;
}): Record<string, number> {
	const m: Record<string, number> = {};
	if (tokens.cached > 0) m.cachedTokens = tokens.cached;
	if (tokens.reasoning > 0) m.reasoningTokens = tokens.reasoning;
	return m;
}

function mapModelToProvider(modelId: string): CoreTokenLedgerProviderOptions {
	if (modelId.startsWith('@cf/')) return CoreTokenLedgerProviderOptions.cloudflare;
	if (modelId.startsWith('gpt')) return CoreTokenLedgerProviderOptions.openai;
	if (modelId.startsWith('claude')) return CoreTokenLedgerProviderOptions.anthropic;
	if (modelId.startsWith('gemini')) return CoreTokenLedgerProviderOptions.google;
	return CoreTokenLedgerProviderOptions.cloudflare;
}

function mapOperationToCategory(operation: string): CoreTokenLedgerCategoryOptions {
	switch (operation) {
		case 'inference':
			return CoreTokenLedgerCategoryOptions.prompt;
		case 'embedding':
			return CoreTokenLedgerCategoryOptions.embedding;
		case 'toMarkdown':
		case 'reranking':
		case 'transcription':
		case 'tool':
		case 'object_generation':
			return CoreTokenLedgerCategoryOptions.tool;
		default:
			return CoreTokenLedgerCategoryOptions.prompt;
	}
}

// ============================================================================
// Pricing Lookups
// ============================================================================

/**
 * Get pricing for a model by model_id via the current_pricing relation
 */
const pricingCache = createKeyedTTLCache<PricingRate | null>(5 * 60 * 1000);

/** Map a raw Drizzle aiPricingRates row to a snake_case PricingRate. */
export function mapDrizzlePricing(pr: typeof aiPricingRates.$inferSelect): PricingRate {
	return {
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
	};
}

export async function getPricingForModel(
	db: Database,
	modelId: string
): Promise<PricingRate | null> {
	const cached = pricingCache.get(modelId);
	if (cached !== undefined) return cached;

	try {
		const model = await db.query.aiAgentModels.findFirst({
			where: and(eq(aiAgentModels.modelId, modelId), eq(aiAgentModels.isActive, true)),
			columns: { currentPricing: true }
		});

		if (!model?.currentPricing) {
			createLogger('Billing').warn('no_pricing_configured', { modelId });
			pricingCache.set(modelId, null);
			return null;
		}

		const pricing = await db.query.aiPricingRates.findFirst({
			where: eq(aiPricingRates.id, model.currentPricing)
		});

		const result = pricing ? mapDrizzlePricing(pricing) : null;
		pricingCache.set(modelId, result);
		return result;
	} catch (err) {
		createLogger('Billing').warn('get_pricing_for_model_failed', { modelId, ...formatError(err) });
		// Do NOT cache null on transient errors — next call should retry
		return null;
	}
}

/**
 * Get pricing for a tool by tool_name via the current_pricing relation
 */
export async function getPricingForTool(
	db: Database,
	toolKey: string
): Promise<PricingRate | null> {
	try {
		const tool = await db.query.aiTools.findFirst({
			where: and(eq(aiTools.toolKey, toolKey), eq(aiTools.isActive, true)),
			columns: { currentPricing: true }
		});

		if (!tool?.currentPricing) return null;

		const pricing = await db.query.aiPricingRates.findFirst({
			where: eq(aiPricingRates.id, tool.currentPricing)
		});

		return pricing ? mapDrizzlePricing(pricing) : null;
	} catch (err) {
		createLogger('Billing').warn('get_pricing_for_tool_failed', { toolKey, ...formatError(err) });
		return null;
	}
}

/**
 * Get active credits per USD exchange rate
 */
export async function getCreditsPerUsd(db: Database): Promise<number> {
	try {
		const record = await db.query.creditExchangeRates.findFirst({
			where: eq(creditExchangeRates.isActive, true),
			columns: { rate: true },
			orderBy: [desc(creditExchangeRates.effectiveFrom)]
		});

		const rate = record?.rate ? Number(record.rate) : DEFAULT_CREDITS_PER_USD;
		// Guard against NaN/Infinity from corrupted exchange rate data
		return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_CREDITS_PER_USD;
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error);
		const log = createLogger('Billing');
		log.warn('exchange_rate_fallback', {
			default: DEFAULT_CREDITS_PER_USD,
			error: errMsg
		});
		return DEFAULT_CREDITS_PER_USD;
	}
}

// ============================================================================
// Cost Tracker
// ============================================================================

export function createCostTracker(): FlowCostTracker {
	const events: AICostEvent[] = [];
	let totalCostUsd = 0;
	let totalCredits = 0;

	return {
		events,
		get totalCostUsd() {
			return totalCostUsd;
		},
		get totalCredits() {
			return totalCredits;
		},

		addEvent(event: AICostEvent) {
			// Sanitize values to prevent NaN propagation into ledger
			const sanitizedEvent: AICostEvent = {
				...event,
				costUsd: Number.isFinite(event.costUsd) ? event.costUsd : 0,
				credits: Number.isFinite(event.credits) ? event.credits : 0
			};
			events.push(sanitizedEvent);
			totalCostUsd += sanitizedEvent.costUsd;
			totalCredits += sanitizedEvent.credits;
		},

		getSummary() {
			const byOperation: Record<
				string,
				{
					count: number;
					costUsd: number;
					credits: number;
					inputTokens: number;
					outputTokens: number;
				}
			> = {};

			let totalInputTokens = 0;
			let totalOutputTokens = 0;

			for (const event of events) {
				if (!byOperation[event.operation]) {
					byOperation[event.operation] = {
						count: 0,
						costUsd: 0,
						credits: 0,
						inputTokens: 0,
						outputTokens: 0
					};
				}
				byOperation[event.operation].count++;
				byOperation[event.operation].costUsd += event.costUsd;
				byOperation[event.operation].credits += event.credits;

				const inputToks = event.tokens?.input ?? 0;
				const outputToks = event.tokens?.output ?? 0;
				byOperation[event.operation].inputTokens += inputToks;
				byOperation[event.operation].outputTokens += outputToks;
				totalInputTokens += inputToks;
				totalOutputTokens += outputToks;
			}

			return {
				byOperation,
				totalCostUsd,
				totalCredits,
				totalInputTokens,
				totalOutputTokens
			};
		}
	};
}

// ============================================================================
// AI Operation Wrappers with Cost Tracking
// ============================================================================

/**
 * Track embedding generation cost using AI SDK
 */
export async function trackEmbedding(
	env: Env,
	texts: string[],
	options: TrackedAIOptions,
	configKey = 'embedding_model'
): Promise<{ embeddings: number[][]; cost: AICostEvent }> {
	const startTime = Date.now();

	const config = await getModelConfig(options.db, configKey);
	const model = getEmbeddingModelFromConfig(config, env);

	const result = await embedMany({ model, values: texts });

	// AI SDK embedMany returns result.usage.tokens (single number) if provider supports it
	// Use real tokens when available, fall back to char/4 estimation
	const realTokens = (result.usage as any)?.tokens;
	const isEstimate = !(typeof realTokens === 'number' && realTokens > 0);
	const tokenCount = isEstimate ? Math.ceil(texts.join(' ').length / 4) : realTokens;

	const pricing = getConfigPricing(config);
	const inputPricePerMillion = pricing?.input_price_per_1m ?? 0;
	const costUsd = (tokenCount / 1_000_000) * inputPricePerMillion;
	const creditsPerUsd = options.creditsPerUsd ?? (await getCreditsPerUsd(options.db));
	const credits = costUsd * creditsPerUsd;

	const costEvent: AICostEvent = {
		operation: 'embedding',
		modelId: config.model_id,
		tokens: { input: tokenCount, output: 0 },
		costUsd,
		credits,
		pricingRateId: pricing?.id,
		metadata: {
			textCount: texts.length,
			...(isEstimate ? { tokenEstimate: true } : {}),
			duration_ms: Date.now() - startTime,
			...(options.purpose ? { purpose: options.purpose } : {})
		}
	};

	options.costTracker.addEvent(costEvent);
	return { embeddings: result.embeddings, cost: costEvent };
}

/**
 * Track AI.toMarkdown cost (document extraction)
 */
export async function trackToMarkdown(
	env: Env,
	files: Array<{ name: string; blob: Blob }>,
	options: TrackedAIOptions
): Promise<{
	results: Array<{ name: string; content: string; tokens: number; metadata?: unknown }>;
	cost: AICostEvent;
}> {
	const startTime = Date.now();

	const results = await documentToMarkdown(env, files);

	// CF toMarkdown returns real token counts per document
	const totalTokens = results.reduce((sum, item) => sum + (item.tokens || 0), 0);

	// Use configurable pricing from ai_pricing_rates if available,
	// fall back to CF's published $0.001/page rate (~3000 chars/page)
	const pricing = await getPricingForModel(options.db, 'cloudflare/ai-tomarkdown');
	let costUsd: number;

	if (pricing && (pricing.input_price_per_1m ?? 0) > 0) {
		// Per-token pricing from DB
		costUsd = (totalTokens / 1_000_000) * (pricing.input_price_per_1m ?? 0);
	} else {
		// Fallback: CF charges ~$0.001 per page (~3000 chars)
		const totalChars = results.reduce((sum, item) => sum + (item.content?.length ?? 0), 0);
		const estimatedPages = Math.max(1, Math.ceil(totalChars / 3000));
		costUsd = estimatedPages * 0.001;
	}

	const creditsPerUsd = options.creditsPerUsd ?? (await getCreditsPerUsd(options.db));
	const credits = costUsd * creditsPerUsd;

	const costEvent: AICostEvent = {
		operation: 'toMarkdown',
		modelId: 'cloudflare/ai-tomarkdown',
		tokens: { input: totalTokens, output: 0 },
		costUsd,
		credits,
		pricingRateId: pricing?.id,
		metadata: {
			fileCount: files.length,
			totalTokens,
			duration_ms: Date.now() - startTime,
			...(options.purpose ? { purpose: options.purpose } : {})
		}
	};

	options.costTracker.addEvent(costEvent);
	return { results, cost: costEvent };
}

/**
 * Track audio transcription cost
 */
export async function trackTranscription(
	env: Env,
	audioInput: string | number[],
	options: TrackedAIOptions & { audioDurationMs?: number },
	configKey = 'transcription_model'
): Promise<{
	text: string;
	vtt?: string;
	words?: Array<{ word: string; start: number; end: number }>;
	durationSeconds?: number;
	cost: AICostEvent;
}> {
	const startTime = Date.now();

	const result = await transcribeAudio(env, options.db, audioInput, configKey);

	const pricing = getConfigPricing(result.config);
	const pricePerMinute = pricing?.price_per_minute ?? 0;

	let audioDurationMinutes = 0;
	if (result.durationSeconds !== undefined) {
		audioDurationMinutes = result.durationSeconds / 60;
	} else if (result.words && result.words.length > 0) {
		const lastWord = result.words[result.words.length - 1];
		audioDurationMinutes = (lastWord.end ?? 0) / 60;
	} else if (options.audioDurationMs) {
		audioDurationMinutes = options.audioDurationMs / 60_000;
	} else {
		const wordCount = result.text.split(/\s+/).length;
		audioDurationMinutes = Math.max(0.1, wordCount / 150);
	}

	const costUsd = audioDurationMinutes * pricePerMinute;
	const creditsPerUsd = options.creditsPerUsd ?? (await getCreditsPerUsd(options.db));
	const credits = costUsd * creditsPerUsd;

	const costEvent: AICostEvent = {
		operation: 'transcription',
		modelId: result.modelId,
		costUsd,
		credits,
		pricingRateId: pricing?.id,
		metadata: {
			audioDurationMinutes,
			audioDurationSeconds: result.durationSeconds,
			wordCount: result.words?.length ?? result.text.split(/\s+/).length,
			duration_ms: Date.now() - startTime,
			...(options.purpose ? { purpose: options.purpose } : {})
		}
	};

	options.costTracker.addEvent(costEvent);
	return {
		text: result.text,
		vtt: result.vtt,
		words: result.words,
		durationSeconds: result.durationSeconds,
		cost: costEvent
	};
}

/**
 * Track LLM inference cost
 */
export async function trackInference(
	env: Env,
	messages: Array<{ role: string; content: string }>,
	options: TrackedAIOptions & { maxOutputTokens?: number },
	configKey = 'llm_model'
): Promise<{
	response: string;
	tokens: { input: number; output: number };
	cost: AICostEvent;
}> {
	const startTime = Date.now();

	const config = await getModelConfig(options.db, configKey);
	const model = getModelFromConfig(config, env);

	const systemMsg = messages.find((m) => m.role === 'system');
	const userMsg = messages.find((m) => m.role === 'user');

	const result = await generateText({
		model,
		system: systemMsg?.content,
		prompt: userMsg?.content ?? messages.map((m) => m.content).join('\n'),
		maxOutputTokens: options.maxOutputTokens,
		timeout: 30_000
	});

	const pricing = getConfigPricing(config);
	const { costUsd, tokens } = computeInferenceCost(pricing, result.usage);
	const creditsPerUsd = options.creditsPerUsd ?? (await getCreditsPerUsd(options.db));
	const credits = costUsd * creditsPerUsd;

	const costEvent: AICostEvent = {
		operation: 'inference',
		modelId: config.model_id,
		tokens: { input: tokens.input, output: tokens.output },
		costUsd,
		credits,
		pricingRateId: pricing?.id,
		metadata: {
			messageCount: messages.length,
			...extraTokenMeta(tokens),
			duration_ms: Date.now() - startTime,
			...(options.purpose ? { purpose: options.purpose } : {})
		}
	};

	options.costTracker.addEvent(costEvent);
	return {
		response: result.text,
		tokens: { input: tokens.input, output: tokens.output },
		cost: costEvent
	};
}

/**
 * Track JSON Mode generation cost
 */
export async function trackJsonObject<TObject>(
	env: Env,
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
	schema: z.ZodType<TObject>,
	options: TrackedAIOptions & { maxOutputTokens?: number },
	configKey = 'llm_model'
): Promise<{
	object: TObject;
	cost: AICostEvent;
}> {
	const startTime = Date.now();

	const config = await getModelConfig(options.db, configKey);
	const model = getModelFromConfig(config, env);

	const systemMsg = messages.find((m) => m.role === 'system');
	const userMsg = messages.find((m) => m.role === 'user');

	const result = await generateText({
		model,
		output: Output.object({ schema }),
		system: systemMsg?.content,
		prompt: userMsg?.content ?? messages.map((m) => m.content).join('\n'),
		maxOutputTokens: options.maxOutputTokens,
		timeout: 30_000
	});

	const pricing = getConfigPricing(config);
	const { costUsd, tokens } = computeInferenceCost(pricing, result.usage);
	const creditsPerUsd = options.creditsPerUsd ?? (await getCreditsPerUsd(options.db));
	const credits = costUsd * creditsPerUsd;

	const costEvent: AICostEvent = {
		operation: 'inference',
		modelId: config.model_id,
		tokens: { input: tokens.input, output: tokens.output },
		costUsd,
		credits,
		pricingRateId: pricing?.id,
		metadata: {
			messageCount: messages.length,
			structured: true,
			jsonMode: true,
			...extraTokenMeta(tokens),
			duration_ms: Date.now() - startTime,
			...(options.purpose ? { purpose: options.purpose } : {})
		}
	};

	options.costTracker.addEvent(costEvent);
	return {
		object: result.output as TObject,
		cost: costEvent
	};
}

// ============================================================================
// Ledger Functions
// ============================================================================

/**
 * Get user's current credit balance
 */
export async function getUserCreditBalance(db: Database, userId: string): Promise<number> {
	try {
		const [record] = await db
			.select({ balance: userCreditBalance.balance })
			.from(userCreditBalance)
			.where(eq(userCreditBalance.user, userId))
			.limit(1);
		const balance = record?.balance ? Number(record.balance) : 0;
		// Guard against NaN from corrupted ledger entries
		return Number.isNaN(balance) ? 0 : balance;
	} catch (err) {
		createLogger('Billing').warn('get_user_credit_balance_failed', { userId, ...formatError(err) });
		return 0;
	}
}

/**
 * Record all cost events to token ledger AND credit ledger
 */
export async function recordCostEventsToLedger(
	db: Database,
	costTracker: FlowCostTracker,
	context: {
		userId: string;
		messageId: string;
		agentId?: string;
		agentMultiplier?: number;
		chatId?: string;
	}
): Promise<void> {
	return recordCostEventsFromArray(db, costTracker.events, context);
}

/**
 * Record cost events from a plain array to token and credit ledgers.
 * Uses a Drizzle transaction for atomicity.
 */
export async function recordCostEventsFromArray(
	db: Database,
	events: AICostEvent[],
	context: {
		userId: string;
		messageId: string;
		agentId?: string;
		agentMultiplier?: number;
		chatId?: string;
	}
): Promise<void> {
	if (events.length === 0) return;

	const agentMultiplier = context.agentMultiplier ?? 1;
	const now = new Date().toISOString();

	let currentBalance: number;
	try {
		currentBalance = await getUserCreditBalance(db, context.userId);
	} catch (e) {
		const log = createLogger('Billing', { userId: context.userId });
		log.error('balance_fetch_failed_skipping_ledger', {
			...formatError(e),
			eventCount: events.length
		});
		// Don't write ledger rows with fabricated balanceBefore/After — cost data would be corrupted.
		// The cost events are still in memory if the caller wants to retry.
		return;
	}

	const log = createLogger('Billing', { userId: context.userId });

	try {
		const tokenRows: (typeof coreTokenLedger.$inferInsert)[] = [];
		const creditRows: (typeof coreCreditLedger.$inferInsert)[] = [];

		for (const event of events) {
			const inputTokens = Number(event.tokens?.input ?? 0);
			const outputTokens = Number(event.tokens?.output ?? 0);
			const rawTotal = inputTokens + outputTokens;
			const totalTokens = Number.isFinite(rawTotal) && rawTotal > 0 ? Math.round(rawTotal) : 1;

			// Guard against NaN/Infinity in credits - use 0 if invalid
			const rawCredits = event.credits * agentMultiplier;
			const finalCredits = Number.isFinite(rawCredits) ? rawCredits : 0;
			const newBalance = currentBalance - finalCredits;

			const tokenLedgerId = generateId();
			const creditLedgerId = generateId();

			tokenRows.push({
				id: tokenLedgerId,
				user: context.userId,
				messageId: context.messageId,
				chat: isValidRecordId(context.chatId) ? context.chatId : undefined,
				model: event.modelId,
				provider: mapModelToProvider(event.modelId),
				category: mapOperationToCategory(event.operation),
				direction: CoreTokenLedgerDirectionOptions.debit,
				tokens: String(totalTokens),
				costUsd: String(event.costUsd),
				pricingRateId: event.pricingRateId || undefined,
				agent: context.agentId,
				meta: {
					...(event.metadata ?? {}),
					tokenEstimate:
						event.metadata?.tokenEstimate === true || !(Number.isFinite(rawTotal) && rawTotal > 0),
					inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
					outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
					multiplier: agentMultiplier
				},
				eventTime: now,
				created: now,
				updated: now
			});

			creditRows.push({
				id: creditLedgerId,
				user: context.userId,
				type: 'debit',
				transactionType: 'usage',
				creditsChanged: String(finalCredits),
				balanceBefore: String(currentBalance),
				balanceAfter: String(newBalance),
				description: `AI ${event.operation}: ${event.modelId}`,
				tokenEntry: tokenLedgerId,
				pricingRateId: event.pricingRateId || undefined,
				created: now,
				updated: now
			});

			currentBalance = newBalance;
		}

		// Insert all rows in a transaction
		await db.transaction(async (tx) => {
			if (tokenRows.length > 0) {
				await tx.insert(coreTokenLedger).values(tokenRows);
			}
			if (creditRows.length > 0) {
				await tx.insert(coreCreditLedger).values(creditRows);
			}
		});
	} catch (e) {
		log.error('ledger_batch_failed', {
			...formatError(e),
			eventCount: events.length
		});
	}
}
