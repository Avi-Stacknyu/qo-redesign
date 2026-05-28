/**
 * MemoryGraphService — Neon Postgres replacement for UserMemoryGraph Durable Object
 *
 * All graph data (nodes, edges, document_chunks) now lives in Neon Postgres
 * with tsvector+GIN for full-text search (replacing SQLite FTS5).
 * No caching layer — CTE-based single-query context building is fast enough (~5-15ms).
 *
 * Cloudflare services that remain external:
 * - Vectorize (DOCUMENT_CHUNKS, GRAPH_NODES indexes)
 * - R2 (DOCUMENTS_BUCKET)
 * - AI (toMarkdown, Whisper)
 * - Queues (doc-processing)
 */

import type { Database } from '../client';
import {
  graphNodes,
  graphEdges,
  graphDocumentChunks,
  userChatSuggestions,
  userProfileSummaries
} from '../schema';
import { eq, and, sql, inArray, or, desc, asc } from 'drizzle-orm';
import type {
  GraphNode,
  GraphEdge,
  UserContext,
  NodeType,
  EdgeType,
  NoteSyncInput,
  TodoSyncInput,
  ReminderSyncInput,
  FileRefSyncInput,
  PrivacyFilter
} from '../types/graph';
import type {
  ProfileFieldValue,
  ProfileSectionData,
  ProfilerResult,
  ProfileSchemaSection
} from '../types/graph';

/** Maximum nodes before pruning kicks in */
const MAX_GRAPH_NODES = 10_000;

/** Maximum edges before pruning kicks in */
const MAX_GRAPH_EDGES = 50_000;

// ============================================================================
// Row types from Postgres
// ============================================================================

interface PgNodeRow {
  [key: string]: unknown;
  id: string;
  userId: string;
  type: string;
  data: unknown;
  confidence: number | null;
  decayScore: number | null;
  searchText: string | null;
  searchCtx: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PgEdgeRow {
  [key: string]: unknown;
  id: number;
  userId: string;
  source: string;
  target: string;
  relationship: string;
  properties: unknown;
  createdAt: string;
}

// ============================================================================
// Service Class
// ============================================================================

export class MemoryGraphService {
  constructor(
    private readonly db: Database,
    private readonly userId: string
  ) {}

  // === Helpers ===

