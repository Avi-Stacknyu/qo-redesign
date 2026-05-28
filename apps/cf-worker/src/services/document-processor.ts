/**
 * Document Processing Pipeline
 *
 * Single-pass background processor that replaces the Cloudflare Workflow.
 * Runs via waitUntil() so the upload response returns instantly.
 *
 * Pipeline:
 * 1. Convert to Markdown (AI.toMarkdown for binary, direct read for text)
 * 2. Chunk with chunkdown (markdown-aware)
 * 3. Contextualize chunks (batched AI inference)
 * 4. Embed chunks + index in Vectorize & FTS
 * 5. Extract document structure (AI structured output)
 * 6. Update knowledge graph + embed summary
 * 7. Update DB record + record costs
 *
 * Single DB client, single config load — no per-step serialization overhead.
 */

import { chunkdown as createChunkdown } from 'chunkdown';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { MemoryGraphService } from '../graph/memory-graph-service';
import {
	Env,
	DocumentExtractionResult,
	GraphNode,
	GraphEdge,
	SYSTEM_KNOWLEDGE_USER_ID
} from '../types';
import {
	trackEmbedding,
	trackInference,
	trackToMarkdown,
	loadInfraConfigs,
	recordCostEventsFromArray,
	createCostTracker,
	getPricingForModel,
	getCreditsPerUsd,
	type TrackedAIOptions
} from '../utils/billing';
import { trackInferenceCost } from '../utils/cost-tracker';
import { loadPrompts, getPromptWithFallback, DOCUMENT_EXTRACTION_SYSTEM } from '../utils/prompts';
import {
	getModelConfig,
	getModelFromConfig,
	getConfigPricing,
	getModel
} from '../utils/model-factory';
import { getDb } from '../lib/db';
import type { Database } from '@repo/db/types';
import { userUploads, aiSystemUploads } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger, formatError } from '../utils/logger';
import { AppError } from '../utils/errors';

// ============================================================================
// Types
// ============================================================================

export interface DocumentProcessingParams {
	fileKey: string;
	fileId: string;
	userId: string;
	fileName: string;
	fileType: string;
	scope: 'user' | 'system';
	/** For continuation runs: skip to this chunk offset and only contextualize + embed. */
	chunkOffset?: number;
}

export interface DocumentProcessingResult {
	success: boolean;
	fileId: string;
	docType: string;
	chunksIndexed: number;
	factsExtracted: number;
	entitiesExtracted: number;
}

type ContextualizedChunk = {
	text: string;
	context: string;
	heading: string;
	index: number;
};

// ============================================================================
// Schemas
// ============================================================================

const confidenceSchema = z.preprocess((val) => {
	if (typeof val === 'string') {
		const num = Number.parseFloat(val);
		return Number.isFinite(num) ? num : val;
	}
	return val;
}, z.number().finite());

const documentExtractionResultSchema = z.object({
	docType: z.string().min(1),
	summary: z.string().min(1),
	entities: z
		.array(
			z.object({
				name: z.string().min(1),
				type: z.string().min(1),
				properties: z.record(z.string(), z.any()).optional()
			})
		)
		.default([]),
	facts: z
		.array(
			z.object({
				text: z.string().min(1),
				category: z.string().min(1),
				confidence: confidenceSchema.transform((n) => {
					if (!Number.isFinite(n)) return 0.5;
					if (n > 1 && n <= 100) return n / 100;
					return Math.max(0, Math.min(1, n));
				})
			})
		)
		.default([])
});

// ============================================================================
// Helpers
// ============================================================================

import { hashString } from '../utils/hash';

const log = createLogger('DocumentProcessor');

// ============================================================================
// Main pipeline
// ============================================================================

