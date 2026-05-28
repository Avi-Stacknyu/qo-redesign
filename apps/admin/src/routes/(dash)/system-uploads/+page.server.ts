import { getTableData } from '$lib/functions/server-pagination';
import { aiSystemUploads } from '@repo/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const tableData = await getTableData({
		id: 'system_uploads_table',
		event,
		table: aiSystemUploads,
		searchFilters: ['name', 'type'],
		sortKey: '-created'
	});

	return { tableData };
};
