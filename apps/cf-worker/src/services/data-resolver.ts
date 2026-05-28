/**
 * Widget Data Resolver Service
 *
 * Registry-based resolver that maps DataSourceRef → ResolvedData.
 * Each source type has a dedicated handler. New types can be added
 * by registering a resolver function in the registry.
 */

import type { DataSourceRef, DataSourceType, ResolvedData } from '@repo/shared/types';
import type { Database } from '@repo/db/types';
import { dataSources, userDataSources } from '@repo/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface ResolverContext {
	userId: string;
	db: Database;
}

type ResolverFn = (ref: DataSourceRef, ctx: ResolverContext) => Promise<ResolvedData>;

const resolvers: Record<DataSourceType, ResolverFn> = {
	static: resolveStatic,
	'agent-generated': resolveAgentGenerated,
	'user-upload': resolveUserUpload,
	'analytical-tool': resolveAnalyticalTool,
	external: resolveExternal
};

/**
 * Resolve a data source reference to tabular data.
 * Returns null if the source type has no handler or the source doesn't exist.
 */
export async function resolveDataSource(
	ref: DataSourceRef,
	ctx: ResolverContext
): Promise<ResolvedData | null> {
	const handler = resolvers[ref.type];
	if (!handler) return null;
	return handler(ref, ctx);
}

/**
 * Resolve multiple data sources in parallel.
 * Returns a map of source_id → ResolvedData (entries with null results are omitted).
 */
export async function resolveMultipleDataSources(
	refs: DataSourceRef[],
	ctx: ResolverContext
): Promise<Map<string, ResolvedData>> {
	const entries = await Promise.all(
		refs.map(async (ref) => {
			const data = await resolveDataSource(ref, ctx);
			return [ref.source_id, data] as const;
		})
	);
	const map = new Map<string, ResolvedData>();
	for (const [id, data] of entries) {
		if (data) map.set(id, data);
	}
	return map;
}

// ---------------------------------------------------------------------------
// Static resolver — data is stored directly in the data_sources.config.data
// ---------------------------------------------------------------------------

async function resolveStatic(ref: DataSourceRef, ctx: ResolverContext): Promise<ResolvedData> {
	const record = await ctx.db.query.dataSources.findFirst({
		where: and(eq(dataSources.sourceKey, ref.source_id), eq(dataSources.isActive, true)),
		columns: { config: true }
	});

	const data = (record?.config as { data?: ResolvedData } | null)?.data;
	if (!data) return { columns: [], rows: [] };
	return data;
}

// ---------------------------------------------------------------------------
// Agent-generated resolver — reads from user_data_sources (user-owned data)
// ---------------------------------------------------------------------------

async function resolveAgentGenerated(
	ref: DataSourceRef,
	ctx: ResolverContext
): Promise<ResolvedData> {
	const record = await ctx.db.query.userDataSources.findFirst({
		where: and(eq(userDataSources.user, ctx.userId), eq(userDataSources.id, ref.source_id)),
		columns: { data: true, displayName: true }
	});

	const data = record?.data as ResolvedData | null;
	if (!data || !record) return { columns: [], rows: [] };
	return {
		...data,
		meta: { ...data.meta, source_label: record.displayName ?? undefined }
	};
}

// ---------------------------------------------------------------------------
// User-upload resolver — reads parsed upload data from user_data_sources
// ---------------------------------------------------------------------------

async function resolveUserUpload(ref: DataSourceRef, ctx: ResolverContext): Promise<ResolvedData> {
	const record = await ctx.db.query.userDataSources.findFirst({
		where: and(
			eq(userDataSources.user, ctx.userId),
			eq(userDataSources.id, ref.source_id),
			eq(userDataSources.createdBy, 'upload')
		),
		columns: { data: true, displayName: true }
	});

	const data = record?.data as ResolvedData | null;
	if (!data || !record) return { columns: [], rows: [] };
	return {
		...data,
		meta: { ...data.meta, source_label: record.displayName ?? undefined }
	};
}

