import { getTableData } from '$lib/functions/server-pagination';
import { aiProviders } from '@repo/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const tableData = await getTableData({
		id: 'providers_table',
		event,
		table: aiProviders,
		searchFilters: ['display_name', 'provider_key', 'env_key_name'],
		sortKey: 'provider_key'
	});

	return { tableData };
};
