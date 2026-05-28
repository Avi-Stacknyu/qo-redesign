import { WorkerEntrypoint } from 'cloudflare:workers';
import { MemoryGraphService } from '../graph/memory-graph-service';
import { Env, SYSTEM_KNOWLEDGE_USER_ID } from '../types';
import type { Database } from '@repo/db/types';
import { userUploads, aiSystemUploads } from '@repo/db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { getDb } from '../lib/db';
import type { DocumentProcessingParams } from './document-processor';
import { createLogger, formatError } from '../utils/logger';
import { configurePostHogLogger } from '../utils/posthog-logger';
import type { FileServiceRpc, UploadResult, DeleteResult, UploadScope } from '@repo/shared/types';

// ============================================================================
// FileServiceEntrypoint - WorkerEntrypoint for direct RPC file operations
// ============================================================================

/**
 * FileServiceEntrypoint - WorkerEntrypoint for direct RPC file operations
 *
 * Allows other Cloudflare Workers (like the admin app) to call file operations
 * directly via service bindings without HTTP overhead.
 *
 * Usage from admin: const result = await platform.env.FILE_SERVICE.uploadFileBuffer({...})
 */
export class FileServiceEntrypoint extends WorkerEntrypoint<Env> implements FileServiceRpc {
	private async getFileService(): Promise<FileService> {
		configurePostHogLogger(this.env);
		const db = await getDb(this.env);
		return new FileService(this.env, db);
	}

	async uploadFileBuffer(params: {
		fileBuffer: ArrayBuffer;
		fileName: string;
		fileType: string;
		lastModified?: number;
		userId: string;
		chatId?: string;
		shareWithAgent?: boolean;
	}): Promise<UploadResult> {
		const fs = await this.getFileService();
		const file = new File([params.fileBuffer], params.fileName, {
			type: params.fileType,
			lastModified: params.lastModified ?? Date.now()
		});
		return fs.upload(file, params.userId, {
			scope: 'user',
			chatId: params.chatId,
			shareWithAgent: params.shareWithAgent ?? true
		});
	}

	async uploadSystemFileBuffer(params: {
		fileBuffer: ArrayBuffer;
		fileName: string;
		fileType: string;
		lastModified?: number;
		adminUserId: string;
	}): Promise<UploadResult> {
		const fs = await this.getFileService();
		const file = new File([params.fileBuffer], params.fileName, {
			type: params.fileType,
			lastModified: params.lastModified ?? Date.now()
		});
		return fs.upload(file, params.adminUserId, { scope: 'system', shareWithAgent: true });
	}

	async uploadFilesBuffer(params: {
		files: Array<{
			buffer: ArrayBuffer;
			fileName: string;
			fileType: string;
			lastModified?: number;
		}>;
		userId: string;
		scope?: UploadScope;
		chatId?: string;
		shareWithAgent?: boolean;
	}): Promise<{ successful: UploadResult[]; failed: Array<{ fileName: string; error: string }> }> {
		const fs = await this.getFileService();
		const fileObjs = params.files.map(
			(f) =>
				new File([f.buffer], f.fileName, {
					type: f.fileType,
					lastModified: f.lastModified ?? Date.now()
				})
		);
		return fs.uploadBatch(fileObjs, params.userId, {
			scope: params.scope ?? 'user',
			chatId: params.chatId,
			shareWithAgent: params.shareWithAgent ?? true
		});
	}

	async deleteFile(params: { fileId: string; userId: string }): Promise<DeleteResult> {
		const fs = await this.getFileService();
		return fs.delete(params.fileId, params.userId, { scope: 'user' });
	}

	async deleteSystemFile(params: { fileId: string; adminUserId: string }): Promise<DeleteResult> {
		const fs = await this.getFileService();
		return fs.delete(params.fileId, params.adminUserId, { scope: 'system' });
	}

	async listFiles(params: {
		userId: string;
		chatId?: string;
		page?: number;
		perPage?: number;
	}): Promise<{
		files: Array<{ id: string; name: string; type: string; size: number; createdAt: string }>;
		totalPages: number;
		totalItems: number;
	}> {
		const fs = await this.getFileService();
		return fs.listUserFiles(params.userId, {
			page: params.page ?? 1,
			perPage: params.perPage ?? 20,
			chatId: params.chatId
		});
	}

