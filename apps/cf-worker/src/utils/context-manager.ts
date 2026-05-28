/**
 * Context Manager
 *
 * Manages conversation context for long chats.
 * Configured PER-AGENT in the flow editor via context_management config.
 *
 * Strategies:
 * - sliding_window: Keep last N messages only, drop older ones
 * - hybrid: Keep last N messages verbatim + auto-summarize older messages
 *
 * Safety: A hard message ceiling (HARD_MESSAGE_CEILING) is enforced even when
 * context management is disabled. This prevents runaway token usage from blowing
 * up the model's context window on very long conversations.
 *
 * Architecture (in-memory summary):
 * - During an active session, summary state lives in Durable Object memory
 *   (AgentState.contextSummaries) — zero DB reads/writes per message.
 * - On session timeout (onSessionTimeout), summary is persisted to DB (chats.meta).
 * - On session resume (cache miss in loadOrCacheConversation), summary is loaded
 *   from DB into DO state.
 *
 * Pre-trigger optimization:
 * - Summarization fires at (trigger_threshold - 1) unsummarized messages,
 *   so the summary is ready 1 message before the gap would otherwise grow.
 *
 * Model resolution uses the same pattern as LLM nodes:
 * - summarization.model_id references resolved.models from CompiledFlowConfig
 * - Supports any provider configured in ai_models collection
 * - Each agent must have its own summarization prompt (no defaults)
 */

import { generateText } from 'ai';
import type { Database } from '@repo/db/types';
import { chats } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import type {
	FlowCostTracker,
	ContextManagementConfig,
	Message,
	CompiledFlowConfig
} from '../types/flow';
import { getPrompt, interpolatePrompt } from './prompts';
import {
	getPricingForModel,
	getCreditsPerUsd,
	computeInferenceCost,
	extraTokenMeta
} from './billing';
import { getModel } from './model-factory';
import { createLogger, formatError } from './logger';
import { ConfigError, AIModelError } from './errors';

// ============================================================================
// Constants
// ============================================================================

/**
 * Hard ceiling on messages sent to the LLM, regardless of strategy.
 * Prevents context window overflow even when context management is disabled.
 * At ~200 tokens/message avg, 150 messages ≈ 30k tokens — safe for all models.
 */
export const HARD_MESSAGE_CEILING = 150;

// ============================================================================
// Types
// ============================================================================

interface ContextManagerOptions {
	db: Database;
	env: Env;
	chatId: string;
	config: ContextManagementConfig;
	flowConfig: CompiledFlowConfig; // Needed for model resolution
	costTracker?: FlowCostTracker;
}

export interface ManagedContext {
	// Summary of older messages (if any)
	summary: string | null;
	// Recent messages kept verbatim (these REPLACE conversationHistory for the executor)
	recentMessages: Message[];
	// Whether summarization was triggered this call
	wasSummarized: boolean;
	// Whether the hard ceiling was applied
	hardCeilingApplied: boolean;
	// Updated summary state for the caller to persist in DO state
	summaryState: SummaryState | null;
	// Stats for debugging
	stats: {
		totalMessages: number;
		summarizedCount: number;
		recentCount: number;
		strategy: ContextManagementConfig['strategy'] | 'hard_ceiling';
	};
}

export interface ChatMeta {
	summary?: string;
	summaryMessageCount?: number;
	lastSummarizedAt?: string;
}

/**
 * In-memory summary state kept in Durable Object state during active session.
 * Only persisted to the database (chats.meta) on session timeout.
 * This eliminates DB reads/writes on every message.
 */
export interface SummaryState {
	summary: string;
	summarizedMessageCount: number;
	lastSummarizedAt: string;
}

// ============================================================================
// Default Config (used when flow has no context_management)
// ============================================================================

export const DEFAULT_CONTEXT_CONFIG: ContextManagementConfig = {
	enabled: false,
	strategy: 'sliding_window',
	sliding_window_size: 10
};

const log = createLogger('ContextManager');

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Build managed context for a chat based on agent's context_management config.
 *
 * IMPORTANT: The returned `recentMessages` MUST be used as the conversation
 * history passed to the executor — NOT the original full history.
 */