/** Process a document end-to-end. Call via waitUntil() for background execution. */
export async function processDocument(
	env: Env,
	params: DocumentProcessingParams
): Promise<DocumentProcessingResult> {
	const { fileKey, fileId, userId, fileName, fileType, scope, chunkOffset } = params;
	const isContinuation = typeof chunkOffset === 'number' && chunkOffset > 0;
	const messageId = `doc::${fileId}`;
	const graphUserId = scope === 'system' ? SYSTEM_KNOWLEDGE_USER_ID : userId;

	// Single DB client + config load for the entire pipeline
	const db = await getDb(env);
	await loadInfraConfigs(db);
	await loadPrompts(db);
	const creditsPerUsd = await getCreditsPerUsd(db);
	const costTracker = createCostTracker();

	const trackingOptions: TrackedAIOptions = {
		db,
		userId,
		costTracker,
		creditsPerUsd,
		messageId,
		purpose: 'document_processing'
	};

	try {
		// ── 1. Convert to Markdown ──────────────────────────────────────────
		// Continuations re-read from R2 (1 subrequest) — markdown is not cached.
		const markdownContent = await convertToMarkdown(env, params, trackingOptions);

		// ── 2. Chunk ────────────────────────────────────────────────────────
		const allChunks = chunkMarkdown(markdownContent);
		const rawChunks = isContinuation ? allChunks.slice(chunkOffset) : allChunks;

		log.info('pipeline_chunks', {
			fileId,
			chunkCount: rawChunks.length,
			totalChunks: allChunks.length,
			chunkOffset: chunkOffset ?? 0,
			isContinuation,
			fileName
		});

		if (rawChunks.length === 0) {
			log.info('pipeline_skip_empty', { fileId, chunkOffset });
			return {
				success: true,
				fileId,
				docType: 'Unknown',
				chunksIndexed: 0,
				factsExtracted: 0,
				entitiesExtracted: 0
			};
		}

		// ── 2b. Subrequest budget guard ───────────────────────────────────
		// Cloudflare Workers hard limit: 50 subrequests per invocation.
		// First run overhead ≈ 13 (DB config/prompts/credits, R2, extract, embed×2, vectorize×2, graph, DB update, costs).
		// Continuation overhead ≈ 8 (DB config/prompts/credits, R2, embed, vectorize, FTS, DB update, costs).
		const CHUNKS_PER_PROMPT = 10;
		const overhead = isContinuation ? 8 : 13;
		const maxSafeChunks = (50 - overhead) * CHUNKS_PER_PROMPT;
		let chunksToProcess = rawChunks;

		if (rawChunks.length > maxSafeChunks) {
			const nextOffset = (chunkOffset ?? 0) + maxSafeChunks;
			log.info('chunk_overflow_enqueue', {
				fileId,
				totalChunks: allChunks.length,
				processingNow: maxSafeChunks,
				nextOffset
			});

			// Enqueue continuation for the overflow chunks
			await env.DOC_PROCESSING_QUEUE.send({
				...params,
				chunkOffset: nextOffset
			});

			chunksToProcess = rawChunks.slice(0, maxSafeChunks);
		}

		// ── 3. Contextualize chunks (batched AI calls) ──────────────────────
		const isTextNative = ['text/plain', 'text/markdown', 'text/csv'].includes(fileType);
		const contextualizedChunks = isTextNative
			? chunksToProcess.map((chunk) => ({
					text: chunk.text,
					context: chunk.heading || 'Document section',
					heading: chunk.heading,
					index: chunk.index
				}))
			: await contextualizeChunks(env, db, chunksToProcess, trackingOptions);

		// ── 4. Embed + Index (Vectorize & FTS in parallel) ──────────────────
		const chunkVectorIds = await embedAndIndex(
			env,
			contextualizedChunks,
			{ fileId, fileKey, fileName, scope, graphUserId },
			trackingOptions
		);

		let extraction: DocumentExtractionResult;
		let graphNodeIds: string[] = [];
		let docSummaryVectorId: string | undefined;

		if (isContinuation) {
			// Continuations skip extraction + graph — those ran in the first pass
			extraction = {
				docType: 'Unknown',
				summary: '',
				entities: [],
				facts: []
			} as DocumentExtractionResult;
		} else {
			// ── 5. Extract document structure ──────────────────────────────────
			extraction = await extractStructure(
				env,
				db,
				markdownContent,
				fileName,
				creditsPerUsd,
				costTracker
			);

			// ── 6. Update graph + embed summary (parallel) ────────────────────
			[graphNodeIds, docSummaryVectorId] = await Promise.all([
				updateGraph(
					env,
					{ fileId, fileKey, fileType, fileName, userId, graphUserId, scope },
					extraction
				),
				embedDocSummary(env, { fileId, graphUserId, scope }, extraction, trackingOptions)
			]);
		}

		const vectorIds = [...chunkVectorIds, ...(docSummaryVectorId ? [docSummaryVectorId] : [])];

		// ── 7. Update record + record costs (parallel) ────────────────────
		// Continuations append vectors to existing record.
		const table = scope === 'system' ? aiSystemUploads : userUploads;
		if (isContinuation) {
			const [existing] = await db
				.select({ vectors: table.vectors, meta: table.meta })
				.from(table)
				.where(eq(table.id, fileId))
				.limit(1);
			const existingVectors = (existing?.vectors as string[]) ?? [];
			const existingMeta = (existing?.meta as Record<string, unknown>) ?? {};
			const mergedVectors = [...existingVectors, ...vectorIds];
			const existingChunks = (existingMeta.chunksCount as number) ?? 0;
			await Promise.all([
				db
					.update(table)
					.set({
						vectors: mergedVectors,
						meta: {
							...existingMeta,
							chunksCount: existingChunks + contextualizedChunks.length,
							lastContinuationAt: new Date().toISOString()
						},
						updated: new Date().toISOString()
					})
					.where(eq(table.id, fileId)),
				recordCostEventsFromArray(db, costTracker.events, { userId, messageId })
			]);
		} else {
			await Promise.all([
				db
					.update(table)
					.set({
						vectors: vectorIds,
						meta: {
							graphNodeIds,
							factsCount: extraction.facts.length,
							entitiesCount: extraction.entities.length,
							chunksCount: contextualizedChunks.length,
							totalChunks: allChunks.length,
							processedAt: new Date().toISOString()
						},
						updated: new Date().toISOString()
					})
					.where(eq(table.id, fileId)),
				recordCostEventsFromArray(db, costTracker.events, { userId, messageId })
			]);
		}

		log.info('pipeline_complete', {
			fileId,
			chunks: contextualizedChunks.length,
			isContinuation,
			chunkOffset: chunkOffset ?? 0,
			facts: extraction.facts.length,
			entities: extraction.entities.length,
			costUsd: costTracker.totalCostUsd
		});

		return {
			success: true,
			fileId,
			docType: extraction.docType,
			chunksIndexed: contextualizedChunks.length,
			factsExtracted: extraction.facts.length,
			entitiesExtracted: extraction.entities.length
		};
	} catch (e) {
		log.error('pipeline_failed', { fileId, ...formatError(e) });

		// Mark the file as failed so polling can detect it and stop
		try {
			const table = scope === 'system' ? aiSystemUploads : userUploads;
			await db
				.update(table)
				.set({
					meta: {
						processingError: e instanceof Error ? e.message : 'Unknown error',
						failedAt: new Date().toISOString()
					},
					updated: new Date().toISOString()
				})
				.where(eq(table.id, fileId));
		} catch (updateErr) {
			log.error('failed_to_mark_error', { fileId, ...formatError(updateErr) });
		}

		throw e;
	}
}