	async listSystemFiles(params: { page?: number; perPage?: number; filter?: string }): Promise<{
		files: Array<{ id: string; name: string; type: string; size: number; createdAt: string }>;
		totalPages: number;
		totalItems: number;
	}> {
		const fs = await this.getFileService();
		return fs.listSystemFiles({
			page: params.page ?? 1,
			perPage: params.perPage ?? 20,
			filter: params.filter
		});
	}

	async getFileStatus(params: { fileId: string; userId: string; scope?: UploadScope }): Promise<{
		id: string;
		name: string;
		type: string;
		size: number;
		status: 'processing' | 'ready' | 'failed';
		vectorIds: string[];
		graphNodeIds: string[];
		createdAt: string;
	} | null> {
		const fs = await this.getFileService();
		return fs.getFileStatus(params.fileId, params.userId, { scope: params.scope ?? 'user' });
	}

	/**
	 * Batch file status check — single query for multiple files.
	 * Replaces N individual getFileStatus polls with 1 network round-trip.
	 */
	async getFileStatuses(params: {
		fileIds: string[];
		userId: string;
		scope?: UploadScope;
	}): Promise<
		Record<
			string,
			{
				id: string;
				name: string;
				type: string;
				size: number;
				status: 'processing' | 'ready' | 'failed';
			}
		>
	> {
		const fs = await this.getFileService();
		return fs.getFileStatuses(params.fileIds, params.userId, { scope: params.scope ?? 'user' });
	}

	async getDownloadUrl(params: { fileId: string; scope?: UploadScope }): Promise<string | null> {
		const fs = await this.getFileService();
		return fs.getDownloadUrl(params.fileId, params.scope ?? 'user');
	}

	async getFile(params: { fileId: string; scope?: UploadScope }): Promise<{
		id: string;
		name: string;
		path: string;
		type: string;
		size: number;
		vectors: string[];
		meta: Record<string, unknown>;
		createdAt: string;
	} | null> {
		const fs = await this.getFileService();
		return fs.getFile(params.fileId, { scope: params.scope ?? 'user' });
	}
}

// ============================================================================
// FileService - Core file handling logic
// ============================================================================

/**
 * Determine processing status accounting for continuation runs.
 * A file is still "processing" if totalChunks > chunksCount (continuation pending).
 */
function resolveProcessingStatus(
	vectors: string[],
	meta: Record<string, unknown>,
	graphNodeIds: string[]
): 'processing' | 'ready' | 'failed' {
	if (meta.processingError) return 'failed';
	const totalChunks = (meta.totalChunks as number) ?? 0;
	const chunksCount = (meta.chunksCount as number) ?? 0;
	if (totalChunks > 0 && chunksCount < totalChunks) return 'processing';
	if (vectors.length > 0 || graphNodeIds.length > 0) return 'ready';
	return 'processing';
}

/**
 * Sanitize filename - remove dangerous characters
 */
function sanitizeFilename(name: string): string {
	// Remove path separators and null bytes
	let sanitized = name.replace(/[/\\:\x00]/g, '');
	// Remove control characters
	sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
	// Limit length
	if (sanitized.length > 255) {
		const ext = sanitized.slice(sanitized.lastIndexOf('.'));
		sanitized = sanitized.slice(0, 255 - ext.length) + ext;
	}
	return sanitized.trim() || 'file';
}

/**
 * Supported file types for upload
 */
