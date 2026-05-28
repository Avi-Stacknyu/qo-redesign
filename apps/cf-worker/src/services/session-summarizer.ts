/**
 * Session Summarizer Service
 *
 * Extracts session summaries, entities, and topics from conversation
 * and updates the knowledge graph. Facts and intents are now handled
 * by the ProfilerService (structured profile extraction).
 *
 * OPTIMIZATIONS (v2):
 * - Batch extraction: Only runs every N messages (default: 5)
 * - Session-end extraction: Comprehensive summary on session close
 * - Better context: Extracts from multiple message pairs
 */

import type { Database } from '@repo/db/types';
import type { Env, ConversationExtractionResult, GraphNode, GraphEdge } from '../types';
import { MemoryGraphService } from '../graph/memory-graph-service';
import { getModelConfig, getModelFromConfig } from '../utils/model-factory';
import { generateText } from 'ai';
import { interpolatePrompt, SESSION_EXTRACTION } from '../utils/prompts';
import type { FlowCostTracker } from '../types/flow';
import { trackInferenceCost } from '../utils/cost-tracker';
import { safeParseLLMJson } from '../utils/json-repair';
import { createLogger, formatError } from '../utils/logger';
import { hashString } from '../utils/hash';

// ============================================================================
// Constants
// ============================================================================

/** Extract every N messages (configurable) */
export const EXTRACTION_MESSAGE_THRESHOLD = 5;

/** Session timeout for final extraction (2 minutes) */
export const SESSION_TIMEOUT_SECONDS = 60;

// ============================================================================
// Types
// ============================================================================

export interface ExtractionContext {
	env: Env;
	db: Database;
	userId: string;
	sessionId: string;
	agentId: string;
	costTracker?: FlowCostTracker;
}

/** Message pair for batch extraction */
export interface MessagePair {
	userMessage: string;
	assistantResponse: string;
}

// ============================================================================
// Extraction Service
// ============================================================================

export class ExtractionService {
	private ctx: ExtractionContext;

	constructor(ctx: ExtractionContext) {
		this.ctx = ctx;
	}

	/**
	 * Get graph service for this user
	 */
	private getGraphService(): MemoryGraphService {
		return new MemoryGraphService(this.ctx.db, this.ctx.userId);
	}

	/**
	 * Extract from a batch of message pairs (more efficient)
	 * Called every N messages or on session end
	 */
	async extractFromBatch(messages: MessagePair[], isSessionEnd = false): Promise<void> {
		if (messages.length === 0) return;

		// Format conversation for extraction
		const conversationText = messages
			.map((m, i) => `[${i + 1}] User: ${m.userMessage}\nAssistant: ${m.assistantResponse}`)
			.join('\n\n');

		// Fetch existing entities for contradiction detection
		const graph = this.getGraphService();
		let existingEntitiesBlock = '';
		try {
			const existingEntities = await graph.getRecentEntities(30);
			if (existingEntities.length > 0) {
				existingEntitiesBlock = `\nEXISTING ENTITIES:\n${existingEntities
					.map(
						(e, i) =>
							`[${i + 1}] ${e.data.name} (${e.data.entityType}, confidence: ${e.confidence ?? 1.0}) [ID: ${e.id}]`
					)
					.join('\n')}\n\nWhen extracting new entities:
- If a new entity CONTRADICTS or UPDATES an existing one, include "supersedes": ["old_entity_id"]
- Do NOT create duplicates of existing entities unless they have changed\n`;
			}
		} catch {
			// Entity fetch failed — continue without contradiction detection
		}

		const extractionPrompt = interpolatePrompt(SESSION_EXTRACTION, {
			currentDateTime: new Date().toISOString(),
			messageCount: String(messages.length),
			conversationText,
			existingEntitiesBlock,
			sessionEndNote: isSessionEnd
				? 'This is the END of the conversation session. Create a comprehensive summary.'
				: '',
			summaryInstruction: isSessionEnd
				? 'A 2-3 sentence summary of what was discussed and any key decisions/outcomes'
				: 'Brief summary of this conversation segment'
		});

		try {
			const config = await getModelConfig(this.ctx.db, 'extraction_model');
			const model = getModelFromConfig(config, this.ctx.env);
			const result = await generateText({
				model,
				prompt: extractionPrompt,
				maxOutputTokens: 800,
				timeout: 30_000
			});

			if (this.ctx.costTracker) {
				await trackInferenceCost({
					db: this.ctx.db,
					modelConfig: config,
					usage: result.usage,
					purpose: isSessionEnd ? 'session_extraction' : 'batch_extraction',
					costTracker: this.ctx.costTracker
				});
			}

			const text = result.text || '{}';
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			if (!jsonMatch) return;

			const extraction = safeParseLLMJson<ConversationExtractionResult>(jsonMatch[0]);
			if (!extraction) return;

			// Update graph with better summary
			await this.updateGraphFromExtraction(extraction, isSessionEnd);
		} catch (e) {
			createLogger('SessionSummarizer').warn('extraction_failed', formatError(e));
		}
	}

