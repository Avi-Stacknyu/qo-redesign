import { createLogger, formatError } from './logger';
import { getDb } from '../lib/db';
import type { Database } from '@repo/db/types';
import { resolveUserTags } from './resolve-user-tags';
import { filterVisibleByTags } from './tag-visibility';
import type { TagRule } from '@repo/shared/types';

/**
 * Wrap an RPC method with standardized error handling.
 * Provides a db instance and catches errors with structured logging.
 */
export async function rpcSafe<T>(
	env: Env,
	method: string,
	fallback: T,
	fn: (db: Database) => Promise<T>,
	context?: Record<string, unknown>
): Promise<T> {
	try {
		const db = await getDb(env);
		return await fn(db);
	} catch (error) {
		const log = createLogger('Worker', context);
		log.error(`${method}_failed`, { ...formatError(error) });
		return fallback;
	}
}

/**
 * Resolve tag-gated visibility for any collection.
 *
 * Handles the repeated pattern:
 *   1. resolveUserTags
 *   2. fetch rows from DB
 *   3. map to { tag_rule } shape
 *   4. filterVisibleByTags
 *   5. map to output shape
 */
export async function resolveVisibleItems<TRow extends { id: string }, TOut>(
	userId: string,
	db: Database,
	fetchRows: (db: Database) => Promise<TRow[]>,
	getTagRule: (row: TRow) => TagRule | null,
	mapOutput: (row: TRow) => TOut
): Promise<TOut[]> {
	const userTags = await resolveUserTags(userId, db);
	const rows = await fetchRows(db);
	const tagged = rows.map((r) => ({ ...r, tag_rule: getTagRule(r) }));
	const visible = filterVisibleByTags(tagged, userTags);
	return visible.map((v) => mapOutput(v as unknown as TRow));
}
