/**
 * Chat Title Generator
 *
 * Background task to generate chat titles using a cheap Cloudflare model.
 * Triggered after the first user message gets a response.
 *
 * Features:
 * - Uses configurable prompt from ai_prompts collection (key: "chat_title_generation")
 * - Uses cheap model from ai_agent_models (config_key: "title_generation_model")
 * - Tracks cost in cost tracker
 * - Updates chat title in the database (chats table)
 */

import { generateText } from 'ai';
import type { Database } from '@repo/db/types';
import { chats } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import type { FlowCostTracker } from '../types/flow';
import type { Env } from '../types';
import { getModelConfigWithFallback, getModelFromConfig } from './model-factory';
import { getPrompt, interpolatePrompt, CHAT_TITLE_GENERATION } from './prompts';
import { trackInferenceCost } from './cost-tracker';
import { createLogger, formatError } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface TitleGenerationOptions {
	db: Database;
	env: Env;
	chatId: string;
	userMessage: string;
	assistantResponse: string;
	costTracker?: FlowCostTracker;
}

// Default prompt imported from constants/prompts.ts

// ============================================================================
// Implementation
// ============================================================================

/**
 * Generate a chat title in the background
 * This is fire-and-forget - errors are logged but don't affect main flow
 */
export async function generateChatTitle(options: TitleGenerationOptions): Promise<string | null> {
	const { db, env, chatId, userMessage, assistantResponse, costTracker } = options;

	try {
		// Get customizable prompt
		const promptTemplate = await getPrompt(db, 'chat_title_generation', CHAT_TITLE_GENERATION);

		// Interpolate variables
		const prompt = interpolatePrompt(promptTemplate, {
			userMessage: userMessage.slice(0, 500), // Limit input length
			assistantResponse: assistantResponse.slice(0, 500)
		});

		// Get model config (fallback to llm_model if title_generation_model not configured)
		const modelConfig = await getModelConfigWithFallback(db, 'title_generation_model');

		// Get model from factory (provider resolved from config)
		const model = getModelFromConfig(modelConfig, env);

		// Generate title
		const { text: title, usage } = await generateText({
			model,
			prompt,
			timeout: 15_000
		});

		// Clean up the title
		const cleanTitle = title
			.trim()
			.replace(/^["']|["']$/g, '') // Remove quotes
			.replace(/^Title:\s*/i, '') // Remove "Title:" prefix
			.slice(0, 100); // Enforce max length

		// Update chat title
		await db
			.update(chats)
			.set({ title: cleanTitle, updated: new Date().toISOString() })
			.where(eq(chats.id, chatId));

		// Track cost if tracker provided
		if (costTracker) {
			await trackInferenceCost({
				db,
				modelConfig,
				usage,
				purpose: 'title_generation',
				costTracker,
				extraMetadata: { chatId }
			});
		}

		const log = createLogger('TitleGenerator', { chatId });
		log.info('title_generated', { title: cleanTitle });
		return cleanTitle;
	} catch (error) {
		const log = createLogger('TitleGenerator', { chatId });
		log.error('title_generation_failed', { ...formatError(error) });
		return null;
	}
}

/**
 * Check if chat needs title generation
 * Returns true if chat has no title or has default placeholder title
 */
export async function shouldGenerateTitle(db: Database, chatId: string): Promise<boolean> {
	try {
		const chat = await db.query.chats.findFirst({
			where: eq(chats.id, chatId),
			columns: { title: true }
		});

		const title = chat?.title;

		// Generate if no title, empty title, or placeholder patterns
		if (!title || title.trim() === '') return true;

		// Check for known placeholder patterns
		const placeholderPatterns = ['New Chat', 'Untitled', 'Untitled Thread', 'New Test Thread'];
		if (placeholderPatterns.includes(title)) return true;

		// Match "Test N" pattern (e.g., "Test 1", "Test 42")
		if (/^Test \d+$/i.test(title)) return true;

		return false;
	} catch {
		// Chat doesn't exist or error - don't generate
		return false;
	}
}
