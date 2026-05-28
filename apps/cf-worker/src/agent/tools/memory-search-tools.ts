import { z } from 'zod';
import { tool } from 'ai';
import type { GraphNode } from '../../types';
import type { ProfileSectionData } from '../../types/profiler';
import { createLogger, formatError } from '../../utils/logger';
import { MemoryGraphService } from '../../graph/memory-graph-service';
import type { ToolContext } from './types';

/**
 * Graph service helper for memory search tools.
 */
function getGraphService(ctx: ToolContext): MemoryGraphService {
	return new MemoryGraphService(ctx.db, ctx.userId);
}

export function createMemorySearchTools(ctx: ToolContext) {
	const log = createLogger('MemorySearch', { userId: ctx.userId });

	return {
		recall_memory: tool({
			description:
				'Search the user\'s memory graph for specific information. Use this when you need to look up a specific detail about the user that isn\'t in the loaded context, or when the user asks "do you remember...", "what did I tell you about...", or references something from a past conversation.',
			inputSchema: z.object({
				query: z.string().describe('The search query — what information to look up'),
				category: z
					.string()
					.optional()
					.describe(
						'Optional category filter to narrow results. Common values: financial, personal, investment, goals, preferences, temporal, lifestyle, employment, health, education — but any profile section ID is valid.'
					),
				limit: z
					.number()
					.min(1)
					.max(20)
					.optional()
					.default(10)
					.describe('Maximum number of results to return')
			}),
			execute: async ({ query, category, limit }) => {
				try {
					const graphStub = getGraphService(ctx);
					const results: Array<{ type: string; content: string }> = [];

					// 1. Search profile fields directly (FTS may miss individual field values in JSON)
					const profileNodes = await graphStub.getProfile();
					const queryLower = query.toLowerCase();

					for (const node of profileNodes) {
						const sectionId = node.id.split('::').pop()!;
						const sectionData = node.data as ProfileSectionData;

						// Filter by category if provided
						if (category && sectionId !== category) continue;

						for (const [key, field] of Object.entries(sectionData.fields)) {
							if (!field.value) continue;
							const valStr = String(field.value);
							const matchesQuery =
								valStr.toLowerCase().includes(queryLower) ||
								(field.label ?? '').toLowerCase().includes(queryLower) ||
								key.toLowerCase().includes(queryLower);
							if (matchesQuery) {
								results.push({
									type: `Profile — ${sectionData.label}`,
									content: `${field.label}: ${valStr}`
								});
							}
						}
					}

					// 2. FTS search for entities, topics, facts, and session data
					const ftsResults = await graphStub.ftsSearchNodes(query, limit);
					const seenIds = new Set(results.map((r) => r.content));

					for (const ftsResult of ftsResults) {
						// Skip nulls and profile section nodes (already handled above)
						if (!ftsResult.id || ftsResult.id.startsWith('profile::')) continue;

						const node = await graphStub.getNode(ftsResult.id);
						if (!node) continue;

						// Apply category filter for non-profile nodes
						if (category && node.data.category && node.data.category !== category) continue;

						const formatted = formatMemoryNode(node);
						if (formatted && !seenIds.has(formatted.content)) {
							seenIds.add(formatted.content);
							results.push(formatted);
						}

						if (results.length >= limit) break;
					}

					if (results.length === 0) {
						return 'No relevant memories found for this query.';
					}

					return results
						.slice(0, limit)
						.map((r) => `[${r.type}] ${r.content}`)
						.join('\n');
				} catch (error) {
					log.error('recall_memory_failed', formatError(error));
					return 'Memory search temporarily unavailable.';
				}
			}
		}),

		recall_sessions: tool({
			description:
				'Search past conversation sessions. Use when the user references a previous conversation, asks about something discussed before, or you need historical context about what was discussed.',
			inputSchema: z.object({
				query: z
					.string()
					.optional()
					.describe('Search query to find relevant sessions. Omit to get most recent sessions.'),
				limit: z
					.number()
					.min(1)
					.max(10)
					.optional()
					.default(5)
					.describe('Maximum number of sessions to return')
			}),
			execute: async ({ query, limit }) => {
				try {
					const graphStub = getGraphService(ctx);
					let sessionNodes: GraphNode[] = [];

					if (query) {
						// FTS search, then filter to SESSION nodes
						const ftsResults = await graphStub.ftsSearchNodes(query, limit * 3);
						for (const ftsResult of ftsResults) {
							if (!ftsResult.id || !ftsResult.id.startsWith('session::')) continue;
							const node = await graphStub.getNode(ftsResult.id);
							if (node) sessionNodes.push(node);
							if (sessionNodes.length >= limit) break;
						}
					} else {
						// No query — get most recent sessions
						sessionNodes = await graphStub.getNodesByType('SESSION', limit);
					}

					if (sessionNodes.length === 0) {
						return 'No matching sessions found.';
					}

					return sessionNodes
						.map((node) => {
							const summary = node.data.summary || node.data.text || 'No summary available';
							const agent = node.data.agentName || node.data.agent || '';
							const date = node.updatedAt
								? new Date(node.updatedAt).toLocaleDateString('en-US', {
										year: 'numeric',
										month: 'short',
										day: 'numeric'
									})
								: 'Unknown date';
							const header = agent ? `[Session ${date} — ${agent}]` : `[Session ${date}]`;
							return `${header}\nSummary: ${summary}`;
						})
						.join('\n\n');
				} catch (error) {
					log.error('recall_sessions_failed', formatError(error));
					return 'Session search temporarily unavailable.';
				}
			}
		})
	};
}

