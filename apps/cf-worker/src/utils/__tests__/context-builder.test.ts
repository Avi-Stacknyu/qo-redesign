/**
 * Context Builder Tests
 *
 * Tests for buildUserContext, getEmptyUserContext, fetchFileSummariesFromGraph.
 */

import { describe, it, expect, vi } from 'vitest';
import {
	buildUserContext,
	getEmptyUserContext,
	fetchFileSummariesFromGraph
} from '../../utils/context-builder';

// ============================================================================
// Mocks
// ============================================================================

function createMockGraph(overrides: Record<string, any> = {}) {
	return {
		getContext: vi.fn().mockResolvedValue(overrides.context ?? null),
		getContextForQuery: vi.fn().mockResolvedValue(overrides.context ?? null),
		getNode: vi.fn().mockResolvedValue(overrides.node ?? null),
		compileProfileMarkdown: vi.fn().mockResolvedValue(''),
		getProfile: vi.fn().mockResolvedValue([])
	} as any;
}

// ============================================================================
// getEmptyUserContext
// ============================================================================

describe('getEmptyUserContext', () => {
	it('returns context with userId and empty arrays', () => {
		const ctx = getEmptyUserContext('user-123');

		expect(ctx.userId).toBe('user-123');
		expect(ctx.facts).toEqual([]);
		expect(ctx.activeIntents).toEqual([]);
		expect(ctx.recentSessions).toEqual([]);
		expect(ctx.actionItems).toEqual([]);
		expect(ctx.notes).toEqual([]);
		expect(ctx.todos).toEqual([]);
		expect(ctx.reminders).toEqual([]);
		expect(ctx.chatFiles).toEqual([]);
		expect(ctx.accessibleFiles).toEqual([]);
	});
});

// ============================================================================
// buildUserContext
// ============================================================================

describe('buildUserContext', () => {
	it('returns empty context when graph returns null', async () => {
		const graph = createMockGraph({ context: null });

		const result = await buildUserContext(graph, { userId: 'u1' });

		expect(result.userContext.userId).toBe('u1');
		expect(result.userContext.facts).toEqual([]);
		expect(result.fileSummaries).toEqual([]);
		expect(result.buildTimeMs).toBeTypeOf('number');
	});

	it('returns graph context when available', async () => {
		const mockContext = {
			userId: 'u1',
			facts: [{ id: 'f1', type: 'FACT', data: { text: 'likes stocks' } }],
			activeIntents: [],
			recentSessions: [],
			actionItems: [],
			notes: [],
			todos: [],
			reminders: [],
			chatFiles: [],
			accessibleFiles: []
		};
		const graph = createMockGraph({ context: mockContext });

		const result = await buildUserContext(graph, { userId: 'u1' });

		expect(result.userContext.facts).toHaveLength(1);
		expect(result.userContext.facts[0].data.text).toBe('likes stocks');
	});

	it('calls getContext with user:: prefix', async () => {
		const graph = createMockGraph();

		await buildUserContext(graph, { userId: 'user-456' });

		expect(graph.getContext).toHaveBeenCalledWith('user::user-456');
	});

	it('fetches file summaries when attachedFileIds provided', async () => {
		const graph = createMockGraph({
			node: {
				id: 'doc::file1',
				type: 'DOCUMENT',
				data: { fileName: 'report.pdf', summary: 'Q4 report' }
			}
		});

		const result = await buildUserContext(graph, {
			userId: 'u1',
			attachedFileIds: ['file1']
		});

		expect(result.fileSummaries).toHaveLength(1);
		expect(result.fileSummaries[0].fileName).toBe('report.pdf');
		expect(result.fileSummaries[0].summary).toBe('Q4 report');
	});

	it('skips file summaries when skipFileSummaries=true', async () => {
		const graph = createMockGraph();

		const result = await buildUserContext(graph, {
			userId: 'u1',
			attachedFileIds: ['file1'],
			skipFileSummaries: true
		});

		expect(result.fileSummaries).toEqual([]);
		expect(graph.getNode).not.toHaveBeenCalled();
	});

	it('handles file summary fetch failure gracefully', async () => {
		const graph = createMockGraph();
		graph.getNode.mockRejectedValue(new Error('DB unavailable'));

		// Suppress error log
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await buildUserContext(graph, {
			userId: 'u1',
			attachedFileIds: ['file1']
		});

		// Should not throw, just return empty summaries
		expect(result.fileSummaries).toEqual([]);
		spy.mockRestore();
	});

	it('handles missing file node (returns empty summaries for that file)', async () => {
		const graph = createMockGraph({ node: null });

		const result = await buildUserContext(graph, {
			userId: 'u1',
			attachedFileIds: ['nonexistent']
		});

		expect(result.fileSummaries).toEqual([]);
	});
});

// ============================================================================
// fetchFileSummariesFromGraph
// ============================================================================

describe('fetchFileSummariesFromGraph', () => {
	it('returns empty for empty fileIds', async () => {
		const graph = createMockGraph();
		const result = await fetchFileSummariesFromGraph(graph, []);
		expect(result).toEqual([]);
	});
});
