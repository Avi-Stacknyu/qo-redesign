/**
 * Suggestion Engine
 *
 * Handles AI-generated personalized chat suggestions and user profile summary
 * generation with smart caching, rate limiting, and background regeneration.
 */

import { type Env, type GraphNode, type UserContext } from '../types';
import { getDb } from '../lib/db';
import type { Database } from '@repo/db/types';
import type { MemoryGraphService } from './memory-graph-service';
import { userChatSuggestions, userProfileSummaries, coreTokenLedger, users } from '@repo/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import {
	getPrompt,
	interpolatePrompt,
	PERSONALIZED_SUGGESTIONS_SYSTEM,
	PERSONALIZED_SUGGESTIONS_USER,
	PROFILE_SUMMARY_SYSTEM,
	PROFILE_SUMMARY_USER
} from '../utils/prompts';
import { createLogger, formatError } from '../utils/logger';
import { createCostTracker, trackJsonObject, recordCostEventsToLedger } from '../utils/billing';
import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** Timeout for AI generation calls (30 seconds) */
const AI_TIMEOUT_MS = 30_000;

/** Suggestion regeneration - max 1 regen per day per agent */
const SUGGESTION_RATE_LIMIT_HOURS = 24;

/** Token threshold for suggestion regeneration (~15-20 meaningful user messages) */
const SUGGESTION_TOKEN_THRESHOLD = 1500;

/** Number of suggestions to generate per agent */
const SUGGESTIONS_PER_AGENT = 12;

/** Profile summary regeneration - max 1 regen per day */
const PROFILE_SUMMARY_RATE_LIMIT_HOURS = 24;

/** Token threshold for profile summary regeneration */
const PROFILE_SUMMARY_TOKEN_THRESHOLD = 1500;

// ============================================================================
// Types
// ============================================================================

/** Suggestion type returned by getCachedSuggestions */
export interface ChatSuggestion {
	title: string;
	description: string;
	prompt: string;
	icon: 'analysis' | 'planning' | 'research' | 'action';
}

/**
 * Dependencies required by the suggestion engine.
 * Uses MemoryGraphService for direct Postgres queries (no cache layer).
 */
export interface SuggestionEngineDeps {
	env: Env;
	graph: MemoryGraphService;
	userId: string;
	/** ExecutionContext for background work via waitUntil(). If omitted, background work runs as floating promises (unsafe on Workers). */
	ctx?: ExecutionContext;
}

// ============================================================================
// Pure Utility Functions
// ============================================================================

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
		)
	]);
}

function getDefaultSuggestions(): ChatSuggestion[] {
	return [
		{
			title: 'Financial Analysis',
			description: 'Check how my finances are doing',
			prompt:
				'How did my finances perform this quarter? Show me the key trends in revenue, expenses, and profitability.',
			icon: 'analysis'
		},
		{
			title: 'Tax Planning',
			description: 'Find ways to reduce my taxes',
			prompt:
				'What tax-saving strategies can I use this year? I want to know about deductions and optimal investment timing.',
			icon: 'planning'
		},
		{
			title: 'Market Research',
			description: 'Explore sustainable investing trends',
			prompt:
				'What are the latest trends in ESG and sustainable investing? Are there good opportunities I should look into?',
			icon: 'research'
		},
		{
			title: 'Portfolio Review',
			description: 'See if my portfolio needs changes',
			prompt:
				'Can you review my investment portfolio and tell me if I should rebalance anything given current market conditions?',
			icon: 'action'
		}
	];
}

function groupFactsByCategory(facts: GraphNode[]): Record<string, GraphNode[]> {
	const grouped: Record<string, GraphNode[]> = {};

	for (const fact of facts) {
		const category = ((fact.data as Record<string, unknown>)?.category as string) || 'General';
		if (!grouped[category]) {
			grouped[category] = [];
		}
		grouped[category].push(fact);
	}

	return grouped;
}