// ============================================================================
// Pipeline stages
// ============================================================================

async function convertToMarkdown(
	env: Env,
	params: DocumentProcessingParams,
	trackingOptions: TrackedAIOptions
): Promise<string> {
	const { fileKey, fileName, fileType } = params;

	const obj = await env.DOCUMENTS_BUCKET.get(fileKey);
	if (!obj) {
		throw new AppError(`File not found in R2: ${fileKey}`, {
			code: 'DOC_NOT_FOUND',
			statusCode: 404
		});
	}

	const bytes = await obj.arrayBuffer();
	const blob = new Blob([bytes], { type: fileType });

	// Direct text types — no AI needed
	if (
		fileType === 'text/plain' ||
		fileType === 'text/markdown' ||
		fileType === 'text/csv' ||
		fileType === 'text/html'
	) {
		return blob.text();
	}

	// Binary types — use AI.toMarkdown
	const opts = { ...trackingOptions, purpose: 'document_conversion' };
	const { results } = await trackToMarkdown(env, [{ name: fileName, blob }], opts);
	return results[0]?.content || '';
}

function chunkMarkdown(markdown: string): Array<{ text: string; heading: string; index: number }> {
	const chunker = createChunkdown({
		chunkSize: 1000,
		maxOverflowRatio: 1.3,
		maxRawSize: 4000
	});

	const { chunks } = chunker.split(markdown);
	return chunks.map((chunk, index) => ({
		text: chunk.text,
		heading: chunk.breadcrumbs?.[0]?.text || '',
		index
	}));
}

/**
 * Batch chunks into single AI prompts to stay within the 50 subrequest limit.
 * 10 chunks per prompt → 42 chunks = 5 AI calls instead of 42.
 */
