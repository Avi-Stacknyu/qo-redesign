/**
 * Flush Pending Extraction + Profiler
 *
 * Called when the user navigates away from a chat.
 * Immediately triggers extraction and profiler on any pending messages
 * instead of waiting for the 5-message threshold or 300s session timeout.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals, platform }) => {
	const chatId = params.threadId;
	if (!chatId) throw error(400, 'Missing threadId');

	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const { agentId }: { agentId: string } = await request.json();
	if (!agentId) throw error(400, 'agentId is required');

	const quantAgent = platform?.env?.QUANT_AGENT;
	if (!quantAgent) throw error(503, 'Agent service unavailable');

	try {
		const id = quantAgent.idFromName(chatId);
		const stub = quantAgent.get(id);
		const result = await stub.flushPending({ chatId, userId, agentId });
		return Response.json(result);
	} catch (err) {
		console.error('[Flush] Error:', err);
		if (err instanceof Error && 'status' in err) throw err;
		throw error(500, 'Failed to flush pending messages');
	}
};
