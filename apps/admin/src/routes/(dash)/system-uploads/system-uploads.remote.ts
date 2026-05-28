import { command, form, query } from '$app/server';
import { getRequestEvent } from '$app/server';
import { getPaginatedData } from '$lib/functions/pagination';
import { aiSystemUploads } from '@repo/db/schema';
import { MemoryGraphService } from '@repo/db/graph';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Get paginated system uploads for the data table
 */
export const getPaginatedSystemUploads = query(z.string(), async (tableId) => {
	const { locals, url, cookies } = getRequestEvent();
	return await getPaginatedData({
		id: tableId,
		loadUrl: url,
		cookies,
		db: locals.db,
		table: aiSystemUploads,
		searchFilters: ['name', 'type'],
		sortKey: '-created'
	});
});

/**
 * Get all system uploads (for dropdowns, etc.)
 */
export const getAllSystemUploads = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db.select().from(aiSystemUploads).orderBy(desc(aiSystemUploads.created));
});

/**
 * Upload a system file
 * Uses the FILE_SERVICE entrypoint directly for file operations
 */
export const uploadSystemFile = form(
	z.object({
		file: z.instanceof(File)
	}),
	async ({ file }) => {
		const { locals, platform } = getRequestEvent();

		if (!platform?.env?.FILE_SERVICE) {
			return { success: false, error: 'File service not available' };
		}

		try {
			// Get current user ID (should be admin)
			const userId = locals.user?.id;
			if (!userId) {
				return { success: false, error: 'User not authenticated' };
			}

			console.log('[SystemUploads] Uploading system file:', file.name, 'by user:', userId);

			const fileBuffer = await file.arrayBuffer();
			const result = await platform.env.FILE_SERVICE.uploadSystemFileBuffer({
				fileBuffer,
				fileName: file.name,
				fileType: file.type,
				lastModified: file.lastModified,
				adminUserId: userId
			});

			return { success: true, file: result };
		} catch (e) {
			console.error('[SystemUploads] Upload error:', e);
			return { success: false, error: (e as Error).message };
		}
	}
);

/**
 * Upload multiple system files with TRUE batch optimization
 * - Single auth call for all files
 * - Parallel R2 uploads
 * - Parallel database record creation
 * - Batch text extraction via AI.toMarkdown()
 * - Single batch embedding for ALL chunks
 * - Single batch upsert to Vectorize
 */
export const uploadSystemFiles = form(
	z.object({
		files: z.array(z.instanceof(File))
	}),
	async ({ files }) => {
		const { locals, platform } = getRequestEvent();

		if (!platform?.env?.FILE_SERVICE) {
			return { success: false, error: 'File service not available' };
		}

		try {
			const userId = locals.user?.id;
			if (!userId) {
				return { success: false, error: 'User not authenticated' };
			}

			if (!files || files.length === 0) {
				return { success: false, error: 'No files provided' };
			}

			console.log(`[SystemUploads] Batch uploading ${files.length} system files by user:`, userId);

			const payload = await Promise.all(
				files.map(async (file) => ({
					buffer: await file.arrayBuffer(),
					fileName: file.name,
					fileType: file.type,
					lastModified: file.lastModified
				}))
			);

			const result = await platform.env.FILE_SERVICE.uploadFilesBuffer({
				files: payload,
				userId,
				scope: 'system'
			});

			if (result.failed.length > 0) {
				console.error(
					`[SystemUploads] Batch upload had ${result.failed.length} failures (of ${files.length}).`
				);
				for (const f of result.failed) {
					console.error(`[SystemUploads] Upload failed for ${f.fileName}: ${f.error}`);
				}
			}

			return {
				success: result.failed.length === 0,
				totalFiles: files.length,
				successCount: result.successful.length,
				failedCount: result.failed.length,
				results: { successful: result.successful, failed: result.failed }
			};
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			console.error('[SystemUploads] Batch upload error:', {
				message: err.message,
				stack: err.stack
			});
			return { success: false, error: err.message };
		}
	}
);

/**
 * Delete a system upload
 */
export const deleteSystemUpload = command(
	z.object({
		id: z.string()
	}),
	async ({ id }) => {
		const { locals, platform } = getRequestEvent();

		if (!platform?.env?.FILE_SERVICE) {
			return { success: false, error: 'File service not available' };
		}

		try {
			const userId = locals.user?.id;
			if (!userId) {
				return { success: false, error: 'User not authenticated' };
			}

			const result = await platform.env.FILE_SERVICE.deleteSystemFile({
				fileId: id,
				adminUserId: userId
			});

			if (!result.success) {
				return { success: false, error: 'Delete failed' };
			}

			return {
				success: true,
				deletedVectorIds: result.deletedVectorIds,
				deletedGraphNodeIds: result.deletedGraphNodeIds
			};
		} catch (e) {
			console.error('[SystemUploads] Delete error:', e);
			return { success: false, error: (e as Error).message };
		}
	}
);

/**
 * Update a system upload's description
 */
export const updateSystemUploadDescription = form(
	z.object({
		id: z.string(),
		description: z.string()
	}),
	async ({ id, description }) => {
		const { locals } = getRequestEvent();

		try {
			await locals.db
				.update(aiSystemUploads)
				.set({ description: description.trim(), updated: new Date().toISOString() })
				.where(eq(aiSystemUploads.id, id));

			return { success: true };
		} catch (e) {
			console.error('[SystemUploads] Update description error:', e);
			return { success: false, error: (e as Error).message };
		}
	}
);

/**
 * System Knowledge User ID - matches cf-worker constant
 * Used for system uploads that are accessible to all users
 */
const SYSTEM_KNOWLEDGE_USER_ID = '__SYSTEM_KNOWLEDGE__';

/**
 * Get the system knowledge graph for visualization
 */
export const getSystemKnowledgeGraph = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.db) {
		return {
			nodes: [],
			edges: [],
			stats: {
				nodeCount: 0,
				edgeCount: 0,
				nodesByType: {},
				edgesByRelationship: {}
			}
		};
	}

	try {
		const graph = new MemoryGraphService(locals.db, SYSTEM_KNOWLEDGE_USER_ID);
		const graphData = await graph.getFullGraph({ limit: 500 });
		return graphData;
	} catch (err) {
		console.error('Failed to fetch system knowledge graph:', err);
		return {
			nodes: [],
			edges: [],
			stats: {
				nodeCount: 0,
				edgeCount: 0,
				nodesByType: {},
				edgesByRelationship: {}
			}
		};
	}
});
