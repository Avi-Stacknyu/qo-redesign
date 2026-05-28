import { getTableData } from '$lib/functions/server-pagination';
import { aiAgents, aiAgentFlows } from '@repo/db/schema';
import { inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = event.locals.db;

	const tableData = await getTableData({
		id: 'agents_table',
		event,
		table: aiAgents,
		searchFilters: ['name', 'description', 'status'],
		sortKey: '-created'
	});

	if (tableData.items.length === 0) return { tableData };

	const flowIds = [
		...new Set(tableData.items.map((a) => a.currentFlow).filter(Boolean))
	] as string[];

	const flows =
		flowIds.length > 0
			? await db.select().from(aiAgentFlows).where(inArray(aiAgentFlows.id, flowIds))
			: [];

	const flowMap = new Map(flows.map((f) => [f.id, f]));

	const enriched = tableData.items.map((a) => ({
		...a,
		expand: {
			current_flow: flowMap.get(a.currentFlow ?? '') ?? undefined
		}
	}));

	return { tableData: { ...tableData, items: enriched } };
};
