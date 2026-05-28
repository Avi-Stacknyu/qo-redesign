import { error } from '@sveltejs/kit';
import { getTableData } from '$lib/functions/server-pagination';
import { coreTokenLedger } from '@repo/db/schema';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const userId = event.params.id;
	if (!userId) throw error(400, 'Missing user id');

	const tableData = await getTableData({
		id: 'usage_table',
		event,
		table: coreTokenLedger,
		searchFilters: ['model', 'provider', 'category'],
		sortKey: '-created',
		defaultFilter: sql`${coreTokenLedger.user} = ${userId}`
	});

	return { tableData };
};
