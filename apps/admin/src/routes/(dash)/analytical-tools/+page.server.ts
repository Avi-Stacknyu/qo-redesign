import { getTableData } from '$lib/functions/server-pagination';
import { analyticalTools } from '@repo/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const tableData = await getTableData({
		id: 'analytical_tools_table',
		event,
		table: analyticalTools,
		searchFilters: ['tool_key', 'display_name', 'description', 'category'],
		sortKey: 'display_name'
	});

	return { tableData };
};
