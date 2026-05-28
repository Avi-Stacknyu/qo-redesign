import { sql, type InferSelectModel, type SQL } from 'drizzle-orm';
import { getTableColumns } from 'drizzle-orm';
import type { AnyPgColumn, PgTable, PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import type { Database } from '@repo/db/client';
import { redirect, setFlash } from 'sveltekit-flash-message/server';
import { type Cookies } from '@sveltejs/kit';

export interface TableData<T> {
	items: T[];
	totalItems: number;
	totalPages: number;
	page: number;
	perPage: number;
}

type AdminPgTable = PgTableWithColumns<TableConfig>;
type AdminColumn = AnyPgColumn;

function buildColumnMap<TTable extends AdminPgTable>(table: TTable): Map<string, AdminColumn> {
	const columns = getTableColumns(table);
	const map = new Map<string, AdminColumn>();
	for (const [jsName, column] of Object.entries(columns)) {
		const pgColumn = column as AdminColumn;
		map.set(pgColumn.name, pgColumn);
		map.set(jsName, pgColumn);
	}
	return map;
}

function mapOperator(col: AdminColumn, operator: string, value: string): SQL {
	switch (operator) {
		case '=':
			return sql`${col} = ${value}`;
		case '!=':
			return sql`${col} != ${value}`;
		case '~':
			return sql`${col} ILIKE ${'%' + value + '%'}`;
		case '!~':
			return sql`${col} NOT ILIKE ${'%' + value + '%'}`;
		case '>':
			return sql`${col} > ${value}`;
		case '<':
			return sql`${col} < ${value}`;
		case '>=':
			return sql`${col} >= ${value}`;
		case '<=':
			return sql`${col} <= ${value}`;
		default:
			return sql`${col} = ${value}`;
	}
}

function parseSortKey(sortKey: string, columnMap: Map<string, AdminColumn>): SQL {
	const parts = sortKey
		.split(',')
		.map((part) => {
			const desc = part.startsWith('-');
			const name = desc ? part.slice(1) : part;
			const col = columnMap.get(name);
			if (!col) return null;
			return desc ? sql`${col} DESC` : sql`${col} ASC`;
		})
		.filter((p): p is SQL => p !== null);
	return parts.length > 0 ? sql.join(parts, sql`, `) : sql`1`;
}

function parseUrlSort(rawSort: string, columnMap: Map<string, AdminColumn>): SQL {
	const rawS = JSON.parse(rawSort) as string[];
	const parts = rawS
		.map((s) => {
			const [colName, dir] = s.split(':');
			const col = columnMap.get(colName);
			if (!col) return null;
			return dir === 'asc' ? sql`${col} ASC` : sql`${col} DESC`;
		})
		.filter((p): p is SQL => p !== null);
	return parts.length > 0 ? sql.join(parts, sql`, `) : sql`1`;
}

export async function getPaginatedData<T extends PgTable<TableConfig>>({
	id,
	loadUrl,
	cookies,
	db,
	table,
	select,
	defaultFilter,
	enableRedirect = false,
	sortKey = '-created',
	redirectUrl,
	formDayCount,
	searchFilters
}: {
	id: string;
	loadUrl: URL;
	cookies: Cookies;
	db: Database;
	table: T;
	select?: Record<string, unknown>;
	enableRedirect?: boolean;
	sortKey?: string;
	redirectUrl?: string;
	defaultFilter?: SQL;
	formDayCount?: string;
	searchFilters?: string[];
}): Promise<TableData<InferSelectModel<T>>> {
	const currentPage = parseInt(loadUrl.searchParams.get(`${id}_page`) || '1');
	const size = parseInt(loadUrl.searchParams.get(`${id}_perPage`) || '10');
	const rawFilters = loadUrl.searchParams.get(`${id}_filters`);
	const rawSort = loadUrl.searchParams.get(`${id}_sort`);
	const search = loadUrl.searchParams.get(`${id}_search`);

	const columnMap = buildColumnMap(table as unknown as AdminPgTable);

	const conditions: SQL[] = [];

	if (defaultFilter) conditions.push(sql`(${defaultFilter})`);

	if (rawFilters) {
		const filters = JSON.parse(rawFilters) as [string, string, string | string[]][];
		for (const [key, operator, value] of filters) {
			const col = columnMap.get(key);
			if (!col) continue;
			if (Array.isArray(value)) {
				const orConds = value.map((v) => mapOperator(col, operator, v));
				if (orConds.length > 0) conditions.push(sql`(${sql.join(orConds, sql` OR `)})`);
			} else {
				conditions.push(mapOperator(col, operator, value));
			}
		}
	}

	if (searchFilters && search && search.length > 0) {
		const searchConds = searchFilters
			.map((f) => columnMap.get(f))
			.filter((c): c is AdminColumn => !!c)
			.map((col) => sql`${col} ILIKE ${'%' + search + '%'}`);
		if (searchConds.length > 0) conditions.push(sql`(${sql.join(searchConds, sql` OR `)})`);
	}

	if (formDayCount) {
		const date = new Date();
		date.setDate(date.getDate() - parseInt(formDayCount));
		const createdCol = columnMap.get('created');
		if (createdCol) conditions.push(sql`${createdCol} >= ${date.toISOString()}`);
	}

	const where = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;
	const orderBy = rawSort ? parseUrlSort(rawSort, columnMap) : parseSortKey(sortKey, columnMap);

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		.from(table as any)
		.where(where);

	const items = (await (select ? db.select(select as never) : db.select())
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		.from(table as any)
		.where(where)
		.orderBy(orderBy)
		.limit(size)
		.offset((currentPage - 1) * size)) as unknown as InferSelectModel<T>[];

	const totalItems = count;
	const totalPages = Math.max(1, Math.ceil(totalItems / size));

	if (items.length === 0 && enableRedirect) {
		if (redirectUrl) {
			redirect(redirectUrl, { type: 'error', message: 'No records found' }, cookies);
		} else {
			setFlash({ type: 'error', message: 'No records found' }, cookies);
		}
	}

	return { items, totalItems, totalPages, page: currentPage, perPage: size };
}