function getDefaultProfileSummary(): string {
	return `# Client Profile Summary

## Overview
This is a new client profile with limited information available.

## Next Steps
- Schedule an initial consultation to gather client information
- Conduct a comprehensive financial needs assessment
- Document client preferences and communication style

---
*Generated automatically. Update with actual client data as it becomes available.*`;
}

// ============================================================================
// Data Access Helpers
// ============================================================================

async function fetchCachedSuggestions(
	db: Database,
	userId: string,
	agentId: string
): Promise<{
	id: string;
	suggestions: ChatSuggestion[];
	generated_at: string;
	input_tokens_at_generation: number;
	intent_count_at_generation: number;
} | null> {
	try {
		const record = await db.query.userChatSuggestions.findFirst({
			where: and(eq(userChatSuggestions.user, userId), eq(userChatSuggestions.agent, agentId))
		});

		if (!record) return null;

		return {
			id: record.id,
			suggestions: (record.suggestions as ChatSuggestion[]) || [],
			generated_at: record.generatedAt ?? '',
			input_tokens_at_generation: Number(record.inputTokensAtGeneration) || 0,
			intent_count_at_generation: Number(record.intentCountAtGeneration) || 0
		};
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('fetch_cached_suggestions_failed', {
			agentId,
			...formatError(error)
		});
		return null;
	}
}

async function fetchCachedProfileSummary(
	db: Database,
	userId: string
): Promise<{
	id: string;
	summary_text: string;
	generated_at: string;
	input_tokens_at_generation: number;
	fact_count_at_generation: number;
	intent_count_at_generation: number;
} | null> {
	try {
		const record = await db.query.userProfileSummaries.findFirst({
			where: eq(userProfileSummaries.user, userId)
		});

		if (!record) return null;

		return {
			id: record.id,
			summary_text: record.summaryText ?? '',
			generated_at: record.generatedAt ?? '',
			input_tokens_at_generation: Number(record.inputTokensAtGeneration) || 0,
			fact_count_at_generation: Number(record.factCountAtGeneration) || 0,
			intent_count_at_generation: Number(record.intentCountAtGeneration) || 0
		};
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('fetch_cached_profile_summary_failed', { ...formatError(error) });
		return null;
	}
}

async function getUserCumulativePromptTokens(db: Database, userId: string): Promise<number> {
	try {
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

		const records = await db
			.select({ tokens: coreTokenLedger.tokens })
			.from(coreTokenLedger)
			.where(
				and(
					eq(coreTokenLedger.user, userId),
					eq(coreTokenLedger.category, 'prompt'),
					gte(coreTokenLedger.created, thirtyDaysAgo)
				)
			);

		const total = records.reduce((sum, record) => sum + (Number(record.tokens) || 0), 0);
		return total;
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('get_cumulative_tokens_failed', { ...formatError(error) });
		return 0;
	}
}

// ============================================================================
// Suggestion Regeneration Logic
// ============================================================================

async function shouldRegenerateSuggestions(
	deps: SuggestionEngineDeps,
	db: Database,
	userId: string,
	cached: {
		generated_at: string;
		input_tokens_at_generation: number;
		intent_count_at_generation: number;
	}
): Promise<boolean> {
	// Rate limit check
	const generatedAt = new Date(cached.generated_at).getTime();
	const hoursSinceGeneration = (Date.now() - generatedAt) / (1000 * 60 * 60);

	if (hoursSinceGeneration < SUGGESTION_RATE_LIMIT_HOURS) {
		const log = createLogger('SuggestionEngine', { userId });
		log.debug('suggestions_rate_limited', {
			hoursSinceGeneration: hoursSinceGeneration.toFixed(1),
			threshold: SUGGESTION_RATE_LIMIT_HOURS
		});
		return false;
	}

	// Get current cumulative prompt tokens for user
	const currentTokens = await getUserCumulativePromptTokens(db, userId);
	const tokenDelta = currentTokens - cached.input_tokens_at_generation;

	if (tokenDelta >= SUGGESTION_TOKEN_THRESHOLD) {
		const log = createLogger('SuggestionEngine', { userId });
		log.debug('suggestion_token_threshold_met', {
			tokenDelta,
			threshold: SUGGESTION_TOKEN_THRESHOLD
		});
		return true;
	}

	// Get current active intent count
	const context = await deps.graph.getContext(deps.userId);
	const currentIntentCount = context.activeIntents?.length || 0;
	if (currentIntentCount !== cached.intent_count_at_generation) {
		const log = createLogger('SuggestionEngine', { userId });
		log.debug('suggestion_intent_count_changed', {
			previous: cached.intent_count_at_generation,
			current: currentIntentCount
		});
		return true;
	}

	return false;
}