async function contextualizeChunks(
	env: Env,
	db: Database,
	rawChunks: Array<{ text: string; heading: string; index: number }>,
	trackingOptions: TrackedAIOptions
): Promise<ContextualizedChunk[]> {
	const results: ContextualizedChunk[] = [];
	const opts = { ...trackingOptions, purpose: 'chunk_contextualization' };

	const CHUNKS_PER_PROMPT = 10;

	for (let i = 0; i < rawChunks.length; i += CHUNKS_PER_PROMPT) {
		const batch = rawChunks.slice(i, i + CHUNKS_PER_PROMPT);

		// Build a single prompt with all chunks delimited by number
		const chunksBlock = batch
			.map((chunk, j) => {
				const header = chunk.heading ? `[Section: ${chunk.heading}]\n` : '';
				return `--- Chunk ${j + 1} ---\n${header}${chunk.text}`;
			})
			.join('\n\n');

		const batchPrompt = await getPromptWithFallback(db, 'batch_chunk_contextualization', {
			chunks: chunksBlock
		});

		const { response } = await trackInference(
			env,
			[{ role: 'user', content: batchPrompt }],
			{ ...opts, maxOutputTokens: 50 * batch.length },
			'extraction_model'
		);

		// Parse numbered responses back to individual chunks
		const descriptions = parseBatchResponse(response, batch.length);

		for (let j = 0; j < batch.length; j++) {
			results.push({
				text: batch[j].text,
				context: descriptions[j] || 'Document section',
				heading: batch[j].heading,
				index: batch[j].index
			});
		}
	}

	return results;
}

/** Parse "1. desc\n2. desc" response into an array of descriptions. */
function parseBatchResponse(response: string, expectedCount: number): string[] {
	const lines = response.split('\n').filter((l) => l.trim());
	const descriptions: string[] = [];

	for (const line of lines) {
		// Match lines starting with a number + dot/paren, e.g. "1. ...", "1) ..."
		const match = line.match(/^\d+[.):]\s*(.+)/);
		if (match) {
			descriptions.push(match[1].trim());
		}
	}

	// If parsing got fewer results than expected, pad with fallback
	while (descriptions.length < expectedCount) {
		descriptions.push('Document section');
	}

	return descriptions;
}

async function embedAndIndex(
	env: Env,
	chunks: ContextualizedChunk[],
	meta: {
		fileId: string;
		fileKey: string;
		fileName: string;
		scope: 'user' | 'system';
		graphUserId: string;
	},
	trackingOptions: TrackedAIOptions
): Promise<string[]> {
	const opts = { ...trackingOptions, purpose: 'document_embedding' };

	// Build text-to-embed with heading + context prefix
	const textsToEmbed = chunks.map(
		(chunk) => `${chunk.heading ? `# ${chunk.heading}\n` : ''}${chunk.context}\n\n${chunk.text}`
	);

	const { embeddings } = await trackEmbedding(env, textsToEmbed, opts, 'embedding_model');

	const ids: string[] = [];
	const vectors = chunks.map((chunk, i) => {
		const id = `${meta.fileId}::chunk::${chunk.index}`;
		ids.push(id);
		return {
			id,
			values: embeddings[i],
			metadata: {
				userId: meta.graphUserId,
				fileId: meta.fileId,
				fileKey: meta.fileKey,
				fileName: meta.fileName,
				scope: meta.scope,
				chunkIndex: String(chunk.index),
				heading: chunk.heading,
				context: chunk.context,
				text: chunk.text.slice(0, 500)
			}
		};
	});

	// Vectorize + FTS index in parallel
	const graph = new MemoryGraphService(await getDb(env), meta.graphUserId);

	const ftsChunks = chunks.map((chunk) => ({
		id: `${meta.fileId}::chunk::${chunk.index}`,
		fileKey: meta.fileKey,
		chunkIndex: chunk.index,
		text: chunk.text,
		context: chunk.context
	}));

	await Promise.all([
		vectors.length > 0 ? env.DOCUMENT_CHUNKS.upsert(vectors) : Promise.resolve(),
		graph.batchUpsertChunks(ftsChunks)
	]);

	return ids;
}