  private rowToGraphNode(row: PgNodeRow): GraphNode {
    return {
      id: row.id,
      type: row.type as NodeType,
      data: (row.data ?? {}) as Record<string, any>,
      confidence: row.confidence ?? 1.0,
      decayScore: row.decayScore ?? 1.0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private rowToGraphEdge(row: PgEdgeRow): GraphEdge {
    return {
      source: row.source,
      target: row.target,
      relationship: row.relationship as EdgeType,
      properties: (row.properties ?? {}) as Record<string, any>,
      createdAt: row.createdAt
    };
  }

  // === Core Node Operations ===

  async upsertNode(node: GraphNode): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(graphNodes)
      .values({
        id: node.id,
        userId: this.userId,
        type: node.type,
        data: node.data,
        confidence: node.confidence ?? 1.0,
        decayScore: node.decayScore ?? 1.0,
        createdAt: node.createdAt || now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: graphNodes.id,
        set: {
          type: node.type,
          data: node.data,
          confidence: node.confidence ?? 1.0,
          decayScore: sql`1.0`,
          updatedAt: now
        }
      });
  }

  async getNode(nodeId: string): Promise<GraphNode | null> {
    const rows = await this.db
      .select()
      .from(graphNodes)
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, this.userId)))
      .limit(1);
    if (rows.length === 0) return null;
    return this.rowToGraphNode(rows[0] as PgNodeRow);
  }

  async getNodesByType(type?: NodeType, limit = 50): Promise<GraphNode[]> {
    const conditions = [eq(graphNodes.userId, this.userId)];
    if (type) conditions.push(eq(graphNodes.type, type));

    const rows = await this.db
      .select()
      .from(graphNodes)
      .where(and(...conditions))
      .orderBy(desc(graphNodes.updatedAt))
      .limit(limit);

    return rows.map((r) => this.rowToGraphNode(r as PgNodeRow));
  }

  async getNodesBySource(sourceId: string): Promise<GraphNode[]> {
    const rows = await this.db
      .select()
      .from(graphNodes)
      .where(
        and(eq(graphNodes.userId, this.userId), sql`${graphNodes.data}->>'source' = ${sourceId}`)
      )
      .orderBy(desc(graphNodes.createdAt));
    return rows.map((r) => this.rowToGraphNode(r as PgNodeRow));
  }

  async deleteNodesBySource(sourceId: string): Promise<number> {
    const nodes = await this.getNodesBySource(sourceId);
    if (nodes.length === 0) return 0;

    const ids = nodes.map((n) => n.id);

    // Bulk delete edges connected to any of these nodes
    await this.db
      .delete(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, this.userId),
          or(inArray(graphEdges.source, ids), inArray(graphEdges.target, ids))
        )
      );

    // Bulk delete the nodes
    await this.db
      .delete(graphNodes)
      .where(and(eq(graphNodes.userId, this.userId), inArray(graphNodes.id, ids)));

    return ids.length;
  }

  // === Edge Operations ===

  async connectNodes(
    source: string,
    target: string,
    relationship: EdgeType,
    properties?: Record<string, any>
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(graphEdges)
      .values({
        userId: this.userId,
        source,
        target,
        relationship,
        properties: properties ?? {},
        createdAt: now
      })
      .onConflictDoUpdate({
        target: [graphEdges.userId, graphEdges.source, graphEdges.target, graphEdges.relationship],
        set: {
          properties: properties ?? {}
        }
      });
  }

  async disconnect(source: string, target: string, relationship: EdgeType): Promise<void> {
    await this.db
      .delete(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, this.userId),
          eq(graphEdges.source, source),
          eq(graphEdges.target, target),
          eq(graphEdges.relationship, relationship)
        )
      );
  }

  async deleteNode(nodeId: string): Promise<GraphNode | null> {
    const node = await this.getNode(nodeId);
    if (!node) return null;

    // Delete all edges connected to this node
    await this.db
      .delete(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, this.userId),
          or(eq(graphEdges.source, nodeId), eq(graphEdges.target, nodeId))
        )
      );

    // Delete the node
    await this.db
      .delete(graphNodes)
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, this.userId)));

    return node;
  }

  // === Traversal ===

  async findNeighbors(
    nodeId: string,
    direction: 'inbound' | 'outbound' | 'both' = 'both',
    relationship?: EdgeType
  ): Promise<string[]> {
    const userCond = eq(graphEdges.userId, this.userId);
    const relCond = relationship ? eq(graphEdges.relationship, relationship) : undefined;

    if (direction === 'outbound' || direction === 'both') {
      const outConds = [userCond, eq(graphEdges.source, nodeId)];
      if (relCond) outConds.push(relCond);
      const outRows = await this.db
        .selectDistinct({ neighbor: graphEdges.target })
        .from(graphEdges)
        .where(and(...outConds));

      if (direction === 'outbound') return outRows.map((r) => r.neighbor);

      const inConds = [userCond, eq(graphEdges.target, nodeId)];
      if (relCond) inConds.push(relCond);
      const inRows = await this.db
        .selectDistinct({ neighbor: graphEdges.source })
        .from(graphEdges)
        .where(and(...inConds));

      const set = new Set([...outRows.map((r) => r.neighbor), ...inRows.map((r) => r.neighbor)]);
      return Array.from(set);
    }

    // inbound
    const inConds = [userCond, eq(graphEdges.target, nodeId)];
    if (relCond) inConds.push(relCond);
    const rows = await this.db
      .selectDistinct({ neighbor: graphEdges.source })
      .from(graphEdges)
      .where(and(...inConds));
    return rows.map((r) => r.neighbor);
  }

  async getNeighbors(
    nodeId: string,
    relationship?: EdgeType
  ): Promise<{
    outgoing: Array<{
      id: string;
      type: string;
      relationship: string;
      data: unknown;
      properties: unknown;
    }>;
    incoming: Array<{
      id: string;
      type: string;
      relationship: string;
      data: unknown;
      properties: unknown;
    }>;
  }> {
    const userCond = eq(graphEdges.userId, this.userId);

    const outConds = [userCond, eq(graphEdges.source, nodeId)];
    if (relationship) outConds.push(eq(graphEdges.relationship, relationship));

    const outRows = await this.db
      .select({
        id: graphNodes.id,
        type: graphNodes.type,
        relationship: graphEdges.relationship,
        data: graphNodes.data,
        properties: graphEdges.properties
      })
      .from(graphEdges)
      .innerJoin(graphNodes, eq(graphEdges.target, graphNodes.id))
      .where(and(...outConds));

    const inConds = [userCond, eq(graphEdges.target, nodeId)];
    if (relationship) inConds.push(eq(graphEdges.relationship, relationship));

    const inRows = await this.db
      .select({
        id: graphNodes.id,
        type: graphNodes.type,
        relationship: graphEdges.relationship,
        data: graphNodes.data,
        properties: graphEdges.properties
      })
      .from(graphEdges)
      .innerJoin(graphNodes, eq(graphEdges.source, graphNodes.id))
      .where(and(...inConds));

    return { outgoing: outRows, incoming: inRows };
  }

  async traverse(
    startNodeId: string,
    options: {
      endNodeId?: string;
      maxDepth?: number;
      relationship?: EdgeType;
      direction?: 'inbound' | 'outbound' | 'both';
    } = {}
  ): Promise<{
    found: boolean;
    path?: string[];
    depth?: number;
    reachableNodes?: string[];
    count?: number;
  }> {
    const { endNodeId, maxDepth = 10, relationship, direction = 'both' } = options;
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[]; depth: number }> = [
      { id: startNodeId, path: [startNodeId], depth: 0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) continue;

      if (endNodeId && current.id === endNodeId) {
        return { found: true, path: current.path, depth: current.depth };
      }

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const neighbors = await this.findNeighbors(current.id, direction, relationship);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          queue.push({
            id: neighborId,
            path: [...current.path, neighborId],
            depth: current.depth + 1
          });
        }
      }
    }

    if (endNodeId) return { found: false };
    return { found: true, reachableNodes: Array.from(visited), count: visited.size };
  }

  // === Stats ===

  async getStats(): Promise<{
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    edgesByRelationship: Record<string, number>;
  }> {
    const [nodeCountRes, edgeCountRes, nodesByTypeRes, edgesByRelRes] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(graphNodes)
        .where(eq(graphNodes.userId, this.userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(graphEdges)
        .where(eq(graphEdges.userId, this.userId)),
      this.db
        .select({
          type: graphNodes.type,
          count: sql<number>`count(*)::int`
        })
        .from(graphNodes)
        .where(eq(graphNodes.userId, this.userId))
        .groupBy(graphNodes.type),
      this.db
        .select({
          relationship: graphEdges.relationship,
          count: sql<number>`count(*)::int`
        })
        .from(graphEdges)
        .where(eq(graphEdges.userId, this.userId))
        .groupBy(graphEdges.relationship)
    ]);

    const nodesByType: Record<string, number> = {};
    for (const r of nodesByTypeRes) nodesByType[r.type] = r.count;

    const edgesByRelationship: Record<string, number> = {};
    for (const r of edgesByRelRes) edgesByRelationship[r.relationship] = r.count;

    return {
      nodeCount: nodeCountRes[0]?.count ?? 0,
      edgeCount: edgeCountRes[0]?.count ?? 0,
      nodesByType,
      edgesByRelationship
    };
  }

  // === Data Reset ===

  async clearAllData(): Promise<{
    success: boolean;
    deleted: { nodes: number; edges: number; chunks: number };
  }> {
    const [nodeCountRes, edgeCountRes, chunkCountRes] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(graphNodes)
        .where(eq(graphNodes.userId, this.userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(graphEdges)
        .where(eq(graphEdges.userId, this.userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(graphDocumentChunks)
        .where(eq(graphDocumentChunks.userId, this.userId))
    ]);

    const nodeCount = nodeCountRes[0]?.count ?? 0;
    const edgeCount = edgeCountRes[0]?.count ?? 0;
    const chunkCount = chunkCountRes[0]?.count ?? 0;

    // Delete order: edges first (FK references nodes), then nodes, then chunks
    await this.db.delete(graphEdges).where(eq(graphEdges.userId, this.userId));
    await this.db.delete(graphNodes).where(eq(graphNodes.userId, this.userId));
    await this.db.delete(graphDocumentChunks).where(eq(graphDocumentChunks.userId, this.userId));

    // Clean up cached records in Postgres
    try {
      await Promise.all([
        this.db.delete(userChatSuggestions).where(eq(userChatSuggestions.user, this.userId)),
        this.db.delete(userProfileSummaries).where(eq(userProfileSummaries.user, this.userId))
      ]);
    } catch (error) {
      console.error('[MemoryGraphService] clear_all_data_db_cleanup_failed', error);
    }

    console.log('[MemoryGraphService] clear_all_data_complete', {
      deleted: { nodes: nodeCount, edges: edgeCount, chunks: chunkCount }
    });
    return { success: true, deleted: { nodes: nodeCount, edges: edgeCount, chunks: chunkCount } };
  }

  // === Export Full Graph ===

  async getFullGraph(options: { limit?: number } = {}): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: {
      nodeCount: number;
      edgeCount: number;
      nodesByType: Record<string, number>;
      edgesByRelationship: Record<string, number>;
    };
  }> {
    const { limit = 500 } = options;

    const nodeRows = await this.db
      .select()
      .from(graphNodes)
      .where(eq(graphNodes.userId, this.userId))
      .orderBy(desc(graphNodes.updatedAt), asc(graphNodes.id))
      .limit(limit);

    const nodes = nodeRows.map((r) => this.rowToGraphNode(r as PgNodeRow));

    if (nodes.length === 0) {
      return { nodes: [], edges: [], stats: await this.getStats() };
    }

    const nodeIds = nodes.map((n) => n.id);
    const edgeRows = await this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, this.userId),
          inArray(graphEdges.source, nodeIds),
          inArray(graphEdges.target, nodeIds)
        )
      )
      .orderBy(desc(graphEdges.createdAt));

    const edges = edgeRows.map((r) => this.rowToGraphEdge(r as PgEdgeRow));

    return { nodes, edges, stats: await this.getStats() };
  }

  async getFullGraphForManager(options: { limit?: number } = {}): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: {
      nodeCount: number;
      edgeCount: number;
      nodesByType: Record<string, number>;
      edgesByRelationship: Record<string, number>;
    };
  }> {
    const { limit = 500 } = options;

    const nodeRows = await this.db
      .select()
      .from(graphNodes)
      .where(
        and(
          eq(graphNodes.userId, this.userId),
          sql`${graphNodes.data}->>'share_with_manager' = 'true'`
        )
      )
      .orderBy(desc(graphNodes.updatedAt), asc(graphNodes.id))
      .limit(limit);

    const nodes = nodeRows.map((r) => this.rowToGraphNode(r as PgNodeRow));

    if (nodes.length === 0) {
      return {
        nodes: [],
        edges: [],
        stats: { nodeCount: 0, edgeCount: 0, nodesByType: {}, edgesByRelationship: {} }
      };
    }

    const nodeIds = nodes.map((n) => n.id);
    const edgeRows = await this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, this.userId),
          inArray(graphEdges.source, nodeIds),
          inArray(graphEdges.target, nodeIds)
        )
      )
      .orderBy(desc(graphEdges.createdAt));

    const edges = edgeRows.map((r) => this.rowToGraphEdge(r as PgEdgeRow));

    const nodesByType: Record<string, number> = {};
    for (const node of nodes) nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;

    const edgesByRelationship: Record<string, number> = {};
    for (const edge of edges)
      edgesByRelationship[edge.relationship] = (edgesByRelationship[edge.relationship] || 0) + 1;

    return {
      nodes,
      edges,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodesByType,
        edgesByRelationship
      }
    };
  }

  // === Full-Text Search (Postgres tsvector + GIN replacing SQLite FTS5) ===

  async ftsSearchNodes(query: string, limit = 20): Promise<Array<{ id: string; rank: number }>> {
    if (!query.trim()) return [];

    const results = await this.db.execute<{ id: string; rank: number }>(
      sql`SELECT id, ts_rank(
				to_tsvector('english', coalesce(search_text, '') || ' ' || coalesce(search_ctx, '')),
				websearch_to_tsquery('english', ${query})
			) AS rank
			FROM graph_nodes
			WHERE user_id = ${this.userId}
			AND to_tsvector('english', coalesce(search_text, '') || ' ' || coalesce(search_ctx, ''))
				@@ websearch_to_tsquery('english', ${query})
			ORDER BY rank DESC
			LIMIT ${limit}`
    );

    return results.rows.map((r, idx) => ({ id: r.id, rank: idx + 1 }));
  }

  async ftsSearchChunks(
    query: string,
    limit = 20
  ): Promise<Array<{ id: string; rank: number; text: string; context: string }>> {
    if (!query.trim()) return [];

    const results = await this.db.execute<{
      id: string;
      rank: number;
      text_content: string;
      context: string;
    }>(
      sql`SELECT id, text_content, coalesce(context, '') AS context,
				ts_rank(
					to_tsvector('english', text_content || ' ' || coalesce(context, '')),
					websearch_to_tsquery('english', ${query})
				) AS rank
			FROM graph_document_chunks
			WHERE user_id = ${this.userId}
			AND to_tsvector('english', text_content || ' ' || coalesce(context, ''))
				@@ websearch_to_tsquery('english', ${query})
			ORDER BY rank DESC
			LIMIT ${limit}`
    );

    return results.rows.map((r, idx) => ({
      id: r.id,
      rank: idx + 1,
      text: r.text_content,
      context: r.context
    }));
  }

  // === Chunk Operations ===

  async upsertChunk(chunk: {
    id: string;
    fileKey: string;
    chunkIndex: number;
    text: string;
    context?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(graphDocumentChunks)
      .values({
        id: chunk.id,
        userId: this.userId,
        fileKey: chunk.fileKey,
        chunkIndex: chunk.chunkIndex,
        textContent: chunk.text,
        context: chunk.context || '',
        createdAt: now
      })
      .onConflictDoUpdate({
        target: graphDocumentChunks.id,
        set: {
          textContent: chunk.text,
          context: chunk.context || ''
        }
      });
  }

  async batchUpsertChunks(
    chunks: Array<{
      id: string;
      fileKey: string;
      chunkIndex: number;
      text: string;
      context?: string;
    }>
  ): Promise<void> {
    if (chunks.length === 0) return;
    const now = new Date().toISOString();

    // Use batched insert for efficiency
    const values = chunks.map((c) => ({
      id: c.id,
      userId: this.userId,
      fileKey: c.fileKey,
      chunkIndex: c.chunkIndex,
      textContent: c.text,
      context: c.context || '',
      createdAt: now
    }));

    await this.db
      .insert(graphDocumentChunks)
      .values(values)
      .onConflictDoUpdate({
        target: graphDocumentChunks.id,
        set: {
          textContent: sql`excluded.text_content`,
          context: sql`excluded.context`
        }
      });
  }

  async getChunk(chunkId: string): Promise<{
    id: string;
    fileKey: string;
    chunkIndex: number;
    text: string;
    context: string;
  } | null> {
    const rows = await this.db
      .select()
      .from(graphDocumentChunks)
      .where(and(eq(graphDocumentChunks.id, chunkId), eq(graphDocumentChunks.userId, this.userId)))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      fileKey: row.fileKey,
      chunkIndex: row.chunkIndex,
      text: row.textContent,
      context: row.context || ''
    };
  }

  async deleteChunksByFileKey(fileKey: string): Promise<number> {
    const result = await this.db
      .delete(graphDocumentChunks)
      .where(
        and(eq(graphDocumentChunks.userId, this.userId), eq(graphDocumentChunks.fileKey, fileKey))
      );
    return result.rowCount ?? 0;
  }

  // === Decay Management ===

  private async updateDecayScores(): Promise<void> {
    await this.db.execute(
      sql`UPDATE graph_nodes SET decay_score = GREATEST(0.1, 1.0 - (
				EXTRACT(EPOCH FROM (now() - updated_at::timestamptz)) / 86400.0 * 0.01
			))
			WHERE user_id = ${this.userId}
			AND type IN ('SESSION', 'ENTITY', 'TOPIC')
			AND decay_score > 0.1`
    );
  }

  async getRecentEntities(limit = 20): Promise<GraphNode[]> {
    const rows = await this.db
      .select()
      .from(graphNodes)
      .where(
        and(
          eq(graphNodes.userId, this.userId),
          eq(graphNodes.type, 'ENTITY'),
          or(
            sql`${graphNodes.data}->>'expires_at' IS NULL`,
            sql`(${graphNodes.data}->>'expires_at')::timestamptz > now()`
          )
        )
      )
      .orderBy(
        sql`(${graphNodes.confidence} * COALESCE(${graphNodes.decayScore}, 1.0)) DESC`,
        desc(graphNodes.updatedAt)
      )
      .limit(limit);

    return rows.map((r) => this.rowToGraphNode(r as PgNodeRow));
  }

  // === Context Building (CTE-based, no cache) ===

  async getContext(userId: string): Promise<UserContext> {
    await this.updateDecayScores();

    // Single CTE query for all context sections
    const result = await this.db.execute<{
      section: string;
      data: string;
    }>(sql`
			WITH user_facts AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_FACT' AND n.type = 'FACT'
				AND n.user_id = ${this.userId}
				AND (n.data->>'expires_at' IS NULL
					OR (n.data->>'expires_at')::timestamptz > now())
				ORDER BY (n.confidence * COALESCE(n.decay_score, 1.0)) DESC, n.updated_at DESC
				LIMIT 20
			),
			user_intents AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_INTENT' AND n.type = 'INTENT'
				AND n.user_id = ${this.userId}
				AND n.data->>'status' = 'active'
				ORDER BY n.updated_at DESC
				LIMIT 10
			),
			user_sessions AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_SESSION' AND n.type = 'SESSION'
				AND n.user_id = ${this.userId}
				ORDER BY (n.confidence * COALESCE(n.decay_score, 1.0)) DESC, n.updated_at DESC
				LIMIT 5
			),
			user_action_items AS (
				SELECT * FROM graph_nodes
				WHERE type = 'ACTION_ITEM' AND user_id = ${this.userId}
				AND data->>'status' != 'completed'
				ORDER BY data->>'due' ASC
				LIMIT 10
			)
			SELECT 'facts' AS section, json_agg(row_to_json(f))::text AS data FROM user_facts f
			UNION ALL
			SELECT 'intents', json_agg(row_to_json(i))::text FROM user_intents i
			UNION ALL
			SELECT 'sessions', json_agg(row_to_json(s))::text FROM user_sessions s
			UNION ALL
			SELECT 'action_items', json_agg(row_to_json(a))::text FROM user_action_items a
		`);

    const sections: Record<string, any[]> = {
      facts: [],
      intents: [],
      sessions: [],
      action_items: []
    };

    for (const row of result.rows) {
      if (row.data) {
        const parsed = JSON.parse(row.data) as any[];
        sections[row.section] = parsed.map((r: any) =>
          this.rowToGraphNode({
            id: r.id,
            userId: r.user_id,
            type: r.type,
            data: r.data,
            confidence: r.confidence,
            decayScore: r.decay_score,
            searchText: r.search_text,
            searchCtx: r.search_ctx,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          })
        );
      }
    }

    return {
      userId,
      facts: sections.facts,
      activeIntents: sections.intents,
      recentSessions: sections.sessions,
      actionItems: sections.action_items,
      notes: [],
      todos: [],
      reminders: [],
      chatFiles: [],
      accessibleFiles: []
    };
  }

  async getContextForQuery(userId: string, query: string): Promise<UserContext> {
    await this.updateDecayScores();

    const baseContext = await this.getContext(userId);

    if (!query.trim()) return baseContext;

    // FTS-enriched sessions/entities/topics
    const ftsResults = await this.db.execute<PgNodeRow>(sql`
			SELECT n.*,
				ts_rank(
					to_tsvector('english', coalesce(n.search_text, '') || ' ' || coalesce(n.search_ctx, '')),
					websearch_to_tsquery('english', ${query})
				) AS fts_rank
			FROM graph_nodes n
			WHERE n.user_id = ${this.userId}
			AND n.type IN ('SESSION', 'ENTITY', 'TOPIC')
			AND to_tsvector('english', coalesce(n.search_text, '') || ' ' || coalesce(n.search_ctx, ''))
				@@ websearch_to_tsquery('english', ${query})
			ORDER BY fts_rank DESC
			LIMIT 5
		`);

    const ftsNodes = ftsResults.rows.map((r) => this.rowToGraphNode(r as PgNodeRow));

    // Blend: top by confidence + top by recency (for SESSION/ENTITY/TOPIC)
    const confidenceRows = await this.db
      .select()
      .from(graphNodes)
      .where(
        and(
          eq(graphNodes.userId, this.userId),
          sql`${graphNodes.type} IN ('SESSION', 'ENTITY', 'TOPIC')`
        )
      )
      .orderBy(sql`(${graphNodes.confidence} * COALESCE(${graphNodes.decayScore}, 1.0)) DESC`)
      .limit(5);

    const recencyRows = await this.db
      .select()
      .from(graphNodes)
      .where(
        and(
          eq(graphNodes.userId, this.userId),
          sql`${graphNodes.type} IN ('SESSION', 'ENTITY', 'TOPIC')`
        )
      )
      .orderBy(desc(graphNodes.updatedAt))
      .limit(5);

    // Deduplicate across all three sources
    const seen = new Set<string>();
    const blended: GraphNode[] = [];
    for (const arr of [
      ftsNodes,
      confidenceRows.map((r) => this.rowToGraphNode(r as PgNodeRow)),
      recencyRows.map((r) => this.rowToGraphNode(r as PgNodeRow))
    ]) {
      for (const node of arr) {
        if (!seen.has(node.id)) {
          seen.add(node.id);
          blended.push(node);
        }
      }
    }

    return {
      ...baseContext,
      recentSessions: blended.filter((n) => n.type === 'SESSION').slice(0, 5)
    };
  }

  async getFullContext(userId: string): Promise<UserContext> {
    const result = await this.db.execute<{
      section: string;
      data: string;
    }>(sql`
			WITH user_facts AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_FACT' AND n.type = 'FACT'
				AND n.user_id = ${this.userId}
				ORDER BY n.confidence DESC, n.updated_at DESC
				LIMIT 500
			),
			user_intents AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_INTENT' AND n.type = 'INTENT'
				AND n.user_id = ${this.userId}
				ORDER BY n.updated_at DESC
				LIMIT 200
			),
			user_sessions AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_SESSION' AND n.type = 'SESSION'
				AND n.user_id = ${this.userId}
				ORDER BY n.updated_at DESC
				LIMIT 100
			),
			user_action_items AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND n.type = 'ACTION_ITEM'
				AND n.user_id = ${this.userId}
				ORDER BY n.updated_at DESC
				LIMIT 200
			),
			user_notes AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_NOTE' AND n.type = 'NOTE'
				AND n.user_id = ${this.userId}
				ORDER BY n.updated_at DESC
				LIMIT 200
			),
			user_todos AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_TODO' AND n.type = 'TODO'
				AND n.user_id = ${this.userId}
				ORDER BY n.updated_at DESC
				LIMIT 200
			),
			user_reminders AS (
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
				WHERE e.source = ${userId} AND e.relationship = 'HAS_REMINDER' AND n.type = 'REMINDER'
				AND n.user_id = ${this.userId}
				ORDER BY n.updated_at DESC
				LIMIT 200
			)
			SELECT 'facts' AS section, json_agg(row_to_json(f))::text AS data FROM user_facts f
			UNION ALL SELECT 'intents', json_agg(row_to_json(i))::text FROM user_intents i
			UNION ALL SELECT 'sessions', json_agg(row_to_json(s))::text FROM user_sessions s
			UNION ALL SELECT 'action_items', json_agg(row_to_json(a))::text FROM user_action_items a
			UNION ALL SELECT 'notes', json_agg(row_to_json(n))::text FROM user_notes n
			UNION ALL SELECT 'todos', json_agg(row_to_json(t))::text FROM user_todos t
			UNION ALL SELECT 'reminders', json_agg(row_to_json(r))::text FROM user_reminders r
		`);

    const sections: Record<string, GraphNode[]> = {};
    const sectionKeys = [
      'facts',
      'intents',
      'sessions',
      'action_items',
      'notes',
      'todos',
      'reminders'
    ];
    for (const k of sectionKeys) sections[k] = [];

    for (const row of result.rows) {
      if (row.data) {
        const parsed = JSON.parse(row.data) as any[];
        sections[row.section] = parsed.map((r: any) =>
          this.rowToGraphNode({
            id: r.id,
            userId: r.user_id,
            type: r.type,
            data: r.data,
            confidence: r.confidence,
            decayScore: r.decay_score,
            searchText: r.search_text,
            searchCtx: r.search_ctx,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          })
        );
      }
    }

    return {
      userId,
      facts: sections.facts,
      activeIntents: sections.intents,
      recentSessions: sections.sessions,
      actionItems: sections.action_items,
      notes: sections.notes,
      todos: sections.todos,
      reminders: sections.reminders,
      chatFiles: [],
      accessibleFiles: []
    };
  }

  async getContextWithPrivacy(
    userId: string,
    filter: PrivacyFilter,
    chatId?: string
  ): Promise<UserContext> {
    const baseContext = await this.getContext(userId);
    const privacyClause = this.buildPrivacyClause(filter);

    // Notes with privacy filter
    const notes = await this.db.execute<PgNodeRow>(sql`
			SELECT n.* FROM graph_nodes n
			JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
			WHERE e.source = ${userId} AND e.relationship = 'HAS_NOTE' AND n.type = 'NOTE'
			AND n.user_id = ${this.userId}
			${privacyClause}
			ORDER BY n.updated_at DESC
			LIMIT 20
		`);

    // Pending todos with privacy filter
    const todos = await this.db.execute<PgNodeRow>(sql`
			SELECT n.* FROM graph_nodes n
			JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
			WHERE e.source = ${userId} AND e.relationship = 'HAS_TODO' AND n.type = 'TODO'
			AND n.user_id = ${this.userId}
			AND n.data->>'status' IN ('pending', 'in_progress')
			${privacyClause}
			ORDER BY
				CASE n.data->>'priority'
					WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4
				END,
				n.data->>'dueDate' ASC
			LIMIT 15
		`);

    // Active reminders with privacy filter
    const reminders = await this.db.execute<PgNodeRow>(sql`
			SELECT n.* FROM graph_nodes n
			JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
			WHERE e.source = ${userId} AND e.relationship = 'HAS_REMINDER' AND n.type = 'REMINDER'
			AND n.user_id = ${this.userId}
			AND (n.data->>'isActive')::boolean = true
			${privacyClause}
			ORDER BY n.data->>'reminderTime' ASC
			LIMIT 10
		`);

    // Chat files
    let chatFiles: GraphNode[] = [];
    if (chatId) {
      const chatFileRows = await this.db.execute<PgNodeRow>(sql`
				SELECT n.* FROM graph_nodes n
				JOIN graph_edges e ON n.id = e.source AND e.user_id = n.user_id
				WHERE e.target = ${chatId} AND e.relationship = 'REFERENCED_IN' AND n.type = 'FILE_REF'
				AND n.user_id = ${this.userId}
				ORDER BY n.updated_at DESC
			`);
      chatFiles = chatFileRows.rows.map((r) => this.rowToGraphNode(r as PgNodeRow));
    }

    // Accessible files
    const accessibleFiles = await this.db.execute<PgNodeRow>(sql`
			SELECT n.* FROM graph_nodes n
			JOIN graph_edges e ON n.id = e.target AND e.user_id = n.user_id
			WHERE e.source = ${userId} AND e.relationship = 'HAS_FILE' AND n.type = 'FILE_REF'
			AND n.user_id = ${this.userId}
			AND (n.data->>'shareWithAgent')::boolean = true
			${privacyClause}
			ORDER BY n.updated_at DESC
			LIMIT 50
		`);

    return {
      ...baseContext,
      notes: notes.rows.map((r) => this.rowToGraphNode(r as PgNodeRow)),
      todos: todos.rows.map((r) => this.rowToGraphNode(r as PgNodeRow)),
      reminders: reminders.rows.map((r) => this.rowToGraphNode(r as PgNodeRow)),
      chatFiles,
      accessibleFiles: accessibleFiles.rows.map((r) => this.rowToGraphNode(r as PgNodeRow))
    };
  }

  private buildPrivacyClause(filter: PrivacyFilter) {
    switch (filter.requestedBy) {
      case 'user':
        return sql``;
      case 'agent':
        return sql`AND (n.data->>'shareWithAgent')::boolean = true`;
      case 'admin':
        return sql`AND (n.data->>'shareWithAdmin')::boolean = true`;
      case 'manager':
        return sql`AND (n.data->>'shareWithManager')::boolean = true`;
      default:
        return sql``;
    }
  }

  // === Database Sync Methods ===

  async syncNote(input: NoteSyncInput): Promise<void> {
    const nodeId = `note:${input.pbId}`;

    if (!input.includeInMemory) {
      await this.deleteNode(nodeId);
      return;
    }

    const node: GraphNode = {
      id: nodeId,
      type: 'NOTE',
      data: {
        pbId: input.pbId,
        title: input.title,
        content: input.content,
        tags: input.tags || [],
        shareWithAdmin: input.shareWithAdmin,
        shareWithManager: input.shareWithManager,
        shareWithAgent: true
      },
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      confidence: 1.0,
      decayScore: 1.0
    };

    await this.upsertNode(node);
    await this.connectNodes(`user::${input.userId}`, nodeId, 'HAS_NOTE');
  }

  async syncTodo(input: TodoSyncInput): Promise<void> {
    const nodeId = `todo:${input.pbId}`;

    if (!input.includeInMemory) {
      await this.deleteNode(nodeId);
      return;
    }

    const node: GraphNode = {
      id: nodeId,
      type: 'TODO',
      data: {
        pbId: input.pbId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        shareWithAdmin: input.shareWithAdmin,
        shareWithManager: input.shareWithManager,
        shareWithAgent: true
      },
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      confidence: 1.0,
      decayScore: 1.0
    };

    await this.upsertNode(node);
    await this.connectNodes(`user::${input.userId}`, nodeId, 'HAS_TODO');
  }

  async syncReminder(input: ReminderSyncInput): Promise<void> {
    const nodeId = `reminder:${input.pbId}`;

    if (!input.includeInMemory) {
      await this.deleteNode(nodeId);
      return;
    }

    const node: GraphNode = {
      id: nodeId,
      type: 'REMINDER',
      data: {
        pbId: input.pbId,
        title: input.title,
        description: input.description,
        reminderTime: input.reminderTime,
        recurring: input.recurring || 'none',
        isActive: input.isActive,
        shareWithAdmin: input.shareWithAdmin,
        shareWithManager: input.shareWithManager,
        shareWithAgent: true
      },
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      confidence: 1.0,
      decayScore: 1.0
    };

    await this.upsertNode(node);
    await this.connectNodes(`user::${input.userId}`, nodeId, 'HAS_REMINDER');
  }

  async syncFileRef(input: FileRefSyncInput): Promise<void> {
    const nodeId = `file:${input.source}:${input.pbId}`;

    const node: GraphNode = {
      id: nodeId,
      type: 'FILE_REF',
      data: {
        pbId: input.pbId,
        filename: input.filename,
        fileType: input.fileType,
        vectorIds: input.vectorIds || [],
        isPrivate: input.isPrivate,
        shareWithAgent: input.shareWithAgent,
        shareWithAdmin: input.shareWithAdmin,
        shareWithManager: input.shareWithManager,
        source: input.source
      },
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      confidence: 1.0,
      decayScore: 1.0
    };

    await this.upsertNode(node);
    await this.connectNodes(`user::${input.userId}`, nodeId, 'HAS_FILE');

    if (input.chatId) {
      await this.connectNodes(nodeId, input.chatId, 'REFERENCED_IN');
    }
  }

  async referenceFileInChat(fileNodeId: string, chatId: string): Promise<void> {
    await this.connectNodes(fileNodeId, chatId, 'REFERENCED_IN');
  }

  async unreferenceFileFromChat(fileNodeId: string, chatId: string): Promise<void> {
    await this.disconnect(fileNodeId, chatId, 'REFERENCED_IN');
  }

  async getChatFiles(chatId: string): Promise<GraphNode[]> {
    const rows = await this.db
      .select({ node: graphNodes })
      .from(graphNodes)
      .innerJoin(
        graphEdges,
        and(eq(graphNodes.id, graphEdges.source), eq(graphEdges.userId, graphNodes.userId))
      )
      .where(
        and(
          eq(graphEdges.target, chatId),
          eq(graphEdges.relationship, 'REFERENCED_IN'),
          eq(graphNodes.type, 'FILE_REF'),
          eq(graphNodes.userId, this.userId)
        )
      )
      .orderBy(desc(graphNodes.updatedAt));

    return rows.map((r) => this.rowToGraphNode(r.node as PgNodeRow));
  }

  async removeSyncedItem(
    pbId: string,
    type: 'note' | 'todo' | 'reminder' | 'file',
    source?: 'user' | 'system'
  ): Promise<void> {
    let nodeId: string;
    switch (type) {
      case 'note':
        nodeId = `note:${pbId}`;
        break;
      case 'todo':
        nodeId = `todo:${pbId}`;
        break;
      case 'reminder':
        nodeId = `reminder:${pbId}`;
        break;
      case 'file':
        nodeId = `file:${source || 'user'}:${pbId}`;
        break;
    }
    await this.deleteNode(nodeId);
  }

  // === Batch Operations ===

  async batchUpsert(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    for (const node of nodes) {
      await this.upsertNode(node);
    }
    for (const edge of edges) {
      await this.connectNodes(edge.source, edge.target, edge.relationship, edge.properties);
    }
  }

  // === Decay Management ===

  async touchNode(nodeId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(graphNodes)
      .set({ decayScore: 1.0, updatedAt: now })
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, this.userId)));
  }

  async applyDecay(decayFactor = 0.95): Promise<void> {
    await this.db.execute(
      sql`UPDATE graph_nodes
				SET decay_score = decay_score * ${decayFactor}
				WHERE user_id = ${this.userId}
				AND type IN ('ENTITY', 'TOPIC')`
    );
    await this.pruneIfNeeded();
  }

  private async pruneIfNeeded(): Promise<void> {
    const { nodeCount, edgeCount } = await this.getStats();

    if (nodeCount > MAX_GRAPH_NODES) {
      const excess = nodeCount - MAX_GRAPH_NODES;
      await this.db.execute(sql`
				DELETE FROM graph_nodes WHERE id IN (
					SELECT id FROM graph_nodes
					WHERE user_id = ${this.userId}
					AND type IN ('ENTITY', 'TOPIC', 'SESSION')
					ORDER BY decay_score ASC, updated_at ASC
					LIMIT ${excess}
				)
			`);
    }

    if (edgeCount > MAX_GRAPH_EDGES) {
      const excess = edgeCount - MAX_GRAPH_EDGES;
      await this.db.execute(sql`
				DELETE FROM graph_edges WHERE id IN (
					SELECT id FROM graph_edges
					WHERE user_id = ${this.userId}
					ORDER BY created_at ASC
					LIMIT ${excess}
				)
			`);
    }
  }

  // === Profile Section Operations ===

  async getProfile(): Promise<GraphNode[]> {
    const rows = await this.db
      .select()
      .from(graphNodes)
      .where(and(eq(graphNodes.userId, this.userId), eq(graphNodes.type, 'PROFILE_SECTION')))
      .orderBy(sql`(${graphNodes.data}->>'order')::int ASC`);

    return rows.map((r) => this.rowToGraphNode(r as PgNodeRow));
  }

  async upsertProfileField(
    userId: string,
    sectionId: string,
    fieldKey: string,
    fieldValue: ProfileFieldValue,
    sectionMeta?: { label: string; icon: string; order: number }
  ): Promise<void> {
    const nodeId = `profile::${this.userId}::${sectionId}`;
    const existing = await this.getNode(nodeId);

    let sectionData: ProfileSectionData;
    if (existing) {
      sectionData = existing.data as ProfileSectionData;
    } else {
      sectionData = {
        label: sectionMeta?.label ?? sectionId,
        icon: sectionMeta?.icon ?? 'user',
        order: sectionMeta?.order ?? 99,
        fields: {}
      };
    }

    sectionData.fields[fieldKey] = fieldValue;

    await this.upsertNode({
      id: nodeId,
      type: 'PROFILE_SECTION',
      data: sectionData as unknown as Record<string, any>,
      confidence: 1.0
    });

    await this.connectNodes(`user::${userId}`, nodeId, 'HAS_PROFILE_SECTION');
  }

  async deleteProfileField(sectionId: string, fieldKey: string): Promise<boolean> {
    const nodeId = `profile::${this.userId}::${sectionId}`;
    const existing = await this.getNode(nodeId);
    if (!existing) return false;

    const sectionData = existing.data as ProfileSectionData;
    if (!(fieldKey in sectionData.fields)) return false;

    delete sectionData.fields[fieldKey];

    await this.upsertNode({
      id: nodeId,
      type: 'PROFILE_SECTION',
      data: sectionData as unknown as Record<string, any>,
      confidence: 1.0
    });

    return true;
  }

  async applyProfileUpdates(
    userId: string,
    updates: ProfilerResult['updates'],
    source: 'onboarding' | 'chat' | 'user_edit',
    schema?: ProfileSchemaSection[],
    sectionMetaMap?: Record<string, { label: string; icon: string; order: number }>
  ): Promise<void> {
    const now = new Date().toISOString();

    const schemaFieldKeys = new Map<string, Set<string>>();
    if (schema) {
      for (const section of schema) {
        const keys = new Set<string>();
        for (const field of section.fields) keys.add(field.key);
        schemaFieldKeys.set(section.section_id, keys);
      }
    }

    const defaultConfidence = source === 'chat' ? 0.8 : 1.0;

    for (const update of updates) {
      if (!update.section || update.section === 'undefined') {
        console.warn('[MemoryGraphService] profile_update_skipped_invalid_section', {
          section: update.section,
          source,
          fields: Object.keys(update.fields ?? {})
        });
        continue;
      }
      const nodeId = `profile::${this.userId}::${update.section}`;
      const existing = await this.getNode(nodeId);

      let sectionData: ProfileSectionData;
      if (existing) {
        sectionData = existing.data as ProfileSectionData;
      } else {
        const meta = sectionMetaMap?.[update.section];
        const schemaSection = schema?.find((s) => s.section_id === update.section);
        sectionData = {
          label: meta?.label ?? schemaSection?.label ?? update.section,
          icon: meta?.icon ?? schemaSection?.icon ?? 'user',
          order: meta?.order ?? schemaSection?.order ?? 99,
          fields: {}
        };
      }

      const sectionSchemaKeys = schemaFieldKeys.get(update.section);

      for (const [fieldKey, fieldUpdate] of Object.entries(update.fields)) {
        const isSchema = sectionSchemaKeys?.has(fieldKey) ?? false;
        const existingField = sectionData.fields[fieldKey];
        const schemaField = schema
          ?.find((s) => s.section_id === update.section)
          ?.fields.find((f) => f.key === fieldKey);

        const label = fieldUpdate.label ?? existingField?.label ?? schemaField?.label ?? fieldKey;

        sectionData.fields[fieldKey] = {
          value: fieldUpdate.value,
          label,
          confidence: defaultConfidence,
          source,
          isSchema,
          updatedAt: now
        };
      }

      await this.upsertNode({
        id: nodeId,
        type: 'PROFILE_SECTION',
        data: sectionData as unknown as Record<string, any>,
        confidence: 1.0
      });

      await this.connectNodes(`user::${userId}`, nodeId, 'HAS_PROFILE_SECTION');
    }
  }

  async compileProfileMarkdown(
    schema?: ProfileSchemaSection[],
    options?: { includeUnscopedSections?: boolean }
  ): Promise<string> {
    const sectionNodes = await this.getProfile();
    const validSchema = Array.isArray(schema) && schema.length > 0 ? schema : undefined;
    const includeUnscopedSections = options?.includeUnscopedSections ?? true;

    if (sectionNodes.length === 0 && !validSchema) return '';

    const sectionMap = new Map<string, ProfileSectionData>();
    for (const node of sectionNodes) {
      const sectionId = node.id.split('::').pop()!;
      sectionMap.set(sectionId, node.data as ProfileSectionData);
    }

    const orderedSections: Array<{ sectionId: string; data: ProfileSectionData }> = [];

    if (validSchema) {
      for (const schemaSection of validSchema) {
        const existing = sectionMap.get(schemaSection.section_id);
        orderedSections.push({
          sectionId: schemaSection.section_id,
          data: existing ?? {
            label: schemaSection.label,
            icon: schemaSection.icon,
            order: schemaSection.order,
            fields: {}
          }
        });
        sectionMap.delete(schemaSection.section_id);
      }
    }

    if (includeUnscopedSections) {
      for (const [sectionId, data] of sectionMap) {
        orderedSections.push({ sectionId, data });
      }
    }

    orderedSections.sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));

    const lines: string[] = [];

    for (const { sectionId, data } of orderedSections) {
      lines.push(`## ${data.label || sectionId}`);

      const dataFields = data.fields ?? {};

      const schemaSection = validSchema?.find((s) => s.section_id === sectionId);
      const schemaFieldKeysSet = new Set(schemaSection?.fields.map((f) => f.key) ?? []);

      if (schemaSection) {
        for (const schemaField of schemaSection.fields) {
          const field = dataFields[schemaField.key];
          if (field) {
            lines.push(`- **${field.label || schemaField.label}**: ${String(field.value ?? '')}`);
          } else {
            lines.push(`- **${schemaField.label}**: _Not yet collected_`);
          }
        }
      }

      for (const [key, field] of Object.entries(dataFields)) {
        if (schemaFieldKeysSet.has(key)) continue;
        const label = field.label || key;
        lines.push(`- **${label}**: ${String(field.value ?? '')}`);
      }

      lines.push('');
    }

    return lines.join('\n').trim();
  }
}
