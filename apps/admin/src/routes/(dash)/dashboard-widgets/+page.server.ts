import { getTableData } from '$lib/functions/server-pagination';
import { dashboardWidgets } from '@repo/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const tableData = await getTableData({
		id: 'widgets_table',
		event,
		table: dashboardWidgets,
		searchFilters: ['name', 'widget_type', 'category', 'description'],
		sortKey: 'name'
	});

	return { tableData };
};