const SUPPORTED_FILE_TYPES = [
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/webp',
	'text/html',
	'text/csv',
	'text/plain',
	'text/markdown',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-excel.sheet.macroenabled.12',
	'application/vnd.ms-excel.sheet.binary.macroenabled.12',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

/**
 * File upload scope - determines storage location and access rules
 */
// UploadScope, UploadResult, DeleteResult are imported from @repo/shared/types
export type { UploadScope, UploadResult, DeleteResult } from '@repo/shared/types';

/**
 * FileService - Unified file handling for uploads, processing, and deletion
 *
 * Flow:
 * 1. Upload: R2 + database record creation
 * 2. Processing: Queue message triggers processDocument() in a separate consumer invocation
 * 3. Delete: Cascade delete from R2 + Vectorize + Graph + database
 */

const log = createLogger('FileService');

export class FileService {
	constructor(
		private env: Env,
		private db: Database
	) {}

	/**
	 * Validate file type is supported
	 */
	private validateFileType(type: string): type is SupportedFileType {
		return SUPPORTED_FILE_TYPES.includes(type as SupportedFileType);
	}

	/**
	 * Generate sanitized file key for R2 storage
	 */
	private generateFileKey(
		fileName: string,
		userId: string,
		scope: UploadScope,
		fileId: string
	): string {
		let sanitized = sanitizeFilename(fileName);
		if (!sanitized) {
			sanitized = `file-${fileId}`;
		}

		// Include fileId in path to prevent overwrites
		return scope === 'system'
			? `uploads/system/${fileId}_${sanitized}`
			: `uploads/${userId}/${fileId}_${sanitized}`;
	}

	/**
	 * Upload a file - creates R2 object, database record, and triggers workflow
	 *
	 * @param file - File object or blob with metadata
	 * @param userId - User performing the upload
	 * @param options - Upload options (scope, chatId, etc.)
	 */
	async upload(
		file: File,
		userId: string,
		options: {
			scope?: UploadScope;
			chatId?: string;
			shareWithAgent?: boolean;
		} = {}
	): Promise<UploadResult> {
		const { scope = 'user', chatId, shareWithAgent = true } = options;

		// Validate file type
		if (!this.validateFileType(file.type)) {
			throw new FileServiceError(`Unsupported file type: ${file.type}`, 'UNSUPPORTED_TYPE');
		}

		// Generate unique ID for this upload
		const fileId = crypto.randomUUID().replace(/-/g, '').slice(0, 15);

		// Generate R2 key
		const fileKey = this.generateFileKey(file.name, userId, scope, fileId);

		// Read file content once
		const fileBuffer = await file.arrayBuffer();

		// Step 1: Upload to R2
		await this.env.DOCUMENTS_BUCKET.put(fileKey, fileBuffer, {
			httpMetadata: { contentType: file.type },
			customMetadata: {
				userId,
				chatId: chatId || '',
				scope,
				originalName: file.name
			}
		});

		// Step 2: Create database record
		const now = new Date().toISOString();

		if (scope === 'system') {
			await this.db.insert(aiSystemUploads).values({
				id: fileId,
				name: sanitizeFilename(file.name) || `file-${fileId}`,
				size: String(file.size),
				type: file.type,
				path: fileKey,
				meta: { originalName: file.name },
				vectors: [],
				created: now,
				updated: now
			});
		} else {
			await this.db.insert(userUploads).values({
				id: fileId,
				name: sanitizeFilename(file.name) || `file-${fileId}`,
				size: String(file.size),
				type: file.type,
				path: fileKey,
				meta: { originalName: file.name },
				vectors: [],
				shareWithAgent: shareWithAgent,
				user: userId,
				created: now,
				updated: now
			});
		}

		// Step 3: Enqueue document processing via Cloudflare Queue.
		// The queue consumer runs in a separate invocation with its own generous
		// time limits (up to 15 min), avoiding the waitUntil() timeout issue.
		const processingParams: DocumentProcessingParams = {
			fileKey,
			fileId,
			userId,
			fileName: file.name,
			fileType: file.type,
			scope
		};

		await this.env.DOC_PROCESSING_QUEUE.send(processingParams);

		return {
			id: fileId,
			name: file.name,
			path: fileKey,
			type: file.type,
			size: file.size,
			processingId: fileId
		};
	}

	/**
	 * Upload multiple files in batch
	 */
	async uploadBatch(
		files: File[],
		userId: string,
		options: {
			scope?: UploadScope;
			chatId?: string;
			shareWithAgent?: boolean;
		} = {}
	): Promise<{
		successful: UploadResult[];
		failed: Array<{ fileName: string; error: string }>;
	}> {
		const successful: UploadResult[] = [];
		const failed: Array<{ fileName: string; error: string }> = [];

		// Process sequentially to avoid overwhelming the workflow system
		for (const file of files) {
			try {
				const result = await this.upload(file, userId, options);
				successful.push(result);
			} catch (error) {
				failed.push({
					fileName: file.name,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return { successful, failed };
	}

	/**
	 * Delete a file - cascade deletes from R2, Vectorize, Graph, and database
	 *
	 * TRANSACTION SAFETY:
	 * - Attempts to delete ALL external resources before touching the database
	 * - Collects all errors and only proceeds if ALL external deletions succeed
	 * - Database record is preserved if ANY external deletion fails (enables retry)
	 * - 404 responses are treated as success (idempotent - resource already gone)
	 */
	async delete(
		fileId: string,
		userId: string,
		options: { scope?: UploadScope } = {}
	): Promise<DeleteResult> {
		const { scope = 'user' } = options;
		const table = scope === 'system' ? aiSystemUploads : userUploads;

		// Step 1: Get the file record (this is the source of truth)
		const [record] = await this.db.select().from(table).where(eq(table.id, fileId)).limit(1);
		if (!record) {
			throw new FileServiceError('File not found', 'NOT_FOUND');
		}

		// Step 2: Verify ownership (for user uploads only)
		if (scope === 'user' && 'user' in record && record.user !== userId) {
			throw new FileServiceError(
				'Unauthorized: cannot delete files you do not own',
				'UNAUTHORIZED'
			);
		}

		// Extract all resource identifiers
		const vectorIds = (record.vectors as string[]) || [];
		const meta = record.meta as { graphNodeIds?: string[] } | undefined;
		const graphNodeIds = meta?.graphNodeIds || [];
		const fileKey = record.path ?? '';
		const docNodeId = `doc::${fileId}`;

		// Track deletion results - we attempt ALL deletions before deciding to delete database record
		const deletionErrors: string[] = [];
		const deletionResults = {
			documentChunks: { attempted: false, success: false },
			ftsChunks: { attempted: false, success: false },
			graphNodes: { attempted: false, success: false, failedNodes: [] as string[] },
			graphNodesVector: { attempted: false, success: false },
			r2File: { attempted: false, success: false }
		};

		// ═══════════════════════════════════════════════════════════════════════════
		// PHASE 1: Delete all external resources (collect errors, don't throw yet)
		// ═══════════════════════════════════════════════════════════════════════════

		// Step 3: Delete from DOCUMENT_CHUNKS Vectorize index
		if (vectorIds.length > 0) {
			deletionResults.documentChunks.attempted = true;
			try {
				await this.env.DOCUMENT_CHUNKS.deleteByIds(vectorIds);
				deletionResults.documentChunks.success = true;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				deletionErrors.push(`DOCUMENT_CHUNKS: ${message}`);
			}
		} else {
			deletionResults.documentChunks.success = true; // Nothing to delete
		}

		// Step 4: Delete from Graph DO (nodes + edges cascade)
		// For system uploads, use SYSTEM_KNOWLEDGE_USER_ID namespace
		// Use direct RPC calls instead of HTTP fetch for better performance
		const graphUserId = scope === 'system' ? SYSTEM_KNOWLEDGE_USER_ID : userId;
		const graphStub = new MemoryGraphService(await getDb(this.env), graphUserId);

		if (graphNodeIds.length > 0) {
			deletionResults.graphNodes.attempted = true;

			// Attempt to delete ALL graph nodes (don't stop on first failure)
			let allGraphNodesDeleted = true;
			for (const nodeId of graphNodeIds) {
				try {
					// Direct RPC call - deleteNode returns the deleted node or null if not found
					const deleted = await graphStub.deleteNode(nodeId);
					// null = already gone (idempotent success) - continue silently
					if (!deleted) continue;
				} catch (error) {
					allGraphNodesDeleted = false;
					deletionResults.graphNodes.failedNodes.push(nodeId);
					const message = error instanceof Error ? error.message : String(error);
					deletionErrors.push(`Graph node "${nodeId}": ${message}`);
				}
			}
			deletionResults.graphNodes.success = allGraphNodesDeleted;
		} else {
			deletionResults.graphNodes.success = true; // Nothing to delete
		}

		// Step 4.5: Delete FTS-indexed chunks from Graph DO (GDPR compliance)
		deletionResults.ftsChunks.attempted = true;
		try {
			await graphStub.deleteChunksByFileKey(fileKey);
			deletionResults.ftsChunks.success = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			deletionErrors.push(`FTS chunks for "${fileKey}": ${message}`);
		}

		// Step 5: Delete from GRAPH_NODES Vectorize index (document summary vector)
		deletionResults.graphNodesVector.attempted = true;
		try {
			await this.env.GRAPH_NODES.deleteByIds([docNodeId]);
			deletionResults.graphNodesVector.success = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// Vectorize deleteByIds doesn't throw for non-existent IDs, so this is a real error
			deletionErrors.push(`GRAPH_NODES vector "${docNodeId}": ${message}`);
		}

		// Step 6: Delete from R2 storage
		deletionResults.r2File.attempted = true;
		try {
			await this.env.DOCUMENTS_BUCKET.delete(fileKey);
			deletionResults.r2File.success = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			deletionErrors.push(`R2 file "${fileKey}": ${message}`);
		}

		// ═══════════════════════════════════════════════════════════════════════════
		// PHASE 2: Evaluate results - only delete database record if ALL external deletions succeeded
		// ═══════════════════════════════════════════════════════════════════════════

		const allExternalDeletionsSucceeded =
			deletionResults.documentChunks.success &&
			deletionResults.ftsChunks.success &&
			deletionResults.graphNodes.success &&
			deletionResults.graphNodesVector.success &&
			deletionResults.r2File.success;

		if (!allExternalDeletionsSucceeded) {
			// CRITICAL: Do NOT delete database record - preserve for retry
			throw new FileServiceError(
				`Delete incomplete - database record preserved for retry. Failures:\n${deletionErrors.join('\n')}`,
				'DELETE_INCOMPLETE'
			);
		}

		// ═══════════════════════════════════════════════════════════════════════════
		// PHASE 3: All external resources deleted - safe to delete database record
		// ═══════════════════════════════════════════════════════════════════════════

		await this.db.delete(table).where(eq(table.id, fileId));

		return {
			success: true,
			deletedVectorIds: vectorIds,
			deletedGraphNodeIds: graphNodeIds
		};
	}

	/**
	 * Get file record by ID
	 */
	async getFile(
		fileId: string,
		options: { scope?: UploadScope } = {}
	): Promise<{
		id: string;
		name: string;
		path: string;
		type: string;
		size: number;
		vectors: string[];
		meta: Record<string, unknown>;
		createdAt: string;
	} | null> {
		const { scope = 'user' } = options;
		const table = scope === 'system' ? aiSystemUploads : userUploads;

		const [record] = await this.db.select().from(table).where(eq(table.id, fileId)).limit(1);
		if (!record) return null;

		return {
			id: record.id,
			name: record.name ?? '',
			path: record.path ?? '',
			type: record.type ?? '',
			size: Number(record.size),
			vectors: (record.vectors as string[]) || [],
			meta: (record.meta as Record<string, unknown>) || {},
			createdAt: record.created ?? ''
		};
	}

	/**
	 * List files for a user
	 */
	async listUserFiles(
		userId: string,
		options: {
			page?: number;
			perPage?: number;
			chatId?: string;
		} = {}
	): Promise<{
		files: Array<{
			id: string;
			name: string;
			type: string;
			size: number;
			createdAt: string;
		}>;
		totalPages: number;
		totalItems: number;
	}> {
		const { page = 1, perPage = 20, chatId } = options;

		const conditions = [eq(userUploads.user, userId)];
		if (chatId) {
			conditions.push(sql`${userUploads.meta}->>'chatId' = ${chatId}`);
		}
		const whereClause = and(...conditions)!;

		const [countRow] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(userUploads)
			.where(whereClause);
		const totalItems = countRow?.count ?? 0;
		const totalPages = Math.ceil(totalItems / perPage);

		const items = await this.db
			.select()
			.from(userUploads)
			.where(whereClause)
			.orderBy(desc(userUploads.created))
			.limit(perPage)
			.offset((page - 1) * perPage);

		return {
			files: items.map((r) => ({
				id: r.id,
				name: r.name ?? '',
				type: r.type ?? '',
				size: Number(r.size),
				createdAt: r.created ?? ''
			})),
			totalPages,
			totalItems
		};
	}

	/**
	 * List system files (admin access)
	 */
	async listSystemFiles(
		options: {
			page?: number;
			perPage?: number;
			filter?: string;
		} = {}
	): Promise<{
		files: Array<{
			id: string;
			name: string;
			type: string;
			size: number;
			createdAt: string;
		}>;
		totalPages: number;
		totalItems: number;
	}> {
		const { page = 1, perPage = 20 } = options;

		const [countRow] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(aiSystemUploads);
		const totalItems = countRow?.count ?? 0;
		const totalPages = Math.ceil(totalItems / perPage);

		const items = await this.db
			.select()
			.from(aiSystemUploads)
			.orderBy(desc(aiSystemUploads.created))
			.limit(perPage)
			.offset((page - 1) * perPage);

		return {
			files: items.map((r) => ({
				id: r.id,
				name: r.name ?? '',
				type: r.type ?? '',
				size: Number(r.size),
				createdAt: r.created ?? ''
			})),
			totalPages,
			totalItems
		};
	}

	/**
	 * Get file status including processing state
	 */
	async getFileStatus(
		fileId: string,
		userId: string,
		options: { scope?: UploadScope } = {}
	): Promise<{
		id: string;
		name: string;
		type: string;
		size: number;
		status: 'processing' | 'ready' | 'failed';
		vectorIds: string[];
		graphNodeIds: string[];
		createdAt: string;
	} | null> {
		const { scope = 'user' } = options;
		const table = scope === 'system' ? aiSystemUploads : userUploads;

		const [record] = await this.db.select().from(table).where(eq(table.id, fileId)).limit(1);
		if (!record) return null;

		if (scope === 'user' && 'user' in record && record.user !== userId) {
			return null;
		}

		const vectors = (record.vectors as string[]) || [];
		const meta = (record.meta as Record<string, unknown>) || {};
		const graphNodeIds = (meta.graphNodeIds as string[]) || [];

		const status = resolveProcessingStatus(vectors, meta, graphNodeIds);

		return {
			id: record.id,
			name: record.name ?? '',
			type: record.type ?? '',
			size: Number(record.size),
			status,
			vectorIds: vectors,
			graphNodeIds,
			createdAt: record.created ?? ''
		};
	}

	/**
	 * Batch file status check — single query for multiple file IDs.
	 * Returns a map of fileId → status info. Missing/unauthorized files are omitted.
	 */
	async getFileStatuses(
		fileIds: string[],
		userId: string,
		options: { scope?: UploadScope } = {}
	): Promise<
		Record<
			string,
			{
				id: string;
				name: string;
				type: string;
				size: number;
				status: 'processing' | 'ready' | 'failed';
			}
		>
	> {
		if (fileIds.length === 0) return {};

		const { scope = 'user' } = options;
		const table = scope === 'system' ? aiSystemUploads : userUploads;

		// Validate file IDs to prevent unexpected input
		const validIdRegex = /^[a-zA-Z0-9]{15}$/;
		const safeFileIds = fileIds.filter((id) => validIdRegex.test(id));
		if (safeFileIds.length === 0) return {};

		const result = await this.db.select().from(table).where(inArray(table.id, safeFileIds));

		const statuses: Record<
			string,
			{
				id: string;
				name: string;
				type: string;
				size: number;
				status: 'processing' | 'ready' | 'failed';
			}
		> = {};

		for (const record of result) {
			// Authorization check for user files
			if (scope === 'user' && 'user' in record && record.user !== userId) {
				continue;
			}

			const vectors = (record.vectors as string[]) || [];
			const meta = (record.meta as Record<string, unknown>) || {};
			const graphNodeIds = (meta.graphNodeIds as string[]) || [];

			const status = resolveProcessingStatus(vectors, meta, graphNodeIds);

			statuses[record.id] = {
				id: record.id,
				name: record.name ?? '',
				type: record.type ?? '',
				size: Number(record.size),
				status
			};
		}

		return statuses;
	}

	/**
	 * Get download URL for a file (pre-signed R2 URL or direct access)
	 */
	async getDownloadUrl(fileId: string, scope: UploadScope = 'user'): Promise<string | null> {
		const file = await this.getFile(fileId, { scope });
		if (!file) return null;

		// For now, return the R2 path - in production you'd use signed URLs
		return file.path;
	}
}

/**
 * Custom error class for FileService
 */
export class FileServiceError extends Error {
	constructor(
		message: string,
		public code:
			| 'UNSUPPORTED_TYPE'
			| 'UNAUTHORIZED'
			| 'NOT_FOUND'
			| 'WORKFLOW_FAILED'
			| 'DELETE_INCOMPLETE'
			| 'UNKNOWN'
	) {
		super(message);
		this.name = 'FileServiceError';
	}
}

/**
 * Create a FileService instance
 */
export function createFileService(env: Env, db: Database): FileService {
	return new FileService(env, db);
}