async function extractStructure(
	env: Env,
	db: Database,
	markdownContent: string,
	fileName: string,
	creditsPerUsd: number,
	costTracker: import('../types/flow').FlowCostTracker
): Promise<DocumentExtractionResult> {
	const sampleText = markdownContent.slice(0, 4000);
	const extractionPrompt = await getPromptWithFallback(db, 'document_extraction', {
		sample_text: sampleText
	});

	const config = await getModelConfig(db, 'extraction_model');
	const modelId = config.model_id;

	try {
		const model = getModelFromConfig(config, env);
		const { output, usage } = await generateText({
			model,
			output: Output.object({ schema: documentExtractionResultSchema }),
			system: DOCUMENT_EXTRACTION_SYSTEM,
			prompt: extractionPrompt,
			timeout: 60_000
		});

		const pricing = getConfigPricing(config) ?? (await getPricingForModel(db, modelId));

		await trackInferenceCost({
			db,
			modelConfig: config,
			usage,
			purpose: 'document_structure_extraction',
			pricing,
			creditsPerUsd,
			costTracker
		});

		return output!;
	} catch (e) {
		log.warn('ai_extraction_fallback', { ...formatError(e) });
		return {
			docType: 'Unknown',
			summary: `Document: ${fileName}`,
			entities: [],
			facts: []
		} as DocumentExtractionResult;
	}
}

async function updateGraph(
	env: Env,
	meta: {
		fileId: string;
		fileKey: string;
		fileType: string;
		fileName: string;
		userId: string;
		graphUserId: string;
		scope: string;
	},
	extraction: DocumentExtractionResult
): Promise<string[]> {
	const graph = new MemoryGraphService(await getDb(env), meta.graphUserId);

	const now = new Date().toISOString();
	const docNodeId = `doc::${meta.fileId}`;
	const userNodeId = `user::${meta.graphUserId}`;

	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const nodeIds: string[] = [];

	nodes.push({
		id: userNodeId,
		type: 'USER',
		data: { userId: meta.userId },
		createdAt: now
	});

	nodes.push({
		id: docNodeId,
		type: 'DOCUMENT',
		data: {
			fileName: meta.fileName,
			fileId: meta.fileId,
			fileKey: meta.fileKey,
			fileType: meta.fileType,
			docType: extraction.docType,
			summary: extraction.summary,
			uploadedAt: now,
			share_with_manager: true,
			share_with_agent: true
		},
		createdAt: now
	});
	nodeIds.push(docNodeId);

	edges.push({
		source: userNodeId,
		target: docNodeId,
		relationship: 'UPLOADED',
		createdAt: now
	});

	for (const fact of extraction.facts) {
		const factId = `fact::doc::${docNodeId}::${hashString(fact.text).slice(0, 16)}`;
		nodeIds.push(factId);

		nodes.push({
			id: factId,
			type: 'FACT',
			data: {
				text: fact.text,
				category: fact.category,
				source: docNodeId,
				isDocumentFact: true,
				share_with_manager: true,
				share_with_agent: true
			},
			confidence: fact.confidence,
			createdAt: now
		});

		edges.push({
			source: docNodeId,
			target: factId,
			relationship: 'REVEALS',
			createdAt: now
		});
	}

	for (const entity of extraction.entities) {
		const entityId = `entity::doc::${entity.type}::${entity.name.toLowerCase().replace(/\s+/g, '_')}`;
		nodeIds.push(entityId);

		nodes.push({
			id: entityId,
			type: 'ENTITY',
			data: {
				name: entity.name,
				entityType: entity.type,
				...entity.properties,
				source: docNodeId,
				isDocumentEntity: true,
				share_with_manager: true,
				share_with_agent: true
			},
			createdAt: now
		});

		edges.push({
			source: docNodeId,
			target: entityId,
			relationship: 'CONTAINS',
			createdAt: now
		});
	}

	await graph.batchUpsert(nodes, edges);
	return nodeIds;
}

async function embedDocSummary(
	env: Env,
	meta: { fileId: string; graphUserId: string; scope: string },
	extraction: DocumentExtractionResult,
	trackingOptions: TrackedAIOptions
): Promise<string> {
	const docNodeId = `doc::${meta.fileId}`;
	const summaryText = `${extraction.docType}: ${extraction.summary}`;
	const opts = { ...trackingOptions, purpose: 'document_graph_embedding' };

	const { embeddings } = await trackEmbedding(env, [summaryText], opts, 'embedding_model');

	await env.GRAPH_NODES.upsert([
		{
			id: docNodeId,
			values: embeddings[0],
			metadata: {
				userId: meta.graphUserId,
				fileId: meta.fileId,
				type: 'DOCUMENT',
				text: summaryText,
				scope: meta.scope
			}
		}
	]);

	return docNodeId;
}
