import { getTableData } from '$lib/functions/server-pagination';
import { aiTools, aiProviders } from '@repo/db/schema';
import { inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = event.locals.db;

	const tableData = await getTableData({
		id: 'tools_table',
		event,
		table: aiTools,
		searchFilters: ['display_name', 'tool_key', 'sdk_tool_name'],
		sortKey: 'display_name'
	});

	if (tableData.items.length === 0) return { tableData };

	const providerIds = [
		...new Set(tableData.items.map((t) => t.provider).filter(Boolean))
	] as string[];

	const providers =
		providerIds.length > 0
			? await db.select().from(aiProviders).where(inArray(aiProviders.id, providerIds))
			: [];

	const providerMap = new Map(providers.map((p) => [p.id, p]));

	const enriched = tableData.items.map((t) => ({
		...t,
		expand: {
			provider: providerMap.get(t.provider ?? '') ?? undefined
		}
	}));

	return { tableData: { ...tableData, items: enriched } };
};
