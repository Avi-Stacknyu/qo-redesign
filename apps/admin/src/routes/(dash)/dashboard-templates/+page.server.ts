import { getTableData } from '$lib/functions/server-pagination';
import { dashboardTemplates } from '@repo/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const tableData = await getTableData({
		id: 'templates_table',
		event,
		table: dashboardTemplates,
		searchFilters: ['name', 'description', 'category'],
		sortKey: '-created'
	});

	return { tableData };
};