async function saveSuggestions(
	deps: SuggestionEngineDeps,
	db: Database,
	userId: string,
	agentId: string,
	suggestions: ChatSuggestion[]
): Promise<void> {
	try {
		const currentTokens = await getUserCumulativePromptTokens(db, userId);
		const context = await deps.graph.getContext(deps.userId);
		const currentIntentCount = context.activeIntents?.length || 0;

		// Check if record exists
		const existing = await fetchCachedSuggestions(db, userId, agentId);

		const now = new Date().toISOString();

		if (existing) {
			await db
				.update(userChatSuggestions)
				.set({
					suggestions,
					generatedAt: now,
					inputTokensAtGeneration: String(currentTokens),
					intentCountAtGeneration: String(currentIntentCount),
					updated: now
				})
				.where(eq(userChatSuggestions.id, existing.id));
		} else {
			await db.insert(userChatSuggestions).values({
				id: generateId(),
				user: userId,
				agent: agentId,
				suggestions,
				generatedAt: now,
				inputTokensAtGeneration: String(currentTokens),
				intentCountAtGeneration: String(currentIntentCount),
				created: now,
				updated: now
			});
		}

		const log = createLogger('SuggestionEngine', { userId });
		log.info('saved_suggestions', { agentId });
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('save_suggestions_failed', { agentId, ...formatError(error) });
	}
}

function regenerateSuggestionsInBackground(
	deps: SuggestionEngineDeps,
	params: {
		userId: string;
		agentId: string;
		agentName?: string;
		agentDescription?: string;
	}
): void {
	const work = (async () => {
		try {
			const suggestions = await generateSuggestionsForAgent(deps, params);
			const db = await getDb(deps.env);
			await saveSuggestions(deps, db, params.userId, params.agentId, suggestions);
			const log = createLogger('SuggestionEngine', { userId: params.userId });
			log.info('background_regen_complete', { agentId: params.agentId });
		} catch (error) {
			const log = createLogger('SuggestionEngine', { userId: params.userId });
			log.error('background_regen_failed', {
				agentId: params.agentId,
				...formatError(error)
			});
		}
	})();

	if (deps.ctx) {
		deps.ctx.waitUntil(work);
	}
}

// ============================================================================
// AI Generation — Suggestions
// ============================================================================

