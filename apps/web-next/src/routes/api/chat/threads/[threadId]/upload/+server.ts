/**
 * File Upload Endpoint — uploads files to chat via FILE_SERVICE entrypoint.
 */
import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { chats } from '@repo/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { threadId } = params;
	if (!threadId) throw error(400, 'Thread ID is required');

	try {
		const [chat] = await locals.db.select().from(chats).where(eq(chats.id, threadId)).limit(1);
		if (!chat) throw error(404, 'Thread not found');
		if (chat.user !== locals.user.id) throw error(403, 'Forbidden');

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const scope = (formData.get('scope') as string) || 'chat';

		if (!file) throw error(400, 'No file provided');

		const fileService = platform?.env?.FILE_SERVICE;
		if (!fileService) throw error(500, 'File service not available');

		const fileBuffer = await file.arrayBuffer();
		const result = await fileService.uploadFileBuffer({
			fileBuffer,
			fileName: file.name,
			fileType: file.type,
			lastModified: file.lastModified,
			userId: locals.user.id,
			chatId: threadId,
			shareWithAgent: scope === 'chat'
		});

		return json({
			file: {
				id: result.id,
				name: result.name,
				type: result.type,
				size: result.size,
				url: result.path
			},
			processing: { status: 'processing', processingId: result.processingId }
		});
	} catch (err) {
		console.error('[Upload] File upload error:', err);
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(500, 'Failed to upload file');
	}
};
