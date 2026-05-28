import { error } from '@sveltejs/kit';
import { aiAgents } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user || !locals.db) throw error(401, 'Unauthorized');

	const { agentId } = params;
	if (!agentId) throw error(400, 'Missing agentId');

	const [agent] = await locals.db
		.select({ avatar: aiAgents.avatar })
		.from(aiAgents)
		.where(eq(aiAgents.id, agentId))
		.limit(1);

	if (!agent?.avatar) throw error(404, 'Avatar not found');

	if (agent.avatar.startsWith('http')) {
		return Response.redirect(agent.avatar, 302);
	}

	const bucket = platform?.env?.DOCUMENTS_BUCKET;
	if (!bucket) throw error(503, 'Storage not available');

	const key = agent.avatar.startsWith('assets/')
		? agent.avatar
		: `assets/avatars/ai_agents/${agentId}/${agent.avatar}`;
	const r2Object = await bucket.get(key);
	if (!r2Object) throw error(404, 'Avatar no longer exists in storage');

	return new Response(r2Object.body, {
		headers: {
			'Content-Type': r2Object.httpMetadata?.contentType || 'application/octet-stream',
			'Content-Length': String(r2Object.size),
			'Cache-Control': 'private, max-age=300'
		}
	});
};
