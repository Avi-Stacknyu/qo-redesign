/**
 * RAG Service - Advanced Retrieval-Augmented Generation
 *
 * Implements Boris Tane's Contextual RAG patterns:
 * - Query Rewriting: Expand queries for better recall
 * - Hybrid Search: Vector + FTS with Reciprocal Rank Fusion (RRF)
 * - AI Reranking: Cross-encoder for precision
 * - Graph Context: User facts, intents, sessions from knowledge graph
 *
 * Per-agent configuration allows admins to enable/disable:
 * - Query rewriting
 * - Hybrid search (vs vector-only)
 * - AI reranking
 * - Graph context injection
 *
 * SYSTEM KNOWLEDGE:
 * - System uploads are stored in __SYSTEM_KNOWLEDGE__ namespace
 * - RAG searches BOTH user's documents AND system knowledge
 * - Results are merged and ranked together
 */

import type { Database } from '@repo/db/types';
import type { Env, UserContext, GraphNode, SearchResult } from '../types';
import { SYSTEM_KNOWLEDGE_USER_ID } from '../types';
import { MemoryGraphService } from '../graph/memory-graph-service';
import {
	getModelConfig,
	getModelFromConfig,
	getEmbeddingModelFromConfig,
	getConfigPricing,
	rerankDocuments,
	type InfraModelConfig
} from '../utils/model-factory';
import { generateText, embedMany } from 'ai';
import { buildUserContext, fetchFileSummariesFromGraph } from '../utils/context-builder';
import { interpolatePrompt, QUERY_REWRITE } from '../utils/prompts';
import type { FlowCostTracker } from '../types/flow';
import { createLogger, formatError } from '../utils/logger';
import { getCreditsPerUsd } from '../utils/billing';
import { trackInferenceCost } from '../utils/cost-tracker';

// ============================================================================
// Types
// ============================================================================

export interface RAGConfig {
	// Feature toggles (per-agent customizable)
	enableQueryRewriting: boolean;
	enableHybridSearch: boolean; // If false, vector-only
	enableReranking: boolean;
	enableGraphContext: boolean;

	// Search parameters
	vectorTopK: number; // How many results from vector search
	ftsTopK: number; // How many results from FTS
	rerankTopK: number; // Final number after reranking
	rerankThreshold: number; // Minimum normalized score (0-1)

	// RRF parameter
	rrfK: number; // k constant in RRF formula (default: 60)

	// Query rewriting
	maxQueryVariations: number; // How many alternative queries
}

export const DEFAULT_RAG_CONFIG: RAGConfig = {
	enableQueryRewriting: true,
	enableHybridSearch: true,
	enableReranking: true,
	enableGraphContext: true,
	vectorTopK: 10,
	ftsTopK: 10,
	rerankTopK: 5,
	rerankThreshold: 0.3,
	rrfK: 60,
	maxQueryVariations: 3
};

export interface RAGContext {
	db: Database;
	env: Env;
	userId: string;
	config: RAGConfig;
	costTracker?: FlowCostTracker;
	// Chat-specific context for scoped search
	chatId?: string;
	attachedFileIds?: string[]; // File IDs attached to current chat (user_uploads)
	// Agent knowledge base file IDs (from ai_system_uploads, defined in flow's start node)
	agentKnowledgeFileIds?: string[];
}

export interface BuiltContext {
	userContext: UserContext | null;
	relevantDocs: SearchResult[];
	relevantKnowledge: SearchResult[];
	// Summaries of attached files (injected directly into context)
	attachedFileSummaries: Array<{ fileId: string; fileName: string; summary: string }>;
}

// Graph methods are provided by MemoryGraphService directly

// ============================================================================
// RAG Service Class
// ============================================================================

export class RAGService {
	private ctx: RAGContext;

	constructor(ctx: RAGContext) {
		this.ctx = ctx;
	}

	/**
	 * Get graph service for user's personal graph
	 */
	private getGraphService(): MemoryGraphService {
		return new MemoryGraphService(this.ctx.db, this.ctx.userId);
	}

	/**
	 * Get graph service for system knowledge graph (shared across all users)
	 */
	private getSystemGraphService(): MemoryGraphService {
		return new MemoryGraphService(this.ctx.db, SYSTEM_KNOWLEDGE_USER_ID);
	}