async function generateSuggestionsForAgent(
	deps: SuggestionEngineDeps,
	params: {
		userId: string;
		agentId: string;
		agentName?: string;
		agentDescription?: string;
	}
): Promise<ChatSuggestion[]> {
	const { userId, agentName, agentDescription } = params;

	if (!deps.env.AI) {
		return getDefaultSuggestions();
	}

	// Build context summary from graph (may be empty for new users)
	const contextSummary: string[] = [];

	const context = await deps.graph.getContext(deps.userId);
	if (context) {
		if (context.facts.length > 0) {
			const factTexts = context.facts
				.slice(0, 5)
				.map((f) => (f.data as Record<string, unknown>)?.text || '')
				.filter(Boolean);
			if (factTexts.length) {
				contextSummary.push(`User facts: ${factTexts.join('; ')}`);
			}
		}

		if (context.activeIntents.length > 0) {
			const intentTexts = context.activeIntents
				.slice(0, 3)
				.map((i) => (i.data as Record<string, unknown>)?.goal || '')
				.filter(Boolean);
			if (intentTexts.length) {
				contextSummary.push(`Active goals: ${intentTexts.join('; ')}`);
			}
		}

		if (context.actionItems.length > 0) {
			const actionTexts = context.actionItems
				.slice(0, 3)
				.map((a) => (a.data as Record<string, unknown>)?.text || '')
				.filter(Boolean);
			if (actionTexts.length) {
				contextSummary.push(`Pending actions: ${actionTexts.join('; ')}`);
			}
		}
	}

	// Even with no user context, generate agent-specific suggestions
	if (contextSummary.length === 0) {
		contextSummary.push(
			"New user — no profile data or history yet. Generate general suggestions tailored to this agent's specialty."
		);
	}

	try {
		const db = await getDb(deps.env);

		const promptVars = {
			agentName: agentName || 'Financial Assistant',
			agentDescription: agentDescription || 'General financial planning',
			suggestionsCount: String(SUGGESTIONS_PER_AGENT)
		};

		const systemPrompt = interpolatePrompt(
			await getPrompt(db, 'personalized_suggestions_system', PERSONALIZED_SUGGESTIONS_SYSTEM),
			promptVars
		);

		const userPrompt = interpolatePrompt(PERSONALIZED_SUGGESTIONS_USER, {
			contextSummary: contextSummary.join('\n'),
			suggestionsCount: String(SUGGESTIONS_PER_AGENT),
			agentName: agentName || 'Financial Assistant'
		});

		const costTracker = createCostTracker();

		const suggestionSchema = z.object({
			suggestions: z.array(
				z.object({
					title: z.string().describe('Short 2-4 word title'),
					description: z.string().describe('Brief 5-8 word description'),
					prompt: z.string().describe('Detailed 15-25 word instruction'),
					icon: z.enum(['analysis', 'planning', 'research', 'action'])
				})
			)
		});

		let configKey = 'suggestions_model';
		try {
			const result = await withTimeout(
				trackJsonObject(
					deps.env,
					[
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userPrompt }
					],
					suggestionSchema,
					{
						db,
						userId,
						costTracker,
						maxOutputTokens: 800,
						purpose: 'suggestion_generation'
					},
					configKey
				),
				AI_TIMEOUT_MS,
				'suggestion_generation'
			);

			await recordCostEventsToLedger(db, costTracker, {
				userId,
				messageId: `suggestions_${params.agentId}_${Date.now()}`
			});

			const suggestions = result.object.suggestions.map((item) => ({
				title: item.title.slice(0, 40),
				description: item.description.slice(0, 60),
				prompt: item.prompt.slice(0, 250),
				icon: item.icon
			}));

			if (suggestions.every((s) => s.prompt.length > 10)) {
				const log = createLogger('SuggestionEngine', { userId });
				log.info('suggestions_generated', { count: suggestions.length });
				return suggestions;
			}
		} catch (configError) {
			// Fallback to llm_model
			if (configKey === 'suggestions_model') {
				configKey = 'llm_model';
				const result = await withTimeout(
					trackJsonObject(
						deps.env,
						[
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: userPrompt }
						],
						suggestionSchema,
						{
							db,
							userId,
							costTracker,
							maxOutputTokens: 800,
							purpose: 'suggestion_generation'
						},
						configKey
					),
					AI_TIMEOUT_MS,
					'suggestion_generation_fallback'
				);

				await recordCostEventsToLedger(db, costTracker, {
					userId,
					messageId: `suggestions_${params.agentId}_${Date.now()}`
				});

				const suggestions = result.object.suggestions.map((item) => ({
					title: item.title.slice(0, 40),
					description: item.description.slice(0, 60),
					prompt: item.prompt.slice(0, 250),
					icon: item.icon
				}));

				if (suggestions.every((s) => s.prompt.length > 10)) {
					return suggestions;
				}
			} else {
				throw configError;
			}
		}
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('generate_suggestions_failed', { ...formatError(error) });
	}

	return getDefaultSuggestions();
}

// ============================================================================
// Profile Summary Logic
// ============================================================================

