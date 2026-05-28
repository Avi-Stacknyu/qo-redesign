/**
 * Global Profile Schema Loader
 *
 * Loads the active global profile schema from `config_profile_schema` table.
 * Replaces the old per-profiler schema merge logic with a single source of truth.
 *
 * Uses TTL caching to avoid repeated DB calls within the same worker lifecycle.
 */

import type { Database } from '@repo/db/types';
import { configProfileSchema } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import type { ProfileSchemaSection } from '../types/profiler';
import { normalizeSchema } from '../types/profiler';
import { createTTLCache } from './ttl-cache';
import { createLogger, formatError } from './logger';

const SCHEMA_CACHE_TTL_MS = 60_000; // 1 minute

const schemaCache = createTTLCache<ProfileSchemaSection[]>(SCHEMA_CACHE_TTL_MS);

/**
 * Load the active global profile schema from the database.
 * Returns normalized `ProfileSchemaSection[]` or empty array if none found.
 */
export async function loadGlobalProfileSchema(db: Database): Promise<ProfileSchemaSection[]> {
	const cached = schemaCache.get();
	if (cached) return cached;

	const log = createLogger('SchemaLoader');

	try {
		const record = await db.query.configProfileSchema.findFirst({
			where: eq(configProfileSchema.isActive, true)
		});

		if (!record) return [];

		const schema = normalizeSchema(record.schema as any);
		schemaCache.set(schema);
		return schema;
	} catch (e: unknown) {
		log.warn('global_schema_load_failed', formatError(e));
		return [];
	}
}

/** Clear the cached schema (useful after admin edits). */
export function clearGlobalSchemaCache(): void {
	schemaCache.clear();
}
