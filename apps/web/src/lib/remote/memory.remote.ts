/**
 * Memory remote — graph memory + file management.
 * One domain: memory graph and uploaded files.
 */

import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { MemoryGraphService } from '@repo/db/graph';
import z from 'zod/v4';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
	id: string;
	type: string;
	data: Record<string, unknown>;
	confidence?: number;
	decayScore?: number;
	createdAt?: string;
	updatedAt?: string;
}

export interface GraphEdge {
	source: string;
	target: string;
	relationship: string;
	properties?: Record<string, unknown>;
	createdAt?: string;
}

export interface GraphStats {
	nodeCount: number;
	edgeCount: number;
	nodesByType: Record<string, number>;
	edgesByRelationship: Record<string, number>;
}

export interface GraphData {
	nodes: GraphNode[];
	edges: GraphEdge[];
	stats: GraphStats;
}

export interface UserFile {
	id: string;
	name: string;
	type: string;
	size: number;
	createdAt: string;
}

export interface FilesData {
	files: UserFile[];
	totalPages: number;
	totalItems: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGraphService(): { graph: MemoryGraphService; userId: string } {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.db) throw error(503, 'Database unavailable');
	return { graph: new MemoryGraphService(locals.db, locals.user.id), userId: locals.user.id };
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Fetch full graph from Postgres via MemoryGraphService. */
export const loadGraphMemory = query(async (): Promise<GraphData> => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.db) {
		return {
			nodes: [],
			edges: [],
			stats: { nodeCount: 0, edgeCount: 0, nodesByType: {}, edgesByRelationship: {} }
		};
	}

	const graph = new MemoryGraphService(locals.db, locals.user.id);
	const result = await graph.getFullGraph({ limit: 500 });

	return {
		nodes: result.nodes as GraphNode[],
		edges: result.edges as GraphEdge[],
		stats: result.stats as GraphStats
	};
});

/** Fetch user files from FILE_SERVICE. */
export const loadUserFiles = query(
	z
		.object({
			page: z.number().int().min(1).default(1),
			perPage: z.number().int().min(1).max(100).default(20)
		})
		.optional(),
	async (params): Promise<FilesData> => {
		const { platform, locals } = getRequestEvent();
		if (!locals.user) throw error(401, 'Unauthorized');
		if (!platform?.env?.FILE_SERVICE) {
			return { files: [], totalPages: 0, totalItems: 0 };
		}

		const result = await platform.env.FILE_SERVICE.listFiles({
			userId: locals.user.id,
			page: params?.page ?? 1,
			perPage: params?.perPage ?? 20
		});

		return {
			files: result.files as UserFile[],
			totalPages: result.totalPages,
			totalItems: result.totalItems
		};
	}
);

// ── Commands ─────────────────────────────────────────────────────────────────

/** Toggle a node's hidden_from_agent flag. */
export const toggleNodeHidden = command(
	z.object({ nodeId: z.string().min(1), hidden: z.boolean() }),
	async ({ nodeId, hidden }) => {
		const { graph } = getGraphService();
		const currentNode = await graph.getNode(nodeId);
		if (!currentNode) throw error(404, 'Node not found');

		await graph.upsertNode({
			id: currentNode.id,
			type: currentNode.type,
			data: { ...currentNode.data, hidden_from_agent: hidden },
			confidence: currentNode.confidence,
			decayScore: currentNode.decayScore,
			createdAt: currentNode.createdAt
		});

		return { success: true, hidden };
	}
);

/** Toggle a node's share_with_manager flag. */
export const toggleShareWithManager = command(
	z.object({ nodeId: z.string().min(1), shareWithManager: z.boolean() }),
	async ({ nodeId, shareWithManager }) => {
		const { graph } = getGraphService();
		const currentNode = await graph.getNode(nodeId);
		if (!currentNode) throw error(404, 'Node not found');

		await graph.upsertNode({
			id: currentNode.id,
			type: currentNode.type,
			data: { ...currentNode.data, share_with_manager: shareWithManager },
			confidence: currentNode.confidence,
			decayScore: currentNode.decayScore,
			createdAt: currentNode.createdAt
		});

		return { success: true, shareWithManager };
	}
);

/** Delete a memory node from the graph. */
export const deleteMemoryNode = command(
	z.object({ nodeId: z.string().min(1) }),
	async ({ nodeId }) => {
		const { graph } = getGraphService();
		await graph.deleteNode(nodeId);

		return { success: true };
	}
);

/** Delete a user file via FILE_SERVICE. */
export const deleteUserFile = command(
	z.object({ fileId: z.string().min(1) }),
	async ({ fileId }) => {
		const { platform, locals } = getRequestEvent();
		if (!locals.user) throw error(401, 'Unauthorized');
		if (!platform?.env?.FILE_SERVICE) throw error(503, 'File service unavailable');

		const result = await platform.env.FILE_SERVICE.deleteFile({
			fileId,
			userId: locals.user.id
		});

		return {
			success: result.success,
			deletedVectorIds: result.deletedVectorIds,
			deletedGraphNodeIds: result.deletedGraphNodeIds
		};
	}
);
