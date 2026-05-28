/**
 * File Status Endpoint
 *
 * Check the processing status of an uploaded file.
 * Returns whether the file has been fully processed (vectorized, indexed).
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const chatId = params.chatId;
	const fileId = params.fileId;

	if (!chatId || !fileId) {
		throw error(400, 'Missing chatId or fileId');
	}

	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Get the FILE_SERVICE entrypoint
		const fileService = platform?.env?.FILE_SERVICE;

		if (!fileService) {
			// Development fallback
			return json({
				status: 'ready',
				vectorIds: [],
				graphNodeIds: []
			});
		}

		// Call FILE_SERVICE's getFileStatus directly
		const status = await fileService.getFileStatus({
			fileId,
			userId
		});

		return json(status);
	} catch (err) {
		console.error('[FileStatus] Error:', err);

		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to get file status');
	}
};
