import { query, getRequestEvent } from '$app/server';
import { aiAgents } from '@repo/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { extractCfHeaders, getVisibleAgentsFromWorker } from '$lib/utils/agent-visibility';

export type Agent = {
	id: string;
	name: string;
	description: string | null;
	avatar_url: string | null;
	status: 'active' | 'inactive';
};

export const getAgents = query(async () => {
	const { locals, platform, request } = getRequestEvent();
	if (!locals.db || !locals.user) return [];

	try {
		const cfHeaders = extractCfHeaders(request);
		const result = await getVisibleAgentsFromWorker(platform, locals.user.id, cfHeaders);

		const workerAvailable =
			result.agents.length > 0 || result.hasShelf || platform?.env?.CF_WORKER !== undefined;

		if (workerAvailable) {
			return result.agents.map((a) => ({
				id: a.id,
				name: a.name,
				description: a.description || null,
				avatar_url: a.avatar_url ?? null,
				status: (a.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive'
			}));
		}

		// Fallback: direct DB load (local dev without CF_WORKER)
		const records = await locals.db
			.select()
			.from(aiAgents)
			.where(and(eq(aiAgents.status, 'active'), ne(aiAgents.purpose, 'discovery')))
			.orderBy(aiAgents.name);

		return records.map((r) => ({
			id: r.id,
			name: r.name || '',
			description: r.description || null,
			avatar_url: r.avatar ? `/api/agent-avatar/${r.id}` : null,
			status: (r.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive'
		}));
	} catch (err) {
		console.error('Error fetching agents:', err);
		return [];
	}
});