export async function buildManagedContext(
	options: ContextManagerOptions,
	conversationHistory: Message[],
	cachedSummary?: SummaryState | null
): Promise<ManagedContext> {
	const { config, chatId } = options;
	const total = conversationHistory.length;

	// ── Disabled: apply hard ceiling only ──────────────────────────────
	if (!config.enabled) {
		if (total > HARD_MESSAGE_CEILING) {
			log.warn('hard_ceiling_applied', {
				chatId,
				totalMessages: total,
				ceiling: HARD_MESSAGE_CEILING
			});
			return {
				summary: null,
				recentMessages: conversationHistory.slice(-HARD_MESSAGE_CEILING),
				wasSummarized: false,
				hardCeilingApplied: true,
				summaryState: cachedSummary ?? null,
				stats: {
					totalMessages: total,
					summarizedCount: 0,
					recentCount: HARD_MESSAGE_CEILING,
					strategy: 'hard_ceiling'
				}
			};
		}
		return {
			summary: null,
			recentMessages: conversationHistory,
			wasSummarized: false,
			hardCeilingApplied: false,
			summaryState: cachedSummary ?? null,
			stats: {
				totalMessages: total,
				summarizedCount: 0,
				recentCount: total,
				strategy: 'sliding_window'
			}
		};
	}

	// ── Strategy: sliding_window — keep last N messages ───────────────
	if (config.strategy === 'sliding_window') {
		const windowSize = Math.min(config.sliding_window_size, HARD_MESSAGE_CEILING);
		const recentMessages = conversationHistory.slice(-windowSize);
		return {
			summary: null,
			recentMessages,
			wasSummarized: false,
			hardCeilingApplied: windowSize !== config.sliding_window_size,
			summaryState: null,
			stats: {
				totalMessages: total,
				summarizedCount: 0,
				recentCount: recentMessages.length,
				strategy: 'sliding_window'
			}
		};
	}

	// ── Strategy: hybrid — summarize older + keep recent verbatim ─────
	if (config.strategy === 'hybrid') {
		// Fallback: if summarization config is incomplete, degrade to sliding_window
		if (
			!config.summarization ||
			!config.summarization.model_id ||
			!config.summarization.prompt_key
		) {
			log.warn('hybrid_fallback_to_sliding_window', {
				chatId,
				reason: !config.summarization
					? 'missing_summarization_config'
					: !config.summarization.model_id
						? 'missing_model_id'
						: 'missing_prompt_key'
			});
			const windowSize = Math.min(config.sliding_window_size, HARD_MESSAGE_CEILING);
			const recentMessages = conversationHistory.slice(-windowSize);
			return {
				summary: null,
				recentMessages,
				wasSummarized: false,
				hardCeilingApplied: windowSize !== config.sliding_window_size,
				summaryState: null,
				stats: {
					totalMessages: total,
					summarizedCount: 0,
					recentCount: recentMessages.length,
					strategy: 'sliding_window'
				}
			};
		}

		const windowSize = Math.min(config.sliding_window_size, HARD_MESSAGE_CEILING);
		const recentMessages = conversationHistory.slice(-windowSize);
		const olderMessages = conversationHistory.slice(0, -windowSize);

		// Use in-memory cached summary (from DO state), not PB
		let summary = cachedSummary?.summary ?? null;
		let wasSummarized = false;
		let summaryState: SummaryState | null = cachedSummary ?? null;

		// Check if we need to generate new summary
		// Pre-trigger: fire at (threshold - 1) so the summary is ready 1 message
		// before the gap would otherwise grow. This reduces the max unsummarized
		// gap from (threshold - 1) to (threshold - 2) messages.
		const unsummarizedCount = olderMessages.length - (cachedSummary?.summarizedMessageCount ?? 0);
		const preTriggerThreshold = Math.max(1, config.summarization.trigger_threshold - 1);
		const shouldSummarize = unsummarizedCount >= preTriggerThreshold;

		if (shouldSummarize && olderMessages.length > 0) {
			summary = await generateSummary(options, olderMessages, cachedSummary?.summary ?? null);
			wasSummarized = true;

			// Update in-memory state only — DB is written on session timeout
			summaryState = {
				summary,
				summarizedMessageCount: olderMessages.length,
				lastSummarizedAt: new Date().toISOString()
			};
		}

		return {
			summary,
			recentMessages,
			wasSummarized,
			hardCeilingApplied: windowSize !== config.sliding_window_size,
			summaryState,
			stats: {
				totalMessages: total,
				summarizedCount: olderMessages.length,
				recentCount: recentMessages.length,
				strategy: 'hybrid'
			}
		};
	}

	// ── Fallback (should not reach here) — apply hard ceiling ─────────
	const recentMessages = conversationHistory.slice(-HARD_MESSAGE_CEILING);
	return {
		summary: null,
		recentMessages,
		wasSummarized: false,
		hardCeilingApplied: total > HARD_MESSAGE_CEILING,
		summaryState: null,
		stats: {
			totalMessages: total,
			summarizedCount: 0,
			recentCount: recentMessages.length,
			strategy: 'sliding_window'
		}
	};
}

