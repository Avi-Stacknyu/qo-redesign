import { z } from 'zod';
import { tool } from 'ai';
import { userUploads } from '@repo/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { SearchResult } from '../../types';
import { trackEmbedding } from '../../utils/billing';
import { createLogger } from '../../utils/logger';
import { MemoryGraphService } from '../../graph/memory-graph-service';
import type { ToolContext } from './types';

export function createDocumentTools(ctx: ToolContext) {
	return {
		search_knowledge_base: tool({
			description:
				"Search through the user's documents and knowledge base for relevant information. Uses advanced hybrid search (vector + full-text + AI reranking) for best results.",
			inputSchema: z.object({
				query: z.string().describe('The search query (keywords, question, or topic)'),
				top_k: z
					.number()
					.min(1)
					.max(20)
					.optional()
					.default(5)
					.describe('Number of results to return (default: 5)')
			}),
			execute: async ({ query, top_k }: { query: string; top_k?: number }) => {
				// Use RAGService for proper hybrid search if available
				if (ctx.ragService) {
					const [documents, knowledge] = await Promise.all([
						ctx.ragService.hybridSearchDocuments(query),
						ctx.ragService.hybridSearchKnowledge(query)
					]);

					const allResults = [...documents, ...knowledge]
						.sort(
							(a, b) =>
								(b.normalizedScore ?? b.rrfScore ?? b.vectorScore ?? 0) -
								(a.normalizedScore ?? a.rrfScore ?? a.vectorScore ?? 0)
						)
						.slice(0, top_k ?? 5);

					if (allResults.length === 0) {
						return 'No relevant documents found for your query.';
					}

					const formattedResults = allResults.map((result, i) => {
						const score = (
							(result.normalizedScore ?? result.rrfScore ?? result.vectorScore ?? 0) * 100
						).toFixed(1);
						const source = result.metadata?.filename || result.source || 'knowledge';
						return `[${i + 1}] From: ${source} (${score}% relevance)\n${result.context || ''}\n${result.text}`;
					});

					return `Found ${allResults.length} relevant result(s):\n\n${formattedResults.join('\n\n---\n\n')}`;
				}

				// Fallback to basic vector search if no RAG service
				const { embeddings } = await trackEmbedding(
					ctx.env,
					[query],
					{
						db: ctx.db,
						userId: ctx.userId,
						costTracker: ctx.costTracker,
						messageId: ctx.sessionId
					},
					'embedding_model'
				);

				const results = await ctx.env.DOCUMENT_CHUNKS.query(embeddings[0], {
					topK: top_k ?? 5,
					returnMetadata: 'all',
					filter: { userId: ctx.userId }
				});

				if (results.matches.length === 0) {
					return 'No relevant documents found for your query.';
				}

				const formattedResults = results.matches.map((match, i) => {
					const meta = match.metadata as Record<string, unknown>;
					const score = (match.score * 100).toFixed(1);
					return `[${i + 1}] (${score}% match)\n${meta?.context || ''}\n${meta?.text || ''}`;
				});

				return `Found ${results.matches.length} relevant document(s):\n\n${formattedResults.join('\n\n---\n\n')}`;
			}
		}),

		list_files: tool({
			description: 'List all files uploaded by the user that are accessible to the agent.',
			inputSchema: z.object({
				file_type: z
					.string()
					.optional()
					.describe('Filter by file type (e.g., "pdf", "docx", "csv")')
			}),
			execute: async ({ file_type }: { file_type?: string }) => {
				const conditions = [eq(userUploads.user, ctx.userId), eq(userUploads.shareWithAgent, true)];

				const files = await ctx.db
					.select()
					.from(userUploads)
					.where(and(...conditions))
					.orderBy(desc(userUploads.created))
					.limit(100);

				// Post-filter by file_type if specified (contains match)
				const filtered = file_type
					? files.filter((f) => (f.type ?? '').toLowerCase().includes(file_type.toLowerCase()))
					: files;

				if (filtered.length === 0) {
					return 'No accessible files found.';
				}

				const fileList = filtered.map((file) => {
					const size = file.size ? `${(Number(file.size) / 1024).toFixed(1)} KB` : 'Unknown size';
					const date = file.created ? new Date(file.created).toLocaleDateString() : 'Unknown';
					return `• ${file.name} (${file.type}, ${size}) - Uploaded ${date}`;
				});

				return `Found ${filtered.length} file(s):\n\n${fileList.join('\n')}`;
			}
		}),

		search_documents: tool({
			description:
				'Search through uploaded documents to find specific information. Uses advanced hybrid search (vector + full-text + AI reranking) for best results.',
			inputSchema: z.object({
				query: z.string().describe('The search query'),
				file_scope: z
					.enum(['chat', 'global', 'all'])
					.optional()
					.default('all')
					.describe(
						'Which files to search: "chat" = current chat files, "global" = all files, "all" = both'
					)
			}),
			execute: async ({
				query,
				file_scope
			}: {
				query: string;
				file_scope?: 'chat' | 'global' | 'all';
			}) => {
				// Use RAGService for proper hybrid search if available
				if (ctx.ragService) {
					const log = createLogger('Tools', { userId: ctx.userId });
					log.debug('doc_search_rag', { file_scope });
					// For chat scope, use attached files search; otherwise use full hybrid search
					const results: SearchResult[] =
						file_scope === 'chat'
							? await ctx.ragService.searchChatAttachments(query, 15)
							: await ctx.ragService.hybridSearchDocuments(query);

					log.debug('doc_search_rag_results', { count: results.length });

					if (results.length === 0) {
						return 'No matching content found in your documents.';
					}

					const formattedResults = results.map((result: SearchResult, i: number) => {
						const score = (
							(result.normalizedScore ?? result.rrfScore ?? result.vectorScore ?? 0) * 100
						).toFixed(1);
						const source = result.metadata?.filename || 'Unknown document';
						return `[${i + 1}] From: ${source} (${score}% relevance)\n${result.text}`;
					});

					return `Found ${results.length} result(s):\n\n${formattedResults.join('\n\n---\n\n')}`;
				}

				// Fallback to basic vector search if no RAG service
				const filter: { userId: string; sessionId?: string } = { userId: ctx.userId };
				if (file_scope === 'chat') {
					filter.sessionId = ctx.sessionId;
				}

				const log = createLogger('Tools', { userId: ctx.userId });
				log.debug('doc_search_vector', { file_scope });

				const { embeddings } = await trackEmbedding(
					ctx.env,
					[query],
					{
						db: ctx.db,
						userId: ctx.userId,
						costTracker: ctx.costTracker,
						messageId: ctx.sessionId
					},
					'embedding_model'
				);

				const results = await ctx.env.DOCUMENT_CHUNKS.query(embeddings[0], {
					topK: 15,
					returnMetadata: 'all',
					filter
				});

				log.debug('doc_search_vector_results', { count: results.matches.length });

				if (results.matches.length === 0) {
					return 'No matching content found in your documents.';
				}

				const formattedResults = results.matches.map((match, i) => {
					const meta = match.metadata as Record<string, unknown>;
					const score = (match.score * 100).toFixed(1);
					const source = (meta?.filename as string) || 'Unknown document';
					return `[${i + 1}] From: ${source} (${score}% match)\n${meta?.text || ''}`;
				});

				return `Found ${results.matches.length} result(s):\n\n${formattedResults.join('\n\n---\n\n')}`;
			}
		}),

		read_file_content: tool({
			description: `Read the full or partial content of an uploaded file. Use list_files first to see available files, then use the exact filename to read content.

This tool retrieves chunks of a document and concatenates them in order. For large files, use section_start and section_end to read specific portions.

Best practices:
- First call list_files to see what files are available
- Use the exact filename from list_files (e.g., "FullStatementReport_2025-12-09 22_22_39.133.csv")
- For large files (>50 chunks), read in sections using section_start and section_end`,
			inputSchema: z.object({
				filename: z.string().describe('The exact filename to read (from list_files output)'),
				section_start: z
					.number()
					.optional()
					.default(0)
					.describe('Starting chunk index (0-based, default: 0)'),
				section_end: z
					.number()
					.optional()
					.describe('Ending chunk index (exclusive). Omit to read to end.')
			}),
			execute: async ({
				filename,
				section_start,
				section_end
			}: {
				filename: string;
				section_start?: number;
				section_end?: number;
			}) => {
				// 1. Find the file in user_uploads by filename
				const files = await ctx.db
					.select({
						id: userUploads.id,
						name: userUploads.name,
						type: userUploads.type,
						vectors: userUploads.vectors,
						meta: userUploads.meta
					})
					.from(userUploads)
					.where(and(eq(userUploads.user, ctx.userId), eq(userUploads.shareWithAgent, true)))
					.limit(100);

				// Post-filter by filename (contains match, like PB's ~ operator)
				const matchingFiles = files.filter((f) =>
					(f.name ?? '').toLowerCase().includes(filename.toLowerCase())
				);

				if (matchingFiles.length === 0) {
					return `File "${filename}" not found or not accessible. Use list_files to see available files.`;
				}

				const file = matchingFiles[0] as {
					id: string;
					name: string | null;
					type: string | null;
					vectors?: unknown;
					meta?: { chunksCount?: number } | null;
				};
				const fileId = file.id;
				const chunksCount = file.meta?.chunksCount ?? 0;

				// 2. Read chunks directly from the user's memory graph (full text, zero AI cost)
				// Graph stores full chunk text in graph_document_chunks table via upsertChunk()
				const graphStub = new MemoryGraphService(ctx.db, ctx.userId);

				// Determine how many chunks to try
				const maxChunks = chunksCount > 0 ? chunksCount : 100;
				const fileChunks: Array<{ index: number; text: string; context: string }> = [];

				for (let i = 0; i < maxChunks; i++) {
					const chunkId = `${fileId}::chunk::${i}`;
					try {
						const chunk = await graphStub.getChunk(chunkId);
						if (!chunk) break; // No more chunks
						fileChunks.push({
							index: chunk.chunkIndex,
							text: chunk.text,
							context: chunk.context
						});
					} catch {
						break; // Stop on error
					}
				}

				if (fileChunks.length === 0) {
					return `File "${file.name}" exists but has no indexed content yet. It may still be processing.`;
				}

				fileChunks.sort((a, b) => a.index - b.index);

				// Apply section filtering
				const startIdx = section_start ?? 0;
				const endIdx = section_end ?? fileChunks.length;
				const selectedChunks = fileChunks.slice(startIdx, endIdx);

				if (selectedChunks.length === 0) {
					return `No content in specified range. File has ${fileChunks.length} chunks (indices 0-${fileChunks.length - 1}).`;
				}

				// Concatenate chunk text
				const content = selectedChunks
					.map((chunk) => {
						if (chunk.context) {
							return `[Context: ${chunk.context}]\n\n${chunk.text}`;
						}
						return chunk.text;
					})
					.join('\n\n');

				const rangeInfo =
					startIdx > 0 || endIdx < fileChunks.length
						? ` (chunks ${startIdx}-${Math.min(endIdx, fileChunks.length) - 1} of ${fileChunks.length})`
						: '';

				return `# ${file.name}${rangeInfo}\n\n${content}`;
			}
		})
	};
}
