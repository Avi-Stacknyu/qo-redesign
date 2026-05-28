/**
 * Context Builder - Shared utility for building user context
 *
 * Provides helper functions for building user context from the graph.
 * Used by RAG Service for inline context building.
 */

import type { UserContext, GraphNode } from '../types';
import type { ProfileSchemaSection } from '../types/profiler';
import type { MemoryGraphService } from '../graph/memory-graph-service';
import { createLogger, formatError } from './logger';

// ============================================================================
// Types
// ============================================================================

interface ContextBuildResult {
	userContext: UserContext;
	fileSummaries: Array<{ fileId: string; fileName: string; summary: string }>;
	buildTimeMs: number;
}

interface ContextBuildOptions {
	userId: string;
	attachedFileIds?: string[];
	/** If true, will not fetch file summaries (faster) */
	skipFileSummaries?: boolean;
	/** When provided, uses FTS-ranked query-relevant loading for temporal nodes */
	query?: string;
}

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Build user context from the knowledge graph
 *
 * This fetches:
 * - User facts, intents, sessions, action items from MemoryGraphService
 * - File summaries for attached files (if any)
 *
 * @param graph - MemoryGraphService instance for this user
 * @param options - Build options including userId and attachedFileIds
 * @returns Context build result with userContext and fileSummaries
 */
export async function buildUserContext(
	graph: MemoryGraphService,
	options: ContextBuildOptions
): Promise<ContextBuildResult> {
	const { userId, attachedFileIds = [], skipFileSummaries = false, query } = options;
	const startTime = Date.now();

	const log = createLogger('ContextBuilder', { userId });

	log.debug('building_context', {
		attachedFileCount: attachedFileIds.length,
		skipFileSummaries,
		hasQuery: !!query
	});

	// Fetch user context from graph (facts, intents, sessions, etc.)
	// IMPORTANT: getContext expects the user node ID format (user::userId),
	// NOT just the userId. This is because edges are stored with source = "user::userId"
	const userNodeId = `user::${userId}`;

	// Use query-relevant loading when a query is provided
	const graphContext = query
		? await graph.getContextForQuery(userNodeId, query)
		: await graph.getContext(userNodeId);

	// Build user context with defaults for missing fields
	const userContext: UserContext = graphContext ?? getEmptyUserContext(userId);

	// Fetch file summaries for attached files
	let fileSummaries: Array<{ fileId: string; fileName: string; summary: string }> = [];

	if (!skipFileSummaries && attachedFileIds.length > 0) {
		fileSummaries = await fetchFileSummaries(graph, attachedFileIds);
	}

	const buildTimeMs = Date.now() - startTime;
	log.info('context_built', {
		buildTimeMs,
		factsCount: userContext.facts?.length || 0,
		intentsCount: userContext.activeIntents?.length || 0,
		sessionsCount: userContext.recentSessions?.length || 0,
		fileSummariesCount: fileSummaries.length
	});

	return {
		userContext,
		fileSummaries,
		buildTimeMs
	};
}

/**
 * Fetch file summaries from the knowledge graph (exported for direct use)
 * Call this when you ONLY need file summaries, not the full user context
 */
export async function fetchFileSummariesFromGraph(
	graph: MemoryGraphService,
	fileIds: string[]
): Promise<Array<{ fileId: string; fileName: string; summary: string }>> {
	if (fileIds.length === 0) return [];
	return fetchFileSummaries(graph, fileIds);
}

/**
 * Fetch file summaries from the knowledge graph (internal helper)
 */
async function fetchFileSummaries(
	graph: MemoryGraphService,
	fileIds: string[]
): Promise<Array<{ fileId: string; fileName: string; summary: string }>> {
	const summaries: Array<{ fileId: string; fileName: string; summary: string }> = [];

	for (const fileId of fileIds) {
		try {
			const docNodeId = `doc::${fileId}`;
			const node = await graph.getNode(docNodeId);

			if (node) {
				const data = node.data as { fileName?: string; summary?: string };
				summaries.push({
					fileId,
					fileName: data.fileName || 'Unknown',
					summary: data.summary || 'Document attached'
				});
			}
		} catch (e) {
			const log = createLogger('ContextBuilder');
			log.error('file_summary_failed', { fileId, ...formatError(e) });
		}
	}

	return summaries;
}

/**
 * Get empty user context (for fallback scenarios)
 */
export function getEmptyUserContext(userId: string): UserContext {
	return {
		userId,
		facts: [],
		activeIntents: [],
		recentSessions: [],
		actionItems: [],
		notes: [],
		todos: [],
		reminders: [],
		chatFiles: [],
		accessibleFiles: []
	};
}

// ============================================================================
// Profile Context Builder
// ============================================================================

interface ProfileContextResult {
	profileMarkdown: string;
	profileNodes: GraphNode[];
}

/**
 * Build profile context from the knowledge graph.
 * Returns compiled Profile.md text and raw profile nodes (for cold start directive).
 */
export async function buildProfileContext(
	graph: MemoryGraphService,
	schema?: ProfileSchemaSection[]
): Promise<ProfileContextResult> {
	const visibleSectionIds =
		schema && schema.length > 0 ? new Set(schema.map((section) => section.section_id)) : null;

	const [profileMarkdown, profileNodes] = await Promise.all([
		graph.compileProfileMarkdown(
			schema,
			visibleSectionIds ? { includeUnscopedSections: false } : undefined
		),
		visibleSectionIds
			? graph
					.getProfile()
					.then((nodes) =>
						nodes.filter((node) => visibleSectionIds.has(node.id.split('::').pop() ?? ''))
					)
			: Promise.resolve([])
	]);

	return { profileMarkdown, profileNodes };
}
