import { error } from '@sveltejs/kit';
import { getTableData } from '$lib/functions/server-pagination';
import { chats, aiAgents } from '@repo/db/schema';
import { sql, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const userId = event.params.id;
	if (!userId) throw error(400, 'Missing user id');
	const db = event.locals.db;

	const tableData = await getTableData({
		id: 'chats_table',
		event,
		table: chats,
		searchFilters: ['title', 'source'],
		sortKey: '-updated',
		defaultFilter: sql`${chats.user} = ${userId}`
	});

	if (tableData.items.length === 0) return { tableData };

	const agentIds = [...new Set(tableData.items.map((c) => c.agent).filter(Boolean))] as string[];

	const agents =
		agentIds.length > 0
			? await db.select().from(aiAgents).where(inArray(aiAgents.id, agentIds))
			: [];

	const agentMap = new Map(agents.map((a) => [a.id, a]));

	const enriched = tableData.items.map((c) => ({
		...c,
		expand: {
			agent: agentMap.get(c.agent ?? '') ?? undefined
		}
	}));

	return { tableData: { ...tableData, items: enriched } };
};
