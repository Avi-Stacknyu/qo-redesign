/**
 * Batch File Status Endpoint — check processing status of multiple files at once.
 * Replaces N individual /files/[fileId] polls with a single request.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const chatId = params.chatId;
	if (!chatId) throw error(400, 'Missing chatId');

	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const body = (await request.json()) as { fileIds?: unknown };
	const fileIds = body.fileIds;
	if (!Array.isArray(fileIds) || fileIds.length === 0) {
		throw error(400, 'fileIds must be a non-empty array');
	}
	const fileIdList = fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
	if (fileIdList.length === 0) throw error(400, 'fileIds must contain strings');

	const fileService = platform?.env?.FILE_SERVICE;
	if (!fileService) {
		// Dev fallback
		const result: Record<
			string,
			{ id: string; status: string; name: string; size: number; type: string }
		> = {};
		for (const id of fileIdList) {
			result[id] = { id, status: 'ready', name: 'file', size: 0, type: 'application/octet-stream' };
		}
		return json(result);
	}

	const statuses = await fileService.getFileStatuses({ fileIds: fileIdList, userId });
	return json(statuses);
};