// ---------------------------------------------------------------------------
// Analytical tool resolver — reads computed results from user_data_sources
// ---------------------------------------------------------------------------

async function resolveAnalyticalTool(
	ref: DataSourceRef,
	ctx: ResolverContext
): Promise<ResolvedData> {
	// If params.record_id is set, fetch that specific result by ID
	const recordId = ref.params?.record_id as string | undefined;

	type UDSRow = { data: unknown; displayName: string | null };

	let record: UDSRow | undefined;
	if (recordId) {
		record = await ctx.db.query.userDataSources.findFirst({
			where: and(
				eq(userDataSources.user, ctx.userId),
				eq(userDataSources.id, recordId),
				eq(userDataSources.createdBy, 'tool')
			),
			columns: { data: true, displayName: true }
		});
	} else {
		// Try source_id as tool_key first (e.g. "portfolio-risk-analyzer");
		// fall back to treating it as a direct user_data_sources record ID.
		record = await ctx.db.query.userDataSources.findFirst({
			where: and(
				eq(userDataSources.user, ctx.userId),
				eq(userDataSources.toolKey, ref.source_id),
				eq(userDataSources.createdBy, 'tool')
			),
			columns: { data: true, displayName: true },
			orderBy: desc(userDataSources.created)
		});

		if (!record) {
			record = await ctx.db.query.userDataSources.findFirst({
				where: and(
					eq(userDataSources.user, ctx.userId),
					eq(userDataSources.id, ref.source_id),
					eq(userDataSources.createdBy, 'tool')
				),
				columns: { data: true, displayName: true }
			});
		}
	}

	if (!record?.data) return { columns: [], rows: [] };

	// record.data may be:
	// 1. Plain ResolvedData  → { columns, rows }
	// 2. ToolExecutionResult → { data: { key: ResolvedData }, metrics, ... }
	// 3. Legacy direct map   → { allocation_chart: ResolvedData, holdings_table: ResolvedData }
	const raw = record.data as unknown as Record<string, unknown>;

	if (Array.isArray(raw.columns) && Array.isArray(raw.rows)) {
		// Shape 1: Already a ResolvedData
		return {
			...(raw as unknown as ResolvedData),
			meta: {
				...(raw as unknown as ResolvedData).meta,
				source_label: record.displayName ?? undefined
			}
		};
	}

	// Shape 2: ToolExecutionResult wrapper
	if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
		const dataMap = raw.data as Record<string, ResolvedData>;
		const availableKeys = Object.keys(dataMap);
		const dataKey = ref.params?.data_key as string | undefined;
		const resolved = (dataKey ? dataMap[dataKey] : Object.values(dataMap)[0]) ?? {
			columns: [],
			rows: []
		};
		return {
			...resolved,
			meta: {
				...resolved.meta,
				source_label: record.displayName ?? undefined,
				available_data_keys: availableKeys
			}
		};
	}

	// Shape 3: Legacy keyed map — values are ResolvedData objects directly on record.data
	const dataKey = ref.params?.data_key as string | undefined;
	const availableKeys = Object.keys(raw).filter(
		(k) =>
			raw[k] &&
			typeof raw[k] === 'object' &&
			Array.isArray((raw[k] as Record<string, unknown>).columns)
	);
	const candidate = dataKey
		? raw[dataKey]
		: Object.values(raw).find(
				(v) => v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).columns)
			);
	if (
		candidate &&
		typeof candidate === 'object' &&
		Array.isArray((candidate as Record<string, unknown>).columns)
	) {
		const resolved = candidate as unknown as ResolvedData;
		return {
			...resolved,
			meta: {
				...resolved.meta,
				source_label: record.displayName ?? undefined,
				available_data_keys: availableKeys
			}
		};
	}

	return { columns: [], rows: [] };
}

// ---------------------------------------------------------------------------
// External resolver — placeholder for Plaid and other external APIs
// ---------------------------------------------------------------------------

async function resolveExternal(_ref: DataSourceRef, _ctx: ResolverContext): Promise<ResolvedData> {
	return { columns: [], rows: [], meta: { source_label: 'External API (not yet implemented)' } };
}
