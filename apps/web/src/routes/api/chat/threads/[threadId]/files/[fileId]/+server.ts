/**
 * File Status Endpoint — check processing status of an uploaded file.
 */
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { chats } from '@repo/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const { threadId, fileId } = params;
	if (!threadId || !fileId) throw error(400, 'Missing threadId or fileId');
	if (!locals.user) throw error(401, 'Unauthorized');

	const [chat] = await locals.db.select().from(chats).where(eq(chats.id, threadId)).limit(1);
	if (!chat) throw error(404, 'Thread not found');
	if (chat.user !== locals.user.id) throw error(403, 'Forbidden');

	const fileService = platform?.env?.FILE_SERVICE;
	if (!fileService) {
		return json({
			id: fileId,
			status: 'ready',
			name: 'uploaded-file',
			size: 0,
			type: 'application/octet-stream'
		});
	}

	const status = await fileService.getFileStatus({ fileId, userId: locals.user.id });
	return json({
		id: fileId,
		status: status?.status || 'ready',
		name: status?.name || 'file',
		size: status?.size || 0,
		type: status?.type || 'application/octet-stream'
	});
};
