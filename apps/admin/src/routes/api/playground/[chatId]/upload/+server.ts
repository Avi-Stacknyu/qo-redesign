/**
 * Playground File Upload Endpoint
 *
 * Handles file uploads for playground chats by:
 * 1. Receiving file via FormData
 * 2. Calling FILE_SERVICE entrypoint directly via service binding
 * 3. Associating the file with the chat thread
 * 4. Returning the file metadata for display
 *
 * The FILE_SERVICE handles:
 * - R2 storage
 * - Database record creation
 * - Document processing workflow trigger (vectorization, etc.)
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chats } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, params, locals, platform }) => {
	const chatId = params.chatId;
	if (!chatId) {
		throw error(400, 'Missing chatId');
	}

	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Parse the multipart form data
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			throw error(400, 'No file provided');
		}

		// Validate file size (max 50MB)
		const maxSize = 50 * 1024 * 1024;
		if (file.size > maxSize) {
			throw error(
				400,
				`File too large. Maximum size is 50MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`
			);
		}

		// Verify the chat belongs to the user
		const [chat] = await locals.db.select().from(chats).where(eq(chats.id, chatId));

		if (!chat || chat.user !== userId) {
			throw error(403, 'You do not own this chat');
		}

		// Get the FILE_SERVICE entrypoint
		const fileService = platform?.env?.FILE_SERVICE;

		if (!fileService) {
			// Development fallback - return a simulated response
			console.warn('[Upload] FILE_SERVICE binding not available, using fallback');
			return json({
				file: {
					id: `dev-${Date.now()}`,
					name: file.name,
					size: file.size,
					type: file.type,
					status: 'simulated'
				}
			});
		}

		// Convert file to ArrayBuffer for RPC (more reliable than File object over service bindings)
		const fileBuffer = await file.arrayBuffer();

		// Call the FILE_SERVICE entrypoint directly
		const result = await fileService.uploadFileBuffer({
			fileBuffer,
			fileName: file.name,
			fileType: file.type,
			lastModified: file.lastModified,
			userId,
			chatId, // Associate file with this chat
			shareWithAgent: true
		});

		// Update the chat's attached files list (for context injection)
		const currentAttachments = (chat.meta as Record<string, unknown>)?.attachedFiles || [];
		const updatedAttachments = [
			...(Array.isArray(currentAttachments) ? currentAttachments : []),
			{
				id: result.id,
				name: result.name,
				type: result.type,
				size: result.size,
				uploadedAt: new Date().toISOString()
			}
		];

		await locals.db
			.update(chats)
			.set({
				meta: {
					...((chat.meta as Record<string, unknown>) || {}),
					attachedFiles: updatedAttachments
				},
				updated: new Date().toISOString()
			})
			.where(eq(chats.id, chatId));

		// Return file info for UI display
		return json({
			file: {
				id: result.id,
				name: result.name,
				size: result.size,
				type: result.type,
				path: result.path,
				processingId: result.processingId,
				status: 'processing'
			}
		});
	} catch (err) {
		console.error('[Upload] Error:', err);

		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		throw error(500, err instanceof Error ? err.message : 'Failed to upload file');
	}
};