	/**
	 * Generate embeddings using model-factory + AI SDK
	 */
	private async generateEmbeddings(
		texts: string[],
		configKey = 'embedding_model'
	): Promise<{
		embeddings: number[][];
		modelId: string;
		config: InfraModelConfig;
		usage?: { tokens: number };
	}> {
		const config = await getModelConfig(this.ctx.db, configKey);
		const model = getEmbeddingModelFromConfig(config, this.ctx.env);
		const result = await embedMany({ model, values: texts });
		return {
			embeddings: result.embeddings,
			modelId: config.model_id,
			config,
			usage:
				(result.usage as any)?.tokens != null ? { tokens: (result.usage as any).tokens } : undefined
		};
	}

	// ============================================================================
	// Query Rewriting
	// ============================================================================

	/**
	 * Expand user query into multiple semantic variations
	 * Improves recall by searching for different phrasings
	 */
	async rewriteQuery(userQuery: string): Promise<string[]> {
		if (!this.ctx.config.enableQueryRewriting) {
			return [userQuery];
		}

		const prompt = interpolatePrompt(QUERY_REWRITE, {
			maxVariations: String(this.ctx.config.maxQueryVariations),
			userQuery: userQuery
		});

		try {
			const config = await getModelConfig(this.ctx.db, 'llm_model');
			const model = getModelFromConfig(config, this.ctx.env);
			const result = await generateText({
				model,
				prompt,
				maxOutputTokens: 150,
				timeout: 15_000
			});

			const variations = result.text
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 5 && line.length < 200)
				.slice(0, this.ctx.config.maxQueryVariations);

			// Track cost
			if (this.ctx.costTracker) {
				await trackInferenceCost({
					db: this.ctx.db,
					modelConfig: config,
					usage: result.usage,
					purpose: 'query_rewriting',
					costTracker: this.ctx.costTracker
				});
			}

			// Always include original query first
			return [userQuery, ...variations];
		} catch (e) {
			const log = createLogger('RAGService', { userId: this.ctx.userId });
			log.error('query_rewrite_failed', { ...formatError(e) });
			return [userQuery];
		}
	}

	// ============================================================================
	// Reciprocal Rank Fusion
	// ============================================================================

	/**
	 * Merge results from different ranking systems using RRF
	 * Score = Σ 1/(k + rank) for each ranking system
	 */
	private reciprocalRankFusion(
		vectorResults: Map<string, { rank: number; data: SearchResult }>,
		ftsResults: Map<string, { rank: number; data: SearchResult }>
	): SearchResult[] {
		const k = this.ctx.config.rrfK;
		const combined = new Map<string, { score: number; data: SearchResult }>();

		// Add vector scores
		for (const [id, { rank, data }] of vectorResults) {
			const existing = combined.get(id);
			const rrfScore = 1 / (k + rank);
			if (existing) {
				existing.score += rrfScore;
				existing.data.source = 'hybrid';
			} else {
				combined.set(id, { score: rrfScore, data: { ...data, rrfScore } });
			}
		}

		// Add FTS scores
		for (const [id, { rank, data }] of ftsResults) {
			const existing = combined.get(id);
			const rrfScore = 1 / (k + rank);
			if (existing) {
				existing.score += rrfScore;
				existing.data.source = 'hybrid';
				existing.data.rrfScore = existing.score;
			} else {
				combined.set(id, { score: rrfScore, data: { ...data, rrfScore, source: 'fts' } });
			}
		}

		// Sort by combined RRF score
		return Array.from(combined.values())
			.sort((a, b) => b.score - a.score)
			.map(({ score, data }) => ({ ...data, rrfScore: score }));
	}

	// ============================================================================
	// AI Reranking
	// ============================================================================

	/**
	 * Sigmoid normalization: Transform unbounded scores to (0,1) range
	 */
	private sigmoid(x: number): number {
		return 1 / (1 + Math.exp(-x));
	}

	/**
	 * AI Reranking using cross-encoder model
	 * Precision-focused step after recall-focused retrieval
	 */
	async rerank(query: string, candidates: SearchResult[]): Promise<SearchResult[]> {
		const topK = this.ctx.config.rerankTopK;

		if (candidates.length === 0) return [];

		// If reranking disabled or not enough candidates, return as-is with normalized scores
		if (!this.ctx.config.enableReranking || candidates.length <= topK) {
			return candidates.slice(0, topK).map((c, idx) => ({
				...c,
				rerankerScore: 1 - idx * 0.1,
				normalizedScore: this.sigmoid(1 - idx * 0.1)
			}));
		}

		try {
			// Prepare contexts for reranker
			const contexts = candidates.map((c) => ({
				text: c.context ? `${c.context}\n\n${c.text}` : c.text
			}));

			// Use configurable reranker
			const result = await rerankDocuments(
				this.ctx.env,
				this.ctx.db,
				query,
				contexts,
				Math.min(topK * 2, candidates.length),
				'reranking_model'
			);

			// Track cost
			if (this.ctx.costTracker) {
				const pricing = getConfigPricing(result.config);
				// Estimate tokens: query + all candidate texts
				const allText = query + ' ' + contexts.map((c) => c.text).join(' ');
				const estimatedTokens = Math.ceil(allText.length / 4);
				const inputPricePerMillion = pricing?.input_price_per_1m ?? 0;
				const costUsd =
					pricing?.price_per_call && pricing.price_per_call > 0
						? pricing.price_per_call
						: (estimatedTokens / 1_000_000) * inputPricePerMillion;
				const creditsPerUsd = await getCreditsPerUsd(this.ctx.db);
				const credits = costUsd * creditsPerUsd;

				this.ctx.costTracker.addEvent({
					operation: 'reranking',
					modelId: result.modelId,
					tokens: { input: estimatedTokens, output: 0 },
					costUsd,
					credits,
					pricingRateId: pricing?.id,
					metadata: {
						candidates: candidates.length,
						topK,
						tokenEstimate: true,
						estimatedTokens,
						purpose: 'rag_reranking'
					}
				});
			}

			if (result.results.length === 0) {
				return candidates.slice(0, topK);
			}

			// Map scores back to candidates
			const scored = candidates.map((candidate, idx) => {
				const scoreData = result.results.find((d) => d.id === idx);
				const rerankerScore = scoreData?.score ?? 0;
				return {
					...candidate,
					rerankerScore,
					normalizedScore: this.sigmoid(rerankerScore)
				};
			});

			// Sort by reranker score and filter by threshold
			return scored
				.sort((a, b) => (b.rerankerScore || 0) - (a.rerankerScore || 0))
				.slice(0, topK)
				.filter((r) => (r.normalizedScore || 0) > this.ctx.config.rerankThreshold);
		} catch (e) {
			const log = createLogger('RAGService', { userId: this.ctx.userId });
			log.error('rerank_failed', { ...formatError(e) });
			return candidates.slice(0, topK);
		}
	}

	// ============================================================================
	// Hybrid Search - Documents
	// ============================================================================

	/**
	 * Hybrid Search: Vector + FTS with RRF fusion and AI reranking
	 * Full Contextual RAG pipeline for document search
	 *
	 * DUAL NAMESPACE: Searches BOTH user's documents AND system knowledge base
	 */
	async hybridSearchDocuments(userQuery: string): Promise<SearchResult[]> {
		// Step 1: Rewrite query for better recall
		const queryVariations = await this.rewriteQuery(userQuery);

		// Step 2: Run vector search and FTS search in parallel
		const vectorResultsMap = new Map<string, { rank: number; data: SearchResult }>();
		const ftsResultsMap = new Map<string, { rank: number; data: SearchResult }>();

		// Vector search across all query variations - search BOTH user and system namespaces
		const vectorPromises = queryVariations.map(async (query, queryIdx) => {
			try {
				const embeddingResult = await this.generateEmbeddings([query], 'embedding_model');

				// Track embedding cost for ALL query variations
				if (this.ctx.costTracker) {
					const pricing = getConfigPricing(embeddingResult.config);
					const realTokens = embeddingResult.usage?.tokens;
					const tokenCount = realTokens ?? Math.ceil(query.length / 4);
					const inputPricePerMillion = pricing?.input_price_per_1m ?? 0;
					const costUsd = (tokenCount / 1_000_000) * inputPricePerMillion;
					const creditsPerUsd = await getCreditsPerUsd(this.ctx.db);
					// Guard against NaN from missing pricing or exchange rates
					const rawCredits = costUsd * creditsPerUsd;
					const credits = Number.isFinite(rawCredits) ? rawCredits : 0;

					this.ctx.costTracker.addEvent({
						operation: 'embedding',
						modelId: embeddingResult.modelId,
						tokens: { input: tokenCount, output: 0 },
						costUsd,
						credits,
						pricingRateId: pricing?.id,
						metadata: {
							texts: 1,
							...(realTokens == null ? { tokenEstimate: true } : {}),
							purpose: 'rag_embedding',
							queryVariation: queryIdx
						}
					});
				}

				// Search user's documents
				const userResults = await this.ctx.env.DOCUMENT_CHUNKS.query(
					embeddingResult.embeddings[0],
					{
						topK: this.ctx.config.vectorTopK,
						returnMetadata: 'all',
						filter: { userId: this.ctx.userId }
					}
				);

				// Only search agent's knowledge base if specific files are referenced in the flow
				let systemMatches: Array<{
					id: string;
					score?: number;
					metadata?: Record<string, unknown>;
					source: 'system';
					originalRank: number;
				}> = [];

				if (this.ctx.agentKnowledgeFileIds && this.ctx.agentKnowledgeFileIds.length > 0) {
					// Search only the specific files referenced by this agent
					const systemResults = await this.ctx.env.DOCUMENT_CHUNKS.query(
						embeddingResult.embeddings[0],
						{
							topK: this.ctx.config.vectorTopK,
							returnMetadata: 'all',
							filter: {
								userId: SYSTEM_KNOWLEDGE_USER_ID,
								fileId: { $in: this.ctx.agentKnowledgeFileIds }
							}
						}
					);
					systemMatches = systemResults.matches.map((m, idx) => ({
						...m,
						originalRank: idx,
						source: 'system' as const
					}));
				}

				// Merge results from user and (optionally) agent's knowledge base
				const allMatches = [
					...userResults.matches.map((m, idx) => ({
						...m,
						originalRank: idx,
						source: 'user' as const
					})),
					...systemMatches
				];

				// Sort by score and process
				allMatches
					.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
					.forEach((match, idx) => {
						if (match.metadata?.text) {
							const id = match.id as string;
							const existing = vectorResultsMap.get(id);
							const newRank = idx + 1 + queryIdx * 0.1; // Slight penalty for alternative queries
							if (!existing || existing.rank > newRank) {
								vectorResultsMap.set(id, {
									rank: newRank,
									data: {
										id,
										text: match.metadata.text as string,
										context: (match.metadata.context as string) || undefined,
										vectorScore: match.score,
										source: 'vector',
										metadata: {
											...(match.metadata as Record<string, any>),
											knowledgeSource: match.source // Track if from user or system
										}
									}
								});
							}
						}
					});
			} catch (e) {
				const log = createLogger('RAGService', { userId: this.ctx.userId });
				log.error('vector_search_failed', { query, ...formatError(e) });
			}
		});

		// FTS search - only user's graph (system knowledge uses vector-only for fileId filtering)
		const ftsPromises = this.ctx.config.enableHybridSearch
			? queryVariations.slice(0, 2).map(async (query, queryIdx) => {
					try {
						// Search user's graph only
						// Note: System knowledge FTS is skipped because we can't filter by fileId in FTS
						// Vector search with fileId filter is used for system knowledge instead
						const userGraphStub = this.getGraphService();
						const userResults = await userGraphStub.ftsSearchChunks(query, this.ctx.config.ftsTopK);

						userResults.forEach((r) => {
							const existing = ftsResultsMap.get(r.id);
							const newRank = r.rank + queryIdx * 0.1;
							if (!existing || existing.rank > newRank) {
								ftsResultsMap.set(r.id, {
									rank: newRank,
									data: {
										id: r.id,
										text: r.text || '',
										context: r.context,
										ftsRank: r.rank,
										source: 'fts',
										metadata: { knowledgeSource: 'user' }
									}
								});
							}
						});
					} catch (e) {
						const log = createLogger('RAGService', { userId: this.ctx.userId });
						log.error('fts_search_failed', { ...formatError(e) });
					}
				})
			: [];

		await Promise.all([...vectorPromises, ...ftsPromises]);

		// Step 3: Reciprocal Rank Fusion (if hybrid enabled)
		const fusedResults = this.ctx.config.enableHybridSearch
			? this.reciprocalRankFusion(vectorResultsMap, ftsResultsMap)
			: Array.from(vectorResultsMap.values())
					.sort((a, b) => a.rank - b.rank)
					.map(({ data }) => data);

		// Step 4: AI Reranking (top candidates only for efficiency)
		const candidatesForReranking = fusedResults.slice(0, 15);
		return this.rerank(userQuery, candidatesForReranking);
	}

	// ============================================================================
	// Hybrid Search - Knowledge Graph
	// ============================================================================

	/**
	 * Hybrid Search on Graph Nodes (knowledge/memory search)
	 * Searches both user's personal knowledge and system knowledge base
	 */
	async hybridSearchKnowledge(userQuery: string): Promise<SearchResult[]> {
		const vectorResultsMap = new Map<string, { rank: number; data: SearchResult }>();
		const ftsResultsMap = new Map<string, { rank: number; data: SearchResult }>();

		// Vector search on graph nodes
		try {
			const embeddingResult = await this.generateEmbeddings([userQuery], 'embedding_model');

			// Search user's graph nodes
			const userResults = await this.ctx.env.GRAPH_NODES.query(embeddingResult.embeddings[0], {
				topK: this.ctx.config.vectorTopK,
				returnMetadata: 'all',
				filter: { userId: this.ctx.userId }
			});

			// Only search agent's knowledge base if specific files are referenced
			let systemMatches: Array<{
				id: string;
				score?: number;
				metadata?: Record<string, unknown>;
				knowledgeSource: 'system';
			}> = [];

			if (this.ctx.agentKnowledgeFileIds && this.ctx.agentKnowledgeFileIds.length > 0) {
				const systemResults = await this.ctx.env.GRAPH_NODES.query(embeddingResult.embeddings[0], {
					topK: this.ctx.config.vectorTopK,
					returnMetadata: 'all',
					filter: {
						userId: SYSTEM_KNOWLEDGE_USER_ID,
						fileId: { $in: this.ctx.agentKnowledgeFileIds }
					}
				});
				systemMatches = systemResults.matches.map((m) => ({
					...m,
					knowledgeSource: 'system' as const
				}));
			}

			// Merge results from user and (optionally) agent's knowledge base
			const allMatches = [
				...userResults.matches.map((m) => ({ ...m, knowledgeSource: 'user' as const })),
				...systemMatches
			];

			// Sort by score and process
			allMatches
				.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
				.slice(0, this.ctx.config.vectorTopK)
				.forEach((match, idx) => {
					if (match.metadata?.text) {
						const id = match.id as string;
						vectorResultsMap.set(id, {
							rank: idx + 1,
							data: {
								id,
								text: match.metadata.text as string,
								context: match.metadata.type as string,
								vectorScore: match.score,
								source: 'vector',
								metadata: {
									...(match.metadata as Record<string, any>),
									knowledgeSource: match.knowledgeSource
								}
							}
						});
					}
				});
		} catch (e) {
			const log = createLogger('RAGService', { userId: this.ctx.userId });
			log.error('vector_knowledge_search_failed', { ...formatError(e) });
		}

		// FTS search on graph nodes (if hybrid enabled) - user's graph only
		// Note: System knowledge uses vector-only for fileId filtering
		if (this.ctx.config.enableHybridSearch) {
			try {
				const graphStub = this.getGraphService();
				const ftsResults = await graphStub.ftsSearchNodes(userQuery, this.ctx.config.ftsTopK);

				// Fetch full node data for FTS results
				for (const r of ftsResults) {
					const node = await graphStub.getNode(r.id);
					if (node) {
						const nodeData = node.data as Record<string, any>;
						const text = nodeData.text || nodeData.summary || nodeData.name || '';
						ftsResultsMap.set(r.id, {
							rank: r.rank,
							data: {
								id: r.id,
								text,
								context: node.type,
								ftsRank: r.rank,
								source: 'fts',
								metadata: { type: node.type, knowledgeSource: 'user', ...nodeData }
							}
						});
					}
				}
			} catch (e) {
				const log = createLogger('RAGService', { userId: this.ctx.userId });
				log.error('fts_knowledge_search_failed', { ...formatError(e) });
			}
		}

		// RRF fusion
		const fusedResults = this.ctx.config.enableHybridSearch
			? this.reciprocalRankFusion(vectorResultsMap, ftsResultsMap)
			: Array.from(vectorResultsMap.values())
					.sort((a, b) => a.rank - b.rank)
					.map(({ data }) => data);

		// Rerank top candidates
		const candidatesForReranking = fusedResults.slice(0, 10);
		return this.rerank(userQuery, candidatesForReranking);
	}

	// ============================================================================
	// Graph Context
	// ============================================================================

	/**
	 * Get user context from knowledge graph
	 * @param query - When provided, uses FTS-ranked query-relevant loading
	 */
	async getGraphContext(query?: string): Promise<UserContext | null> {
		if (!this.ctx.config.enableGraphContext) {
			return null;
		}

		try {
			// Use shared context builder (single source of truth)
			const result = await buildUserContext(this.getGraphService(), {
				userId: this.ctx.userId,
				skipFileSummaries: true, // File summaries fetched separately
				query
			});
			return result.userContext;
		} catch (e) {
			const log = createLogger('RAGService', { userId: this.ctx.userId });
			log.error('graph_context_failed', { ...formatError(e) });
			return null;
		}
	}

	// ============================================================================
	// Attached File Summaries
	// ============================================================================

	/**
	 * Get summaries for files attached to current chat
	 * These are injected directly into context so agent SEES them immediately
	 * Uses direct graph lookup, with fallback to vector search for missing summaries
	 */
	private async getAttachedFileSummaries(): Promise<
		Array<{ fileId: string; fileName: string; summary: string }>
	> {
		if (!this.ctx.attachedFileIds || this.ctx.attachedFileIds.length === 0) {
			return [];
		}

		// Direct graph lookup - more efficient than full buildUserContext
		const summaries = await fetchFileSummariesFromGraph(
			this.getGraphService(),
			this.ctx.attachedFileIds
		);

		// If we got all summaries from graph, return them
		if (summaries.length === this.ctx.attachedFileIds.length) {
			return summaries;
		}

		// Find which files are missing from graph (not yet processed)
		const foundFileIds = new Set(summaries.map((s) => s.fileId));
		const missingFileIds = this.ctx.attachedFileIds.filter((id) => !foundFileIds.has(id));

		// Fallback: Get summaries via vector search for missing files
		// This handles cases where file nodes aren't in graph yet
		for (const fileId of missingFileIds) {
			try {
				const embeddingResult = await this.generateEmbeddings(
					['document content'],
					'embedding_model'
				);

				const results = await this.ctx.env.DOCUMENT_CHUNKS.query(embeddingResult.embeddings[0], {
					topK: 1,
					returnMetadata: 'all',
					filter: { userId: this.ctx.userId, fileId }
				});

				if (results.matches.length > 0) {
					const match = results.matches[0];
					summaries.push({
						fileId,
						fileName: (match.metadata?.fileName as string) || 'Unknown',
						summary: (match.metadata?.context as string) || (match.metadata?.text as string) || ''
					});
				}
			} catch (e) {
				const log = createLogger('RAGService', { userId: this.ctx.userId });
				log.error('fallback_summary_failed', { fileId, ...formatError(e) });
			}
		}

		return summaries;
	}

	// ============================================================================
	// Search Chat Attachments (Scoped Search)
	// ============================================================================

	/**
	 * Search ONLY files attached to current chat
	 * Use this when user refers to "my file", "the document I uploaded", etc.
	 */
	async searchChatAttachments(query: string, topK = 5): Promise<SearchResult[]> {
		if (!this.ctx.attachedFileIds || this.ctx.attachedFileIds.length === 0) {
			return [];
		}

		const embeddingResult = await this.generateEmbeddings([query], 'embedding_model');

		// Search only in attached files
		const results = await this.ctx.env.DOCUMENT_CHUNKS.query(embeddingResult.embeddings[0], {
			topK,
			returnMetadata: 'all',
			filter: {
				userId: this.ctx.userId,
				fileId: { $in: this.ctx.attachedFileIds }
			}
		});

		return results.matches
			.filter((m) => m.metadata?.text)
			.map((m) => ({
				id: m.id as string,
				text: m.metadata!.text as string,
				context: m.metadata!.context as string,
				vectorScore: m.score,
				source: 'vector' as const,
				metadata: m.metadata as Record<string, unknown>
			}));
	}

	// ============================================================================
	// Full Context Build
	// ============================================================================

	/**
	 * Build context for chat response generation.
	 *
	 * By default, this is "lightweight" - it only fetches user context and file summaries,
	 * skipping expensive RAG pipelines. The LLM uses search tools when needed.
	 *
	 * Set `options.fullSearch = true` to run the full RAG pipeline (query rewriting,
	 * vector search, FTS, reranking) - takes 15-30s but provides upfront context.
	 *
	 * @param userMessage - The user's message (only used if fullSearch is true)
	 * @param options - Configuration options
	 */
	async buildContext(
		userMessage?: string,
		options?: {
			fullSearch?: boolean;
			cachedUserContext?: UserContext | null;
			cachedFileSummaries?: Array<{ fileId: string; fileName: string; summary: string }>;
			/** When provided, uses FTS-ranked query-relevant loading for temporal nodes */
			query?: string;
		}
	): Promise<BuiltContext> {
		// 1. Get user context (from cache or graph)
		const userContext =
			options?.cachedUserContext !== undefined
				? options.cachedUserContext
				: await this.getGraphContext(options?.query);

		// 2. Get attached file summaries (from cache or fetch)
		const attachedFileSummaries =
			options?.cachedFileSummaries !== undefined
				? options.cachedFileSummaries
				: await this.getAttachedFileSummaries();

		// 3. If fullSearch, run RAG pipeline
		if (options?.fullSearch && userMessage) {
			const relevantDocs = await this.hybridSearchDocuments(userMessage);
			const relevantKnowledge = await this.hybridSearchKnowledge(userMessage);
			return { userContext, relevantDocs, relevantKnowledge, attachedFileSummaries };
		}

		// Lightweight: no document/knowledge search - LLM uses tools when needed
		return {
			userContext,
			attachedFileSummaries,
			relevantDocs: [],
			relevantKnowledge: []
		};
	}

	// ============================================================================
	// Simple Search (for tools)
	// ============================================================================

	/**
	 * Helper to search both user and system (agent) knowledge bases
	 */
	private async searchWithSystemKnowledge(
		query: string,
		index: VectorizeIndex,
		topK: number,
		formatFn: (match: any, source: string) => string
	): Promise<string[]> {
		const embeddingResult = await this.generateEmbeddings([query], 'embedding_model');

		// Search user's data
		const userResults = await index.query(embeddingResult.embeddings[0], {
			topK,
			returnMetadata: 'all',
			filter: { userId: this.ctx.userId }
		});

		// Search agent's knowledge base if configured
		let systemMatches: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> =
			[];
		if (this.ctx.agentKnowledgeFileIds?.length) {
			const systemResults = await index.query(embeddingResult.embeddings[0], {
				topK,
				returnMetadata: 'all',
				filter: {
					userId: SYSTEM_KNOWLEDGE_USER_ID,
					fileId: { $in: this.ctx.agentKnowledgeFileIds }
				}
			});
			systemMatches = systemResults.matches;
		}

		// Merge and sort by score
		const allMatches = [
			...userResults.matches.map((m) => ({ ...m, source: 'user' })),
			...systemMatches.map((m) => ({ ...m, source: 'system' }))
		]
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
			.slice(0, topK);

		return allMatches.filter((m) => m.metadata?.text).map((m) => formatFn(m, m.source));
	}

	/**
	 * Simple document search (for tool calls)
	 */
	async searchDocuments(query: string, topK = 5): Promise<string[]> {
		return this.searchWithSystemKnowledge(
			query,
			this.ctx.env.DOCUMENT_CHUNKS,
			topK,
			(m, source) =>
				`[${m.metadata.context || 'Document'}${source === 'system' ? ' (System KB)' : ''}]\n${m.metadata.text}`
		);
	}

	/**
	 * Simple knowledge search (for tool calls)
	 */
	async searchKnowledge(query: string, topK = 5): Promise<string[]> {
		return this.searchWithSystemKnowledge(
			query,
			this.ctx.env.GRAPH_NODES,
			topK,
			(m, source) =>
				`[${m.metadata.type}${source === 'system' ? ' (System KB)' : ''}] ${m.metadata.text}`
		);
	}
}

// ============================================================================
// Factory Function
// ============================================================================

export async function createRAGService(
	db: Database,
	env: Env,
	userId: string,
	config?: Partial<RAGConfig>,
	costTracker?: FlowCostTracker,
	options?: {
		chatId?: string;
		attachedFileIds?: string[]; // User's attached files
		agentKnowledgeFileIds?: string[]; // Agent's knowledge base files from flow
	}
): Promise<RAGService> {
	// Merge config with defaults
	const fullConfig: RAGConfig = {
		...DEFAULT_RAG_CONFIG,
		...config
	};

	return new RAGService({
		db,
		env,
		userId,
		config: fullConfig,
		costTracker,
		chatId: options?.chatId,
		attachedFileIds: options?.attachedFileIds,
		agentKnowledgeFileIds: options?.agentKnowledgeFileIds
	});
}