async function shouldRegenerateProfileSummary(
	deps: SuggestionEngineDeps,
	db: Database,
	userId: string,
	cached: {
		generated_at: string;
		input_tokens_at_generation: number;
		fact_count_at_generation: number;
		intent_count_at_generation: number;
	}
): Promise<boolean> {
	const generatedAt = new Date(cached.generated_at).getTime();
	const hoursSinceGeneration = (Date.now() - generatedAt) / (1000 * 60 * 60);

	if (hoursSinceGeneration < PROFILE_SUMMARY_RATE_LIMIT_HOURS) {
		return false;
	}

	const currentTokens = await getUserCumulativePromptTokens(db, userId);
	const tokenDelta = currentTokens - cached.input_tokens_at_generation;

	if (tokenDelta >= PROFILE_SUMMARY_TOKEN_THRESHOLD) {
		return true;
	}

	const context = await deps.graph.getContext(deps.userId);
	const currentFactCount = context.facts?.length || 0;
	if (Math.abs(currentFactCount - cached.fact_count_at_generation) >= 3) {
		return true;
	}

	const currentIntentCount = context.activeIntents?.length || 0;
	if (currentIntentCount !== cached.intent_count_at_generation) {
		return true;
	}

	return false;
}

function regenerateProfileSummaryInBackground(deps: SuggestionEngineDeps, userId: string): void {
	const work = (async () => {
		try {
			const summary = await generateProfileSummary(deps, userId);
			if (summary && summary.trim().length > 0) {
				const db = await getDb(deps.env);
				await saveProfileSummary(deps, db, userId, summary);
				const log = createLogger('SuggestionEngine', { userId });
				log.info('background_profile_regen_complete');
			}
		} catch (error) {
			const log = createLogger('SuggestionEngine', { userId });
			log.error('background_profile_regen_failed', { ...formatError(error) });
		}
	})();

	if (deps.ctx) {
		deps.ctx.waitUntil(work);
	}
}

export async function saveProfileSummary(
	deps: SuggestionEngineDeps,
	db: Database,
	userId: string,
	summaryText: string
): Promise<void> {
	try {
		const currentTokens = await getUserCumulativePromptTokens(db, userId);
		const context = await deps.graph.getContext(deps.userId);
		const currentFactCount = context.facts?.length || 0;
		const currentIntentCount = context.activeIntents?.length || 0;

		const existing = await fetchCachedProfileSummary(db, userId);

		const now = new Date().toISOString();

		if (existing) {
			await db
				.update(userProfileSummaries)
				.set({
					user: userId,
					summaryText,
					generatedAt: now,
					inputTokensAtGeneration: String(currentTokens),
					factCountAtGeneration: String(currentFactCount),
					intentCountAtGeneration: String(currentIntentCount),
					updated: now
				})
				.where(eq(userProfileSummaries.id, existing.id));
		} else {
			await db.insert(userProfileSummaries).values({
				id: generateId(),
				user: userId,
				summaryText,
				generatedAt: now,
				inputTokensAtGeneration: String(currentTokens),
				factCountAtGeneration: String(currentFactCount),
				intentCountAtGeneration: String(currentIntentCount),
				created: now,
				updated: now
			});
		}

		const log = createLogger('SuggestionEngine', { userId });
		log.info('saved_profile_summary');
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('save_profile_summary_failed', { ...formatError(error) });
	}
}

