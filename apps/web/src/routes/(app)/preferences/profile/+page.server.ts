import { loadStructuredProfile } from '$lib/remote/profile-data.remote';
import { loadGraphMemory, loadUserFiles } from '$lib/remote/memory.remote';
import { getRequestEvent } from '$app/server';
import { eq, and } from 'drizzle-orm';
import { aiAgents } from '@repo/db/schema';

export async function load({ parent }) {
	const { agents } = await parent();
	const { locals } = getRequestEvent();

	const [profile, discoveryAgentId, graph, files] = await Promise.all([
		loadStructuredProfile(),
		resolveDiscoveryAgentId(locals.db),
		loadGraphMemory(),
		loadUserFiles()
	]);

	const defaultAgentId = discoveryAgentId ?? agents.at(0)?.id ?? '';

	return { profile, defaultAgentId, graph, files };
}

async function resolveDiscoveryAgentId(db: App.Locals['db']): Promise<string | null> {
	if (!db) return null;
	try {
		const [row] = await db
			.select({ id: aiAgents.id })
			.from(aiAgents)
			.where(and(eq(aiAgents.purpose, 'discovery'), eq(aiAgents.status, 'active')))
			.limit(1);
		return row?.id ?? null;
	} catch {
		return null;
	}
}