	/**
	 * Update graph with extracted information
	 */
	private async updateGraphFromExtraction(
		extraction: ConversationExtractionResult,
		isSessionEnd = false
	): Promise<void> {
		const graph = this.getGraphService();
		const now = new Date().toISOString();
		const userNodeId = `user::${this.ctx.userId}`;

		const nodes: GraphNode[] = [];
		const edges: GraphEdge[] = [];

		// User node (upsert)
		nodes.push({
			id: userNodeId,
			type: 'USER',
			data: { userId: this.ctx.userId },
			createdAt: now
		});

		// Session node with summary
		const sessionSummary =
			extraction.summary ||
			`Discussed: ${extraction.mentionedTopics?.join(', ') || 'various topics'}`;

		nodes.push({
			id: this.ctx.sessionId,
			type: 'SESSION',
			data: {
				agentType: this.ctx.agentId,
				summary: sessionSummary,
				timestamp: now,
				isComplete: isSessionEnd,
				share_with_manager: true,
				share_with_agent: true
			},
			createdAt: now
		});

		edges.push({
			source: userNodeId,
			target: this.ctx.sessionId,
			relationship: 'HAS_SESSION',
			createdAt: now
		});

		// Agent node
		const agentNodeId = `agent::${this.ctx.agentId}`;
		nodes.push({
			id: agentNodeId,
			type: 'AGENT',
			data: { name: this.ctx.agentId },
			createdAt: now
		});

		edges.push({
			source: this.ctx.sessionId,
			target: agentNodeId,
			relationship: 'WITH_AGENT',
			createdAt: now
		});

		// Entities
		if (extraction.newEntities) {
			for (const entity of extraction.newEntities) {
				// Delete superseded entities before inserting the new one
				if (entity.supersedes && entity.supersedes.length > 0) {
					for (const oldId of entity.supersedes) {
						try {
							await graph.deleteNode(oldId);
						} catch {
							// Best-effort — old node may already be gone
						}
					}
				}

				const entityId = `entity::${entity.type}::${hashString(entity.name).slice(0, 12)}`;
				nodes.push({
					id: entityId,
					type: 'ENTITY',
					data: {
						name: entity.name,
						entityType: entity.type,
						source: this.ctx.sessionId,
						share_with_manager: true,
						share_with_agent: true,
						...(entity.expires_at && { expires_at: entity.expires_at })
					},
					createdAt: now
				});
				edges.push({
					source: this.ctx.sessionId,
					target: entityId,
					relationship: 'MENTIONED',
					createdAt: now
				});
			}
		}

		// Topics
		if (extraction.mentionedTopics) {
			for (const topic of extraction.mentionedTopics) {
				const topicId = `topic::${topic.toLowerCase().replace(/\s+/g, '_')}`;
				nodes.push({
					id: topicId,
					type: 'TOPIC',
					data: {
						name: topic,
						share_with_manager: true,
						share_with_agent: true
					},
					createdAt: now
				});
				edges.push({
					source: this.ctx.sessionId,
					target: topicId,
					relationship: 'DISCUSSED',
					createdAt: now
				});
			}
		}

		// Batch upsert to graph
		if (nodes.length > 0) {
			await graph.batchUpsert(nodes, edges);
		}
	}
}

// ============================================================================
// Factory Function
// ============================================================================

export function createExtractionService(ctx: ExtractionContext): ExtractionService {
	return new ExtractionService(ctx);
}