/** Format node data as readable text instead of raw JSON */
function formatNodeData(data: Record<string, unknown>): string {
	const entries = Object.entries(data)
		.filter(
			([k, v]) =>
				v !== null &&
				v !== undefined &&
				v !== '' &&
				!['category', 'status', 'expires_at', 'confidence'].includes(k)
		)
		.map(([k, v]) => {
			if (typeof v === 'boolean') return `${k.replace(/_/g, ' ')}: ${v ? 'yes' : 'no'}`;
			if (Array.isArray(v)) return `${k.replace(/_/g, ' ')}: ${v.join(', ')}`;
			return `${k.replace(/_/g, ' ')}: ${String(v)}`;
		});
	return entries.join('; ') || 'no data';
}

/** Format a graph node into readable text for tool output */
function formatMemoryNode(node: GraphNode): { type: string; content: string } | null {
	const data = node.data;
	const confidence = node.confidence ? ` (confidence: ${node.confidence.toFixed(2)})` : '';
	const date = node.updatedAt
		? `, updated: ${new Date(node.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
		: '';

	switch (node.type) {
		case 'FACT':
			return {
				type: `Fact${data.category ? ` — ${data.category}` : ''}`,
				content: `${data.text || data.value || formatNodeData(data)}${confidence}${date}`
			};
		case 'ENTITY':
			return {
				type: `Entity${data.category ? ` — ${data.category}` : ''}`,
				content: `${data.text || data.name || formatNodeData(data)}${confidence}${date}`
			};
		case 'TOPIC':
			return {
				type: 'Topic',
				content: `${data.text || data.name || formatNodeData(data)}${confidence}${date}`
			};
		case 'SESSION':
			return {
				type: 'Session',
				content: `${data.summary || data.text || 'No summary'}${date}`
			};
		case 'ACTION_ITEM':
			return {
				type: 'Action Item',
				content: `${data.text || data.title || formatNodeData(data)} [${data.status || 'pending'}]${date}`
			};
		case 'INSIGHT':
			return {
				type: 'Insight',
				content: `${data.text || formatNodeData(data)}${confidence}${date}`
			};
		default:
			// Skip node types we don't surface (USER, AGENT, DOCUMENT, NOTE, TODO, REMINDER, FILE_REF)
			return null;
	}
}