export async function generateProfileSummary(
	deps: SuggestionEngineDeps,
	userId: string
): Promise<string> {
	const db = await getDb(deps.env);

	// Get user profile
	let userProfile: Record<string, unknown> | null = null;
	try {
		const row = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});
		userProfile = row ? (row as unknown as Record<string, unknown>) : null;
	} catch (e) {
		const log = createLogger('SuggestionEngine', { userId });
		log.warn('user_profile_fetch_failed', { ...formatError(e) });
	}

	// Get FULL context from graph
	const context = await deps.graph.getFullContext(deps.userId);

	// Build context sections
	const contextSections: string[] = [];

	// User Profile Section
	if (userProfile) {
		const profileLines: string[] = [];
		if (userProfile.name) profileLines.push(`- **Name:** ${userProfile.name}`);
		if (userProfile.email) profileLines.push(`- **Email:** ${userProfile.email}`);
		if (userProfile.phone) profileLines.push(`- **Phone:** ${userProfile.phone}`);
		if (userProfile.created) {
			profileLines.push(
				`- **Client Since:** ${new Date(userProfile.created as string).toLocaleDateString()}`
			);
		}
		if (profileLines.length > 0) {
			contextSections.push(`## Client Information\n${profileLines.join('\n')}`);
		}
	}

	// Facts by category
	if (context.facts.length > 0) {
		const factsByCategory = groupFactsByCategory(context.facts);
		const factsSection = Object.entries(factsByCategory)
			.map(([category, facts]) => {
				const factTexts = facts
					.map((f) => `- ${(f.data as Record<string, unknown>)?.text || ''}`)
					.filter((t) => t !== '- ')
					.join('\n');
				return `### ${category}\n${factTexts}`;
			})
			.join('\n\n');
		contextSections.push(`## User Facts\n${factsSection}`);
	}

	// Active Goals
	if (context.activeIntents.length > 0) {
		const intentsText = context.activeIntents
			.map((i) => {
				const goal = (i.data as Record<string, unknown>)?.goal || '';
				const priority = (i.data as Record<string, unknown>)?.priority || 'medium';
				return `- **${goal}** (Priority: ${priority})`;
			})
			.filter((t) => !t.includes('****'))
			.join('\n');
		if (intentsText) {
			contextSections.push(`## Active Goals & Intentions\n${intentsText}`);
		}
	}

	// Action Items
	if (context.actionItems.length > 0) {
		const actionsText = context.actionItems
			.map((a) => {
				const text = (a.data as Record<string, unknown>)?.text || '';
				const dueDate = (a.data as Record<string, unknown>)?.dueDate;
				return `- ${text}${dueDate ? ` (Due: ${dueDate})` : ''}`;
			})
			.filter((t) => t !== '- ')
			.join('\n');
		if (actionsText) {
			contextSections.push(`## Action Items\n${actionsText}`);
		}
	}

	if (contextSections.length === 0) {
		return getDefaultProfileSummary();
	}

	const rawMarkdownSummary = `# Client Profile Summary\n\n${contextSections.join('\n\n')}\n\n---\n*Generated on ${new Date().toLocaleDateString()}*`;

	if (!deps.env.AI) {
		return rawMarkdownSummary;
	}

	try {
		const defaultSystemPrompt = PROFILE_SUMMARY_SYSTEM;

		const systemPrompt = await getPrompt(db, 'profile_summary_generator', defaultSystemPrompt);

		const userPrompt = interpolatePrompt(PROFILE_SUMMARY_USER, {
			contextSections: contextSections.join('\n\n')
		});

		const costTracker = createCostTracker();

		const profileSummarySchema = z.object({
			summary: z.string()
		});

		let configKey = 'summary_model';
		try {
			const result = await withTimeout(
				trackJsonObject(
					deps.env,
					[
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userPrompt }
					],
					profileSummarySchema,
					{
						db,
						userId,
						costTracker,
						maxOutputTokens: 4096,
						purpose: 'profile_summary_generation'
					},
					configKey
				),
				AI_TIMEOUT_MS,
				'profile_summary_generation'
			);

			await recordCostEventsToLedger(db, costTracker, {
				userId,
				messageId: `profile_summary_${Date.now()}`
			});

			const summary = result.object?.summary;
			if (summary && summary.trim().length > 0) {
				return summary;
			}
			return rawMarkdownSummary;
		} catch (configError) {
			if (configKey === 'summary_model') {
				configKey = 'llm_model';
				const result = await withTimeout(
					trackJsonObject(
						deps.env,
						[
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: userPrompt }
						],
						profileSummarySchema,
						{
							db,
							userId,
							costTracker,
							maxOutputTokens: 4096,
							purpose: 'profile_summary_generation'
						},
						configKey
					),
					AI_TIMEOUT_MS,
					'profile_summary_generation_fallback'
				);

				await recordCostEventsToLedger(db, costTracker, {
					userId,
					messageId: `profile_summary_${Date.now()}`
				});

				const summary = result.object?.summary;
				if (summary && summary.trim().length > 0) {
					return summary;
				}
				return rawMarkdownSummary;
			} else {
				throw configError;
			}
		}
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('generate_profile_summary_failed', { ...formatError(error) });
		return rawMarkdownSummary;
	}
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get cached suggestions for a specific agent, or generate if needed
 */