/**
 * Generate summary using agent-configured model and prompt
 * Uses resolved.models pattern (same as LLM nodes)
 */
async function generateSummary(
	options: ContextManagerOptions,
	messages: Message[],
	existingSummary: string | null
): Promise<string> {
	const { db, env, config, flowConfig, costTracker } = options;

	if (!config.summarization) {
		throw new ConfigError('Summarization config required', {
			code: 'MISSING_SUMMARIZATION_CONFIG',
			configKey: 'summarization'
		});
	}

	// Get agent-specific prompt (REQUIRED - no fallback)
	const promptTemplate = await getPrompt(db, config.summarization.prompt_key);
	if (!promptTemplate) {
		throw new ConfigError(`Summarization prompt not found: ${config.summarization.prompt_key}`, {
			code: 'PROMPT_NOT_FOUND',
			configKey: config.summarization.prompt_key
		});
	}

	// Format conversation for prompt
	const conversationText = messages
		.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
		.join('\n\n');

	// Include existing summary if present (incremental summarization)
	const fullConversation = existingSummary
		? `[Previous Summary]\n${existingSummary}\n\n[New Messages]\n${conversationText}`
		: conversationText;

	const prompt = interpolatePrompt(promptTemplate, {
		conversation: fullConversation,
		messageCount: messages.length
	});

	// Get model using resolved.models pattern (same as LLM nodes)
	const resolvedModel = flowConfig.resolved.models[config.summarization.model_id];
	if (!resolvedModel) {
		throw new AIModelError(`Model ${config.summarization.model_id} not found in resolved.models`, {
			modelId: config.summarization.model_id,
			code: 'MODEL_NOT_RESOLVED'
		});
	}
	const model = getModel(resolvedModel.provider_key, resolvedModel.model_id, env);

	// Generate summary
	const { text: summary, usage } = await generateText({
		model,
		prompt,
		...(config.summarization.max_tokens && { maxOutputTokens: config.summarization.max_tokens }),
		timeout: 30_000
	});

	// Track cost
	if (costTracker) {
		const resolvedModel = flowConfig.resolved.models[config.summarization.model_id];

		// CF returns real token counts for all generateText calls
		const pricing = await getPricingForModel(db, config.summarization.model_id);
		const { costUsd, tokens } = computeInferenceCost(pricing, usage);

		const creditsPerUsd = await getCreditsPerUsd(db);
		const credits = costUsd * creditsPerUsd;

		costTracker.addEvent({
			operation: 'inference',
			modelId: config.summarization.model_id,
			tokens: {
				input: tokens.input,
				output: tokens.output
			},
			costUsd,
			credits,
			pricingRateId: pricing?.id ?? resolvedModel?.pricing_id,
			metadata: {
				purpose: 'chat_summarization',
				provider: resolvedModel?.provider_key,
				...extraTokenMeta(tokens)
			}
		});
	}

	const log = createLogger('ContextManager');
	log.info('summary_generated', {
		chars: summary.length,
		modelId: config.summarization.model_id
	});

	return summary.trim();
}

// ============================================================================
// Chat Meta Helpers
// ============================================================================

export async function getChatMeta(db: Database, chatId: string): Promise<ChatMeta | null> {
	try {
		const chat = await db.query.chats.findFirst({
			where: eq(chats.id, chatId),
			columns: { meta: true }
		});
		return (chat?.meta as ChatMeta) || null;
	} catch {
		return null;
	}
}

export async function updateChatMeta(
	db: Database,
	chatId: string,
	updates: Partial<ChatMeta>
): Promise<void> {
	try {
		const existing = await getChatMeta(db, chatId);
		await db
			.update(chats)
			.set({ meta: { ...existing, ...updates }, updated: new Date().toISOString() })
			.where(eq(chats.id, chatId));
	} catch (error) {
		const log = createLogger('ContextManager');
		log.error('chat_meta_update_failed', { chatId, ...formatError(error) });
	}
}

// ============================================================================
// Utility: Format Context for System Prompt
// ============================================================================

/**
 * Format managed context for injection into system prompt.
 *
 * Only injects the conversation summary (if any) from hybrid strategy.
 * Recent messages are NOT included here — they are passed directly as the
 * message array to the LLM via managedContext.recentMessages.
 */
export function formatManagedContextForPrompt(context: ManagedContext): string {
	if (!context.summary) return '';

	return (
		`## Conversation Summary (${context.stats.summarizedCount} earlier messages):\n` +
		`${context.summary}\n\n`
	);
}
