import type { RequestEvent } from '@sveltejs/kit';
import type { SQL, InferSelectModel } from 'drizzle-orm';
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core';
import { getPaginatedData, type TableData } from './pagination';

/**
 * Calls getPaginatedData and returns the TableData shape DataTable expects.
 * Use this in +page.server.ts load functions.
 */
export async function getTableData<T extends PgTable<TableConfig>>({
	id,
	event,
	table,
	searchFilters,
	sortKey = '-created',
	defaultFilter
}: {
	id: string;
	event: RequestEvent;
	table: T;
	searchFilters?: string[];
	sortKey?: string;
	defaultFilter?: SQL;
}): Promise<TableData<InferSelectModel<T>>> {
	return getPaginatedData<T>({
		id,
		loadUrl: event.url,
		cookies: event.cookies,
		db: event.locals.db,
		table,
		searchFilters,
		sortKey,
		defaultFilter
	});
}
