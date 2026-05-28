/**
 * Batch File Status Endpoint — check processing status of multiple files at once.
 * Replaces N individual /files/[fileId] polls with a single request.
 */
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { chats } from '@repo/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const { threadId } = params;
	if (!threadId) throw error(400, 'Missing threadId');
	if (!locals.user) throw error(401, 'Unauthorized');

	const [chat] = await locals.db.select().from(chats).where(eq(chats.id, threadId)).limit(1);
	if (!chat) throw error(404, 'Thread not found');
	if (chat.user !== locals.user.id) throw error(403, 'Forbidden');

	const body = await request.json();
	const fileIds: string[] = body.fileIds;
	if (!Array.isArray(fileIds) || fileIds.length === 0) {
		throw error(400, 'fileIds must be a non-empty array');
	}

	const fileService = platform?.env?.FILE_SERVICE;
	if (!fileService) {
		// Dev fallback — mark all as ready
		const result: Record<
			string,
			{ id: string; status: string; name: string; size: number; type: string }
		> = {};
		for (const id of fileIds) {
			result[id] = { id, status: 'ready', name: 'file', size: 0, type: 'application/octet-stream' };
		}
		return json(result);
	}

	const statuses = await fileService.getFileStatuses({ fileIds, userId: locals.user.id });
	return json(statuses);
};