export async function getCachedSuggestions(
	deps: SuggestionEngineDeps,
	params: {
		userId: string;
		agentId: string;
		agentName?: string;
		agentDescription?: string;
	}
): Promise<{
	suggestions: ChatSuggestion[];
	fromCache: boolean;
	regenerating: boolean;
}> {
	const { userId, agentId, agentName, agentDescription } = params;

	try {
		const db = await getDb(deps.env);

		// Try to get cached suggestions
		const cached = await fetchCachedSuggestions(db, userId, agentId);

		if (!cached) {
			// No cached suggestions — return defaults immediately, generate in background
			const log = createLogger('SuggestionEngine', { userId });
			log.info('generating_suggestions_background', { agentId });

			regenerateSuggestionsInBackground(deps, {
				userId,
				agentId,
				agentName,
				agentDescription
			});

			return {
				suggestions: getDefaultSuggestions(),
				fromCache: false,
				regenerating: true
			};
		}

		// Check if we should regenerate
		const shouldRegen = await shouldRegenerateSuggestions(deps, db, userId, cached);

		if (shouldRegen) {
			const log = createLogger('SuggestionEngine', { userId });
			log.info('suggestions_stale', { agentId });

			// Trigger background regeneration (don't await)
			regenerateSuggestionsInBackground(deps, {
				userId,
				agentId,
				agentName,
				agentDescription
			});

			return {
				suggestions: cached.suggestions,
				fromCache: true,
				regenerating: true
			};
		}

		// Return cached suggestions
		return {
			suggestions: cached.suggestions,
			fromCache: true,
			regenerating: false
		};
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('get_cached_suggestions_failed', {
			agentId,
			...formatError(error)
		});
		return {
			suggestions: getDefaultSuggestions(),
			fromCache: false,
			regenerating: false
		};
	}
}

/**
 * Get cached user profile summary, or generate if needed
 */
export async function getUserProfileSummary(
	deps: SuggestionEngineDeps,
	params: { userId: string; forceRegenerate?: boolean }
): Promise<{
	summary: string;
	generatedAt: string;
	fromCache: boolean;
	regenerating: boolean;
}> {
	const { userId, forceRegenerate = false } = params;

	try {
		const db = await getDb(deps.env);

		if (!forceRegenerate) {
			const cached = await fetchCachedProfileSummary(db, userId);

			if (cached) {
				const shouldRegen = await shouldRegenerateProfileSummary(deps, db, userId, cached);

				if (shouldRegen) {
					const log = createLogger('SuggestionEngine', { userId });
					log.info('profile_summary_stale');
					regenerateProfileSummaryInBackground(deps, userId);

					return {
						summary: cached.summary_text,
						generatedAt: cached.generated_at,
						fromCache: true,
						regenerating: true
					};
				}

				return {
					summary: cached.summary_text,
					generatedAt: cached.generated_at,
					fromCache: true,
					regenerating: false
				};
			}
		}

		// No cached summary — return defaults immediately, generate in background
		const log = createLogger('SuggestionEngine', { userId });
		log.info('generating_profile_summary_background');
		regenerateProfileSummaryInBackground(deps, userId);

		return {
			summary: getDefaultProfileSummary(),
			generatedAt: new Date().toISOString(),
			fromCache: false,
			regenerating: true
		};
	} catch (error) {
		const log = createLogger('SuggestionEngine', { userId });
		log.error('get_profile_summary_failed', { ...formatError(error) });
		return {
			summary: 'Unable to generate profile summary at this time.',
			generatedAt: new Date().toISOString(),
			fromCache: false,
			regenerating: false
		};
	}
}
