import { error } from '@sveltejs/kit';
import { getTableData } from '$lib/functions/server-pagination';
import { userUploads } from '@repo/db/schema';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const userId = event.params.id;
	if (!userId) throw error(400, 'Missing user id');

	const tableData = await getTableData({
		id: 'uploads_table',
		event,
		table: userUploads,
		searchFilters: ['name', 'type'],
		sortKey: '-created',
		defaultFilter: sql`${userUploads.user} = ${userId}`
	});

	return { tableData };
};
