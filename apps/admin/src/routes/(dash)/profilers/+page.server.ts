import { getTableData } from '$lib/functions/server-pagination';
import { profilerAgents, aiAgentModels } from '@repo/db/schema';
import { inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = event.locals.db;

	try {
		const tableData = await getTableData({
			id: 'profilers_table',
			event,
			table: profilerAgents,
			searchFilters: ['name', 'description', 'status'],
			sortKey: '-created'
		});

		if (tableData.items.length === 0) return { tableData };

		const modelIds = [...new Set(tableData.items.map((p) => p.model).filter(Boolean))] as string[];

		const models =
			modelIds.length > 0
				? await db.select().from(aiAgentModels).where(inArray(aiAgentModels.id, modelIds))
				: [];

		const modelMap = new Map(models.map((m) => [m.id, m]));

		const enriched = tableData.items.map((p) => ({
			...p,
			expand: {
				model: modelMap.get(p.model ?? '') ?? undefined
			}
		}));

		return { tableData: { ...tableData, items: enriched } };
	} catch (e) {
		console.error('Failed to load profilers:', e);
		return { tableData: { items: [], totalItems: 0, totalPages: 0, page: 1, perPage: 20 } };
	}
};
